-- Calesa · cambiar y cancelar una demo (semilla §5.8, B13, B15, R2.3, R4.1, R4.16; paso P05, C13–C15, C20, C21). Dos entradas por
-- acción (P1 del plan): la del visitante, por token, sólo `service_role` (§4 l. 360 intacto), con el plazo de B15; la del panel, sólo
-- `authenticated`, con la clave `reuniones.cambiar` sobre el anfitrión y sin plazo (R4.1). Un token de gestión identifica la
-- solicitud: actúa sobre su reunión confirmada vigente, también después de volver a reservar (P2).

-- Bloquea la solicitud y después su reunión confirmada: el mismo orden que reservar y cambiar_estado_solicitud (cuyo trigger toca la
-- reunión después de la solicitud), así dos de ellas a la vez no se bloquean entre sí. Sin confirmada vigente, E8.
create function public._bloquear_vigente(p_solicitud uuid, p_reunion uuid)
returns public.reuniones
language plpgsql
set search_path = ''
as $$
declare
  v_r public.reuniones;
begin
  perform 1 from public.solicitudes s where s.id = p_solicitud for update;
  -- reuniones_una_confirmada
  select * into v_r from public.reuniones r
   where r.solicitud_id = p_solicitud and r.estado = 'confirmada' and (p_reunion is null or r.id = p_reunion)
     for update;
  if v_r.id is null then
    perform public._fallar('E8');
  end if;
  return v_r;
end;
$$;

-- C13: mueve la reunión a `p_h` con el anfitrión actual primero (se mantiene si está libre) y, si no, el reparto (R2.3); con
-- `p_limitar_a`, sólo esa persona. Copia el Meet del anfitrión (B13), sube la secuencia del .ics (§5.8) y, si cambió el anfitrión,
-- la solicitud pasa a él (auditoría `asignacion`).
create function public._mover_reunion(p_r public.reuniones, p_h timestamptz, p_limitar_a uuid, p_esperado timestamptz)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_anfitrion uuid;
  v_cambia boolean;
begin
  if p_r.actualizado_en <> p_esperado then
    perform public._fallar('E7');
  end if;
  if p_h is null or not public._hora_ofrecible(p_h) then
    perform public._fallar('E1');
  end if;
  foreach v_anfitrion in array public._orden_reunion(p_h, public._candidatos_reunion(p_h, p_limitar_a, p_r.id), p_r.anfitrion_id,
      p_r.id) loop
    begin
      update public.reuniones r
         set inicio = p_h, fin = p_h + make_interval(mins => c.duracion_min), anfitrion_id = v_anfitrion,
             enlace_meet = p.enlace_meet, secuencia_ics = r.secuencia_ics + 1
        from public.perfiles p, public.config_agenda c
       where p.id = v_anfitrion and c.id = 1 and r.id = p_r.id;
      exit;
    exception when exclusion_violation then
      -- C11: chocó con la exclusión de la tabla: el siguiente del orden.
      v_anfitrion := null;
    end;
  end loop;
  if v_anfitrion is null then
    perform public._fallar('E1');
  end if;
  v_cambia := v_anfitrion <> p_r.anfitrion_id;
  if v_cambia then
    update public.solicitudes set asignado_a = v_anfitrion where id = p_r.solicitud_id;
  end if;
  return public._resumen_reunion(p_r.id, case when v_cambia then p_r.anfitrion_id end);
end;
$$;

-- C20: cancelar es volver la solicitud a `nueva`; la máquina de estados lo valida y cancela la reunión (C16, C17).
create function public._cancelar_reunion(p_r public.reuniones, p_esperado timestamptz)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  if p_r.actualizado_en <> p_esperado then
    perform public._fallar('E7');
  end if;
  update public.solicitudes set estado = 'nueva' where id = p_r.solicitud_id;
  return public._resumen_reunion(p_r.id, null);
end;
$$;

-- C14: la reunión del visitante por su token (siempre E4 si no existe: misma respuesta), bloqueada y dentro del plazo de B15
-- (hasta `inicio − cancelar_hasta_horas`, el borde incluido).
create function public._reunion_del_token(p_token_hash bytea, p_esperado timestamptz)
returns public.reuniones
language plpgsql
set search_path = ''
as $$
declare
  v_solicitud uuid;
  v_r public.reuniones;
  v_tarde boolean;
begin
  if p_esperado is null then
    raise exception 'Falta la versión de la reunión.' using errcode = '22023', hint = 'p_actualizado_en_esperado';
  end if;
  select r.solicitud_id into v_solicitud from public.reuniones r where r.token_hash = p_token_hash;
  if v_solicitud is null then
    perform public._fallar('E4');
  end if;
  v_r := public._bloquear_vigente(v_solicitud, null);
  v_tarde := now() > v_r.inicio - make_interval(hours => (select c.cancelar_hasta_horas from public.config_agenda c where c.id = 1));
  if v_tarde then
    perform public._fallar('E6');
  end if;
  return v_r;
end;
$$;

-- C15: la reunión que el panel quiere tocar, si quien llama tiene `reuniones.cambiar` sobre su anfitrión (si no, o si no existe,
-- E9), bloqueada.
create function public._reunion_del_panel(p_reunion_id uuid, p_esperado timestamptz)
returns public.reuniones
language plpgsql
set search_path = ''
as $$
declare
  v_r public.reuniones;
  v_puede boolean;
begin
  if p_esperado is null then
    raise exception 'Falta la versión de la reunión.' using errcode = '22023', hint = 'p_actualizado_en_esperado';
  end if;
  select * into v_r from public.reuniones r where r.id = p_reunion_id;
  v_puede := v_r.id is not null and ((select public.tiene_permiso('reuniones.cambiar'))
    or v_r.anfitrion_id = any ((select public.ids_con_alcance('reuniones.cambiar'))::uuid[]));
  if not v_puede then
    perform public._fallar('E9');
  end if;
  return public._bloquear_vigente(v_r.solicitud_id, v_r.id);
end;
$$;

-- C14: por el enlace del visitante. Cambiar respeta la prospección (R4.20) con C6.
create function public.cambiar_reunion(p_token_hash bytea, p_inicio timestamptz, p_actualizado_en_esperado timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.reuniones;
begin
  perform public._bloquear_agenda();
  v_r := public._reunion_del_token(p_token_hash, p_actualizado_en_esperado);
  return public._mover_reunion(v_r, p_inicio, public._limitar_a(v_r.solicitud_id), p_actualizado_en_esperado);
end;
$$;

create function public.cancelar_reunion(p_token_hash bytea, p_actualizado_en_esperado timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.reuniones;
begin
  v_r := public._reunion_del_token(p_token_hash, p_actualizado_en_esperado);
  return public._cancelar_reunion(v_r, p_actualizado_en_esperado);
end;
$$;

-- C15: desde el panel. Reagendar sólo en las horas del anfitrión actual (§5.5 l. 495), con su turno y la ventana de C2 (P5).
create function public.cambiar_reunion_panel(p_reunion_id uuid, p_inicio timestamptz, p_actualizado_en_esperado timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.reuniones;
begin
  perform public._bloquear_agenda();
  v_r := public._reunion_del_panel(p_reunion_id, p_actualizado_en_esperado);
  return public._mover_reunion(v_r, p_inicio, v_r.anfitrion_id, p_actualizado_en_esperado);
end;
$$;

create function public.cancelar_reunion_panel(p_reunion_id uuid, p_actualizado_en_esperado timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.reuniones;
begin
  v_r := public._reunion_del_panel(p_reunion_id, p_actualizado_en_esperado);
  return public._cancelar_reunion(v_r, p_actualizado_en_esperado);
end;
$$;

revoke all on function public._bloquear_vigente(uuid, uuid), public._mover_reunion(public.reuniones, timestamptz, uuid, timestamptz),
  public._cancelar_reunion(public.reuniones, timestamptz), public._reunion_del_token(bytea, timestamptz),
  public._reunion_del_panel(uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.cambiar_reunion(bytea, timestamptz, timestamptz), public.cancelar_reunion(bytea, timestamptz)
  from public, anon, authenticated;
grant execute on function public.cambiar_reunion(bytea, timestamptz, timestamptz), public.cancelar_reunion(bytea, timestamptz)
  to service_role;
-- Sin sesión no hay a quién atribuir el cambio: las del panel, sólo `authenticated`.
revoke all on function public.cambiar_reunion_panel(uuid, timestamptz, timestamptz), public.cancelar_reunion_panel(uuid, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.cambiar_reunion_panel(uuid, timestamptz, timestamptz),
  public.cancelar_reunion_panel(uuid, timestamptz) to authenticated;

-- C21: la clave nace con su punto de aplicación (las dos funciones del panel). §2 l. 77: el vendedor, sus reuniones; el admin, todas.
insert into public.permisos (clave, descripcion) values ('reuniones.cambiar', 'Cambiar y cancelar reuniones.')
on conflict (clave) do update set descripcion = excluded.descripcion;
insert into public.permisos_rol (rol, clave, alcance) values
  ('vendedor', 'reuniones.cambiar', 'propio'),
  ('admin', 'reuniones.cambiar', 'todos')
on conflict (rol, clave) do update set alcance = excluded.alcance;
