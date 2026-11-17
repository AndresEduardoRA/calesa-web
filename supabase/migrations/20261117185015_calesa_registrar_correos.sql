-- Calesa · el registro de correos por RPC (semilla X6, §3 l. 264 y 296: correos_salientes se escribe sólo por RPC; paso P27, C1–C6).
-- registrar_correo y las lecturas por referencia, por id y de los programados de una reunión o una solicitud. Las llama el servidor
-- con el cliente admin (sólo `service_role`, §4 l. 360); el adaptador de RegistroDeCorreos es de P29. La respuesta es la fila con
-- las 14 claves de FilaDeCorreo (src/modules/notificaciones/entities/registro.ts); sin fila, null (P0002 caería en `inesperado`).
-- La tabla queda como está: RLS con el select del admin y sin escritura directa.

-- C1: la fila como la ve el código, en camelCase y sin `creado_en`. Estable: `to_jsonb(timestamptz)` depende de TimeZone.
create function public._correo_json(c public.correos_salientes)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('id', c.id, 'para', c.para::text, 'plantilla', c.plantilla, 'datos', c.datos,
    'adjuntoIcs', c.adjunto_ics, 'estado', c.estado, 'resendId', c.resend_id, 'programadoPara', c.programado_para,
    'intentos', c.intentos, 'ultimoError', c.ultimo_error, 'enviadoEn', c.enviado_en, 'referencia', c.referencia,
    'reunionId', c.reunion_id, 'solicitudId', c.solicitud_id)
$$;

-- C2: el único 22023 de estas RPC, con el parámetro en `hint`. Estable, no inmutable: una llamada con constante no se pliega al
-- planificar.
create function public._correo_invalido(p_campo text)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  raise exception 'Un dato del correo no es válido.' using errcode = '22023', hint = p_campo;
end;
$$;

-- C4: se registra después de mandar (P07): enviado, programado o fallido, nunca cancelado. `para` admite varios destinatarios
-- separados por coma, cada uno con la regla de email de P02. La base no valida la plantilla (el catálogo vive en TypeScript) ni que
-- la reunión o la solicitud existan (sin FK, a propósito). El error del proveedor se corta a 1000: registrar un fallo no puede fallar.
create function public.registrar_correo(p_para text, p_plantilla text, p_datos jsonb, p_estado public.estado_correo,
  p_intentos int default 0, p_adjunto_ics text default null, p_resend_id text default null,
  p_programado_para timestamptz default null, p_ultimo_error text default null, p_enviado_en timestamptz default null,
  p_referencia text default null, p_reunion_id uuid default null, p_solicitud_id uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.correos_salientes;
begin
  if p_para is null or char_length(p_para) not between 3 and 1000
     or exists (select 1 from unnest(string_to_array(p_para, ',')) d where btrim(d) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    perform public._correo_invalido('p_para');
  end if;
  if p_plantilla is null or char_length(p_plantilla) not between 1 and 80 then
    perform public._correo_invalido('p_plantilla');
  end if;
  if p_datos is null or jsonb_typeof(p_datos) <> 'object' then
    perform public._correo_invalido('p_datos');
  end if;
  if p_estado is null or p_estado = 'cancelado' then
    perform public._correo_invalido('p_estado');
  end if;
  if p_intentos is null or p_intentos < 0 then
    perform public._correo_invalido('p_intentos');
  end if;
  if p_estado = 'programado' and p_programado_para is null then
    perform public._correo_invalido('p_programado_para');
  end if;
  if p_estado = 'enviado' and p_enviado_en is null then
    perform public._correo_invalido('p_enviado_en');
  end if;
  if p_estado = 'fallido' and (p_ultimo_error is null or p_ultimo_error = '') then
    perform public._correo_invalido('p_ultimo_error');
  end if;
  -- El tope del kit para la idempotencia (src/shared/lib/email/tipos.ts).
  if p_referencia is not null and char_length(p_referencia) not between 1 and 256 then
    perform public._correo_invalido('p_referencia');
  end if;

  -- correos_salientes_referencia_key: una referencia repetida no inserta y es `duplicado` para P29. Con referencia nula no choca.
  insert into public.correos_salientes (para, plantilla, datos, adjunto_ics, estado, resend_id, programado_para, intentos,
    ultimo_error, enviado_en, referencia, reunion_id, solicitud_id)
  values (p_para, p_plantilla, p_datos, p_adjunto_ics, p_estado, p_resend_id, p_programado_para, p_intentos,
    left(p_ultimo_error, 1000), p_enviado_en, p_referencia, p_reunion_id, p_solicitud_id)
  on conflict (referencia) do nothing
  returning * into v;
  if v.id is null then
    raise exception 'Ya existe un correo con esa referencia.' using errcode = '23505', hint = 'p_referencia';
  end if;
  return public._correo_json(v);
end;
$$;

-- C5: por referencia (correos_salientes_referencia_key) y por id (la clave primaria).
create function public.correo_por_referencia(p_referencia text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_referencia is null then
    perform public._correo_invalido('p_referencia');
  end if;
  -- correos_salientes_referencia_key
  return (select public._correo_json(c) from public.correos_salientes c where c.referencia = p_referencia);
end;
$$;

create function public.correo_por_id(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_id is null then
    perform public._correo_invalido('p_id');
  end if;
  -- correos_salientes_pkey
  return (select public._correo_json(c) from public.correos_salientes c where c.id = p_id);
end;
$$;

-- C6: los programados de una reunión o de una solicitud (para cancelarlos o reprogramarlos), por hora; exactamente uno de los dos
-- ids. Dos consultas, una por rama, cada una con su índice parcial; la lista ordena antes de cortar y agrega en el mismo orden.
create function public.correos_programados_de(p_reunion_id uuid default null, p_solicitud_id uuid default null,
  p_tope int default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tope constant int := public._acotar_pagina(p_tope, 50, 100);
begin
  if (p_reunion_id is null) = (p_solicitud_id is null) then
    perform public._correo_invalido('p_reunion_id');
  end if;
  if p_reunion_id is not null then
    -- correos_salientes_reunion (reunion_id) where estado = 'programado'
    return (select coalesce(jsonb_agg(public._correo_json(x) order by x.programado_para, x.id), '[]'::jsonb)
              from (select c.* from public.correos_salientes c
                     where c.reunion_id = p_reunion_id and c.estado = 'programado'
                     order by c.programado_para, c.id limit v_tope) x);
  end if;
  -- correos_salientes_solicitud (solicitud_id) where estado = 'programado'
  return (select coalesce(jsonb_agg(public._correo_json(x) order by x.programado_para, x.id), '[]'::jsonb)
            from (select c.* from public.correos_salientes c
                   where c.solicitud_id = p_solicitud_id and c.estado = 'programado'
                   order by c.programado_para, c.id limit v_tope) x);
end;
$$;

revoke all on function public._correo_json(public.correos_salientes) from public, anon, authenticated;
revoke all on function public._correo_invalido(text) from public, anon, authenticated;
revoke all on function public.registrar_correo(text, text, jsonb, public.estado_correo, int, text, text, timestamptz, text,
  timestamptz, text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.correo_por_referencia(text) from public, anon, authenticated;
revoke all on function public.correo_por_id(uuid) from public, anon, authenticated;
revoke all on function public.correos_programados_de(uuid, uuid, int) from public, anon, authenticated;
grant execute on function public.registrar_correo(text, text, jsonb, public.estado_correo, int, text, text, timestamptz, text,
  timestamptz, text, uuid, uuid) to service_role;
grant execute on function public.correo_por_referencia(text) to service_role;
grant execute on function public.correo_por_id(uuid) to service_role;
grant execute on function public.correos_programados_de(uuid, uuid, int) to service_role;
