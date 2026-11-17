-- Calesa · el WhatsApp del turno y los eventos de medición (semilla §5.6 l. 510 y 516, R4.9, §3 l. 254 y 296, §9 l. 938; paso P31,
-- C11–C14). Las llama el servidor público (`GET /api/whatsapp`, `POST /api/eventos` y las rutas de cada caso; P37, P35, P36) después
-- de validar con Zod: sólo `service_role`. El evento no guarda nada del visitante (X7). La elección repite el reparto parejo de
-- solicitudes (`_elegir_asignado`, P30) contando clics en vez de solicitudes.

-- C11, C12 (P3a): bajo su propio candado, elige entre los vendedores activos, en turno y con WhatsApp (si no hay, los admins con lo
-- mismo, R4.9) al de menos `clic_whatsapp` en la semana ISO local; empate: su último clic (de cualquier semana) más antiguo, sin
-- ninguno primero; después `perfiles.creado_en`; después el id. Registra el clic en la misma transacción, así dos clics a la vez no
-- eligen igual por el mismo conteo; sin nadie, el clic queda sin persona y devuelve null.
create function public.elegir_whatsapp(p_pagina text default null, p_utm_source text default null, p_utm_medium text default null,
  p_utm_campaign text default null, p_utm_term text default null, p_utm_content text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_whatsapp text;
  v_columna text;
  v_restriccion text;
begin
  perform pg_advisory_xact_lock(hashtext('calesa:whatsapp'));
  with w as (
    select (date_trunc('week', now() at time zone c.zona_horaria) at time zone c.zona_horaria) as desde,
           ((date_trunc('week', now() at time zone c.zona_horaria) + interval '7 days') at time zone c.zona_horaria) as hasta
      from public.config_agenda c where c.id = 1
  ), rol as (
    select case when exists (select 1 from public.perfiles v
                              where v.rol = 'vendedor' and v.activo and v.en_turno and v.whatsapp is not null)
                then 'vendedor' else 'admin' end::public.rol_usuario as rol
  )
  select p.id, p.whatsapp into v_id, v_whatsapp
    from public.perfiles p
    join rol on rol.rol = p.rol
   cross join w
   cross join lateral (
     -- eventos_tipo (tipo, perfil_id, creado_en desc): los clics de la semana, con tope.
     select count(*) as n from (
       select 1 from public.eventos e
        where e.tipo = 'clic_whatsapp' and e.perfil_id = p.id and e.creado_en >= w.desde and e.creado_en < w.hasta
        limit 1000) x) k
   cross join lateral (
     -- eventos_tipo: su último clic.
     select max(e.creado_en) as ultimo from public.eventos e where e.tipo = 'clic_whatsapp' and e.perfil_id = p.id) u
   where p.activo and p.en_turno and p.whatsapp is not null
   order by k.n, u.ultimo nulls first, p.creado_en, p.id
   limit 1;
  begin
    insert into public.eventos (tipo, pagina, utm_source, utm_medium, utm_campaign, utm_term, utm_content, perfil_id)
    values ('clic_whatsapp', p_pagina, p_utm_source, p_utm_medium, p_utm_campaign, p_utm_term, p_utm_content, v_id);
  exception when check_violation then
    get stacked diagnostics v_columna = column_name, v_restriccion = constraint_name;
    raise exception 'El evento no es válido.' using errcode = '22023', hint = coalesce(nullif(v_columna, ''), v_restriccion);
  end;
  if v_id is null then
    return null;
  end if;
  return jsonb_build_object('perfilId', v_id, 'whatsapp', v_whatsapp);
end;
$$;

-- C13 (P4a): cualquier otro tipo, sin persona; `clic_whatsapp` sólo lo escribe `elegir_whatsapp`. La ruta pública lo acota a
-- `clic_agendar` y `calculadora_usada` con su Zod; los demás los escribe el servidor de cada caso con su `solicitud_id`.
create function public.registrar_evento(p_tipo public.tipo_evento, p_pagina text default null, p_utm_source text default null,
  p_utm_medium text default null, p_utm_campaign text default null, p_utm_term text default null, p_utm_content text default null,
  p_solicitud_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_columna text;
  v_restriccion text;
begin
  if p_tipo is null or p_tipo = 'clic_whatsapp' then
    raise exception 'El evento no es válido.' using errcode = '22023', hint = 'p_tipo';
  end if;
  insert into public.eventos (tipo, pagina, utm_source, utm_medium, utm_campaign, utm_term, utm_content, solicitud_id)
  values (p_tipo, p_pagina, p_utm_source, p_utm_medium, p_utm_campaign, p_utm_term, p_utm_content, p_solicitud_id);
exception when check_violation then
  get stacked diagnostics v_columna = column_name, v_restriccion = constraint_name;
  raise exception 'El evento no es válido.' using errcode = '22023', hint = coalesce(nullif(v_columna, ''), v_restriccion);
end;
$$;

-- C14: sólo el servidor.
revoke all on function public.elegir_whatsapp(text, text, text, text, text, text),
  public.registrar_evento(public.tipo_evento, text, text, text, text, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.elegir_whatsapp(text, text, text, text, text, text),
  public.registrar_evento(public.tipo_evento, text, text, text, text, text, text, uuid)
  to service_role;
