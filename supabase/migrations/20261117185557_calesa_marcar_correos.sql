-- Calesa · mover el estado de un correo registrado (semilla X6, §3 l. 264 y 296; paso P27, C2, C3, C8–C12): marcar enviado,
-- fallido, cancelado o reprogramado. Sólo `service_role` (el envío y el despacho de P07). Sin `p_actualizado_en_esperado` (P1a: la
-- tabla no tiene versión y nadie edita un correo a mano): la guarda es la tabla de transiciones, con la fila tomada `for update`.
-- Un id que no está da null (P29 lo lee como no_encontrado).

-- C8: la tabla de transiciones. Desde programado o fallido, las cuatro; enviado es terminal; cancelado sólo vuelve a cancelarse
-- (sin cambios). Fuera de `p_desde`: P0001 «Un correo <estado> no pasa a <destino>.».
create function public._tomar_correo(p_id uuid, p_destino public.estado_correo, p_desde public.estado_correo[])
returns public.correos_salientes
language plpgsql
volatile
set search_path = ''
as $$
declare
  v public.correos_salientes;
begin
  -- correos_salientes_pkey; la fila queda tomada hasta el fin de la transacción: dos marcas a la vez se serializan.
  select * into v from public.correos_salientes c where c.id = p_id for update;
  if v.id is null then
    return null;
  end if;
  if not v.estado = any (p_desde) then
    raise exception 'Un correo % no pasa a %.', v.estado, p_destino;
  end if;
  return v;
end;
$$;

-- C9: salió (o el proveedor lo aceptó). Limpia el error y no toca la hora programada.
create function public.marcar_correo_enviado(p_id uuid, p_intentos int, p_enviado_en timestamptz, p_resend_id text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.correos_salientes;
begin
  if p_id is null then
    perform public._correo_invalido('p_id');
  end if;
  if p_intentos is null or p_intentos < 0 then
    perform public._correo_invalido('p_intentos');
  end if;
  if p_enviado_en is null then
    perform public._correo_invalido('p_enviado_en');
  end if;
  v := public._tomar_correo(p_id, 'enviado', array['programado', 'fallido']::public.estado_correo[]);
  if v.id is null then
    return null;
  end if;
  update public.correos_salientes c
     set estado = 'enviado', resend_id = p_resend_id, intentos = p_intentos, enviado_en = p_enviado_en, ultimo_error = null
   where c.id = v.id
  returning * into v;
  return public._correo_json(v);
end;
$$;

-- C10: el proveedor falló. Guarda el error (cortado a 1000) y conserva resend_id y la hora, para reintentar o cancelar.
create function public.marcar_correo_fallido(p_id uuid, p_intentos int, p_ultimo_error text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.correos_salientes;
begin
  if p_id is null then
    perform public._correo_invalido('p_id');
  end if;
  if p_intentos is null or p_intentos < 0 then
    perform public._correo_invalido('p_intentos');
  end if;
  if p_ultimo_error is null or p_ultimo_error = '' then
    perform public._correo_invalido('p_ultimo_error');
  end if;
  v := public._tomar_correo(p_id, 'fallido', array['programado', 'fallido']::public.estado_correo[]);
  if v.id is null then
    return null;
  end if;
  update public.correos_salientes c
     set estado = 'fallido', intentos = p_intentos, ultimo_error = left(p_ultimo_error, 1000)
   where c.id = v.id
  returning * into v;
  return public._correo_json(v);
end;
$$;

-- C11: sólo cambia el estado. Desde fallido también, para que un fallido de una reunión cancelada deje de reintentarse. Sobre un
-- cancelado devuelve la fila como está: dos cancelaciones a la vez no dan error.
create function public.marcar_correo_cancelado(p_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.correos_salientes;
begin
  if p_id is null then
    perform public._correo_invalido('p_id');
  end if;
  v := public._tomar_correo(p_id, 'cancelado', array['programado', 'fallido', 'cancelado']::public.estado_correo[]);
  if v.id is null then
    return null;
  end if;
  if v.estado <> 'cancelado' then
    update public.correos_salientes c set estado = 'cancelado' where c.id = v.id returning * into v;
  end if;
  return public._correo_json(v);
end;
$$;

-- C12: vuelve a programado con su hora nueva y limpia el error; `intentos` no cambia. resend_id queda como estaba salvo que
-- `p_cambiar_resend_id` diga que se pisa con `p_resend_id` (aunque sea nulo): así se distingue el `undefined` del `null` del contrato
-- de P07. Un id de Resend sin la bandera es un error, no se descarta. No compara la hora con now(): la hora de la app no es la de la
-- base con el reloj fijo de las e2e; «no programar en el pasado» es de P07.
create function public.marcar_correo_reprogramado(p_id uuid, p_programado_para timestamptz, p_resend_id text default null,
  p_cambiar_resend_id boolean default false)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.correos_salientes;
begin
  if p_id is null then
    perform public._correo_invalido('p_id');
  end if;
  if p_programado_para is null then
    perform public._correo_invalido('p_programado_para');
  end if;
  if p_cambiar_resend_id is null then
    perform public._correo_invalido('p_cambiar_resend_id');
  end if;
  if not p_cambiar_resend_id and p_resend_id is not null then
    perform public._correo_invalido('p_resend_id');
  end if;
  v := public._tomar_correo(p_id, 'programado', array['programado', 'fallido']::public.estado_correo[]);
  if v.id is null then
    return null;
  end if;
  update public.correos_salientes c
     set estado = 'programado', programado_para = p_programado_para, ultimo_error = null,
         resend_id = case when p_cambiar_resend_id then p_resend_id else c.resend_id end
   where c.id = v.id
  returning * into v;
  return public._correo_json(v);
end;
$$;

revoke all on function public._tomar_correo(uuid, public.estado_correo, public.estado_correo[]) from public, anon, authenticated;
revoke all on function public.marcar_correo_enviado(uuid, int, timestamptz, text) from public, anon, authenticated;
revoke all on function public.marcar_correo_fallido(uuid, int, text) from public, anon, authenticated;
revoke all on function public.marcar_correo_cancelado(uuid) from public, anon, authenticated;
revoke all on function public.marcar_correo_reprogramado(uuid, timestamptz, text, boolean) from public, anon, authenticated;
grant execute on function public.marcar_correo_enviado(uuid, int, timestamptz, text) to service_role;
grant execute on function public.marcar_correo_fallido(uuid, int, text) to service_role;
grant execute on function public.marcar_correo_cancelado(uuid) to service_role;
grant execute on function public.marcar_correo_reprogramado(uuid, timestamptz, text, boolean) to service_role;
