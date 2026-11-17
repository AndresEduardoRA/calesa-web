-- Calesa · quién entra al panel y con qué rol (semilla X12, R4.12, R4.14, F5, §9.7 l. 943; paso P34, C5–C8, C10). El invitado nace
-- vendedor al aceptar, no al invitar (P1a: se aparta de R4.14 a lo más estricto); el nombre lo escribe el admin en la invitación (P2a).
-- `asignar_rol` es la RPC de `pnpm admin:crear` (P14): sólo `service_role`, sin vía de panel (P4a). X12 queda en la base: un solo perfil
-- admin, contando los inactivos (docs/pasos/P34/decisiones.md).

-- C7: el nombre de la invitación. Se agrega, se rellena por si la nube tuviera filas y recién después pasa a not null.
alter table public.invitaciones add column nombre text;
update public.invitaciones set nombre = 'Persona invitada' where nombre is null;
alter table public.invitaciones alter column nombre set not null,
  add constraint invitaciones_nombre_check check (char_length(nombre) between 2 and 80);
grant insert (nombre) on public.invitaciones to authenticated;

-- C6.8 (X12): ninguna vía deja dos perfiles admin, ni postgres ni `service_role`. Cuenta los inactivos: reactivar nunca despierta a
-- un segundo admin.
create unique index perfiles_un_admin on public.perfiles ((true)) where rol = 'admin';

-- El perfil que devuelven las tres.
create function public._perfil_json(p_p public.perfiles)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object('id', p_p.id, 'nombre', p_p.nombre, 'email', p_p.email::text, 'rol', p_p.rol, 'activo', p_p.activo,
    'enTurno', p_p.en_turno, 'actualizadoEn', p_p.actualizado_en)
$$;

-- C5 (P7a): vuelve activa y fuera de turno (desactivar ya la dejó así); el admin la pone en turno aparte. El trigger `auditar` deja la
-- fila `activo` con su actor. No mira X12: nunca hay más de un perfil admin (el índice de arriba).
create function public.reactivar_usuario(p_perfil_id uuid, p_actualizado_en_esperado timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.perfiles;
begin
  if p_perfil_id is null then
    raise exception 'Falta la persona.' using errcode = '22023', hint = 'p_perfil_id';
  end if;
  if p_actualizado_en_esperado is null then
    raise exception 'Falta la versión de la persona.' using errcode = '22023', hint = 'p_actualizado_en_esperado';
  end if;
  if not (select public.tiene_permiso('usuarios.gestionar')) then
    perform public._fallar('E11');
  end if;
  select * into v_p from public.perfiles p where p.id = p_perfil_id for no key update;
  if v_p.id is null then
    raise exception 'Esa persona no existe.' using errcode = '22023', hint = 'p_perfil_id';
  end if;
  if v_p.actualizado_en <> p_actualizado_en_esperado then
    perform public._fallar('E16');
  end if;
  if not v_p.activo then
    update public.perfiles set activo = true where id = p_perfil_id returning * into v_p;
  end if;
  return jsonb_build_object('perfil', jsonb_build_object('id', v_p.id, 'activo', v_p.activo, 'enTurno', v_p.en_turno,
    'actualizadoEn', v_p.actualizado_en));
end;
$$;

-- C6 (P4a, X12, §9.7): crea el perfil del usuario de Auth o le fija el rol, en serie bajo su propio candado. Un segundo admin, E24
-- (también si el otro está inactivo); bajar al único, E25; un vendedor sin perfil entra por invitación. Con el rol que ya tiene (y
-- activo, si es admin) no escribe. En el alta escribe a mano su fila `rol` (el trigger es de update); en el cambio, el trigger. Se aparta
-- de migraciones.md («toda RPC de edición nace con p_actualizado_en_esperado»): fija un valor absoluto, es idempotente y la llama un
-- script, no una pantalla que leyó una versión.
create function public.asignar_rol(p_usuario_id uuid, p_rol public.rol_usuario, p_nombre text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_p public.perfiles;
  v_cambio boolean := false;
  v_restriccion text;
begin
  if p_usuario_id is null then
    raise exception 'Falta el usuario.' using errcode = '22023', hint = 'p_usuario_id';
  end if;
  if p_rol is null then
    raise exception 'Falta el rol.' using errcode = '22023', hint = 'p_rol';
  end if;
  perform pg_advisory_xact_lock(hashtext('calesa:roles'));
  select u.email into v_email from auth.users u where u.id = p_usuario_id;
  if not found then
    raise exception 'Ese usuario no existe.' using errcode = '22023', hint = 'p_usuario_id';
  end if;
  select * into v_p from public.perfiles p where p.id = p_usuario_id for no key update;
  if p_rol = 'admin' then
    if exists (select 1 from public.perfiles p where p.rol = 'admin' and p.id <> p_usuario_id) then
      perform public._fallar('E24');
    end if;
    if v_p.id is null then
      if p_nombre is null then
        raise exception 'Falta el nombre.' using errcode = '22023', hint = 'p_nombre';
      end if;
      begin
        insert into public.perfiles (id, nombre, email, rol, activo, en_turno)
        values (p_usuario_id, p_nombre, v_email, 'admin', true, false)
        returning * into v_p;
      exception
        when check_violation then
          get stacked diagnostics v_restriccion = constraint_name;
          raise exception 'Los datos del administrador no son válidos.' using errcode = '22023', hint = v_restriccion;
        when unique_violation then
          get stacked diagnostics v_restriccion = constraint_name;
          if v_restriccion = 'perfiles_un_admin' then
            perform public._fallar('E24');
          elsif v_restriccion = 'perfiles_email_key' then
            raise exception 'Ese correo ya es de otra persona del panel.' using errcode = '22023', hint = 'email';
          end if;
          raise;
      end;
      insert into public.auditoria (actor_id, accion, tabla, registro_id, antes, despues)
      values ((select auth.uid()), 'rol', 'perfiles', p_usuario_id, '{"rol": null}', '{"rol": "admin"}');
      v_cambio := true;
    elsif v_p.rol <> 'admin' or not v_p.activo then
      begin
        update public.perfiles set rol = 'admin', activo = true where id = p_usuario_id returning * into v_p;
      exception when unique_violation then
        perform public._fallar('E24');
      end;
      v_cambio := true;
    end if;
  else
    if v_p.id is null then
      raise exception 'Un vendedor entra por invitación.' using errcode = '22023', hint = 'p_usuario_id';
    end if;
    if v_p.rol = 'admin' then
      perform public._fallar('E25');
    end if;
  end if;
  return jsonb_build_object('perfil', public._perfil_json(v_p), 'cambio', v_cambio);
end;
$$;

-- C8 (P1a, F5, X12): el invitado nace vendedor, activo y fuera de turno al aceptar una invitación pendiente y vigente para el correo de
-- su sesión (nadie elige el correo). Si ya tiene perfil lo devuelve sin mirar invitaciones: es idempotente y no reactiva a nadie. Vuelve
-- a mirar el perfil después de bloquear la invitación: la segunda de dos llamadas a la vez no da E23.
create function public.aceptar_invitacion()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_yo uuid := (select auth.uid());
  v_email text;
  v_p public.perfiles;
  v_i public.invitaciones;
begin
  if v_yo is null then
    perform public._fallar('E23');
  end if;
  select * into v_p from public.perfiles p where p.id = v_yo;
  if v_p.id is not null then
    return jsonb_build_object('perfil', public._perfil_json(v_p), 'nueva', false);
  end if;
  select u.email into v_email from auth.users u where u.id = v_yo;
  -- invitaciones_email_pendiente (email) where estado = 'pendiente'
  select * into v_i from public.invitaciones i
   where i.estado = 'pendiente' and i.email operator(extensions.=) v_email::extensions.citext
     for update;
  select * into v_p from public.perfiles p where p.id = v_yo;
  if v_p.id is not null then
    return jsonb_build_object('perfil', public._perfil_json(v_p), 'nueva', false);
  end if;
  if v_i.id is null or v_i.expira_en <= now() then
    perform public._fallar('E23');
  end if;
  begin
    insert into public.perfiles (id, nombre, email, rol, activo, en_turno)
    values (v_yo, v_i.nombre, v_i.email, 'vendedor', true, false)
    returning * into v_p;
  exception when unique_violation then
    perform public._fallar('E23');
  end;
  update public.invitaciones set estado = 'aceptada', aceptada_en = now() where id = v_i.id;
  return jsonb_build_object('perfil', public._perfil_json(v_p), 'nueva', true);
end;
$$;

-- C10: las del panel, sólo `authenticated`; la del script, sólo `service_role`; el ayudante, nadie del API.
revoke all on function public._perfil_json(public.perfiles) from public, anon, authenticated;
revoke all on function public.reactivar_usuario(uuid, timestamptz), public.aceptar_invitacion()
  from public, anon, authenticated, service_role;
grant execute on function public.reactivar_usuario(uuid, timestamptz), public.aceptar_invitacion() to authenticated;
revoke all on function public.asignar_rol(uuid, public.rol_usuario, text) from public, anon, authenticated, service_role;
grant execute on function public.asignar_rol(uuid, public.rol_usuario, text) to service_role;
