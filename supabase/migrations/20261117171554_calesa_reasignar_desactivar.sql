-- Calesa · traspasar solicitudes entre personas del panel (semilla §5.6 l. 514-515, R3.3, R4.2, R4.3, R4.8; paso P30, C1, C8–C11,
-- C15): reasignar una solicitud con su demo y desactivar a una persona repartiendo lo suyo. Son acciones del admin desde el panel:
-- sólo `authenticated`, con su clave (`solicitudes.reasignar`, `usuarios.gestionar`) y el actor en la auditoría (P1a, como P05/P1).
-- Se aparta a propósito de §4 l. 360, que las dejaba a `service_role` (docs/pasos/P30/decisiones.md).

-- C1: los errores de P05 (E1–E10, iguales) y los de P30.
create or replace function public._fallar(p_e text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  case p_e
    when 'E1' then raise exception 'Esa hora se acaba de ocupar. Elige otra.';
    when 'E2' then raise exception 'Ese cambio de estado no está permitido.';
    when 'E3' then raise exception 'Esta solicitud ya tiene una demo reservada.';
    when 'E4' then raise exception 'Este enlace no es válido.';
    when 'E5' then raise exception 'El enlace venció. Vuelve a llenar el formulario.';
    when 'E6' then raise exception 'Ya no se puede cambiar en línea. Escríbenos por WhatsApp.';
    when 'E7' then
      raise exception 'Esta demo o solicitud cambió mientras la mirabas. Recarga para ver lo último.' using errcode = 'PT409';
    when 'E8' then raise exception 'Esta demo ya no está confirmada.';
    when 'E9' then raise exception 'No puedes cambiar esta reunión.' using errcode = '42501';
    when 'E10' then raise exception 'Esta solicitud no está asignada a ti.' using errcode = '42501';
    when 'E11' then raise exception 'No tienes permiso para hacer esto.' using errcode = '42501';
    when 'E12' then raise exception 'Esa persona no está libre a esa hora. Reagenda primero.';
    when 'E13' then raise exception 'Carga tu enlace de Meet antes de desactivar a esta persona.';
    when 'E14' then
      raise exception 'Hay una demo que nadie puede tomar. Reagéndala, cancélala o márcala antes de desactivar a esta persona.';
    when 'E15' then raise exception 'Esa persona no está activa.';
    when 'E16' then raise exception 'Esta persona cambió mientras la mirabas. Recarga para ver lo último.' using errcode = 'PT409';
    when 'E17' then raise exception 'Carga tu WhatsApp antes de desactivar a esta persona.';
  end case;
end;
$$;

-- C8: pasa la demo al primero de `p_orden` que entra (copia su Meet y sube la secuencia del .ics); si choca con la exclusión de la
-- tabla, el siguiente. La solicitud va con ella (R4.8). Null si no entra nadie, sin cambiar nada.
create function public._pasar_reunion(p_r public.reuniones, p_orden uuid[])
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_x uuid;
begin
  foreach v_x in array coalesce(p_orden, '{}') loop
    begin
      update public.reuniones r
         set anfitrion_id = v_x, enlace_meet = p.enlace_meet, secuencia_ics = r.secuencia_ics + 1
        from public.perfiles p
       where p.id = v_x and r.id = p_r.id;
      update public.solicitudes set asignado_a = v_x where id = p_r.solicitud_id;
      return v_x;
    exception when exclusion_violation then
      null;
    end;
  end loop;
  return null;
end;
$$;

-- C9 (R4.2): con su demo confirmada (haya empezado o no), sólo si el destino está libre a esa hora sin contar el turno; si no, E12.
-- La reunión se busca con su propio bloqueo, ya con la solicitud bloqueada: sin demo no es un error (no `_bloquear_vigente`).
create function public.reasignar_solicitud(p_solicitud_id uuid, p_asignar_a uuid, p_actualizado_en_esperado timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.solicitudes;
  v_r public.reuniones;
begin
  if p_solicitud_id is null then
    raise exception 'Falta la solicitud.' using errcode = '22023', hint = 'p_solicitud_id';
  end if;
  if p_asignar_a is null then
    raise exception 'Falta a quién asignarla.' using errcode = '22023', hint = 'p_asignar_a';
  end if;
  if p_actualizado_en_esperado is null then
    raise exception 'Falta la versión de la solicitud.' using errcode = '22023', hint = 'p_actualizado_en_esperado';
  end if;
  if not (select public.tiene_permiso('solicitudes.reasignar')) then
    perform public._fallar('E11');
  end if;
  perform public._bloquear_agenda();
  select * into v_s from public.solicitudes s where s.id = p_solicitud_id for update;
  if v_s.id is null or v_s.actualizado_en <> p_actualizado_en_esperado then
    perform public._fallar('E7');
  end if;
  if not exists (select 1 from public.perfiles p where p.id = p_asignar_a and p.activo) then
    perform public._fallar('E15');
  end if;
  if v_s.asignado_a is distinct from p_asignar_a then
    -- reuniones_una_confirmada (solicitud_id) where confirmada
    select * into v_r from public.reuniones r where r.solicitud_id = v_s.id and r.estado = 'confirmada' for update;
    if v_r.id is null then
      update public.solicitudes set asignado_a = p_asignar_a where id = v_s.id;
    else
      if not public._es_elegible(p_asignar_a, v_r.inicio, v_r.id, false) then
        perform public._fallar('E12');
      end if;
      if public._pasar_reunion(v_r, array[p_asignar_a]) is null then
        perform public._fallar('E12');
      end if;
    end if;
  end if;
  return jsonb_build_object(
    'solicitud', (select jsonb_build_object('id', s.id, 'asignadoA', s.asignado_a, 'actualizadoEn', s.actualizado_en)
                    from public.solicitudes s where s.id = v_s.id),
    'reunion', case when v_r.id is not null then public._resumen_reunion(v_r.id, v_r.anfitrion_id) end);
end;
$$;

-- C10: quién activó o desactivó a quién (P31 le suma `rol` con `create or replace`).
create function public._auditar_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.activo is distinct from old.activo then
    insert into public.auditoria (actor_id, accion, tabla, registro_id, antes, despues)
    values ((select auth.uid()), 'activo', 'perfiles', new.id, jsonb_build_object('activo', old.activo),
      jsonb_build_object('activo', new.activo));
  end if;
  return null;
end;
$$;

create trigger auditar after update of activo on public.perfiles
  for each row execute function public._auditar_perfil();

-- C11 paso 5 (R3.3, R4.3, P4a, P5a): sus demos confirmadas, listadas bajo el candado de agenda y releídas con su bloqueo (solicitud →
-- reunión, como cancelar). Una futura va al reparto de reuniones; si nadie entra, al respaldo (el admin que desactiva) sin contar su
-- turno; si tampoco, E14. Una ya empezada sin marcar pasa al respaldo tal cual (sin Meet nuevo ni correo). La que ya no está
-- confirmada se salta. Devuelve el resumen de las futuras. P34 lo reutiliza para la pausa.
create function public._repartir_reuniones(p_perfil uuid, p_respaldo uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_r public.reuniones;
  v_futuras uuid[] := '{}'::uuid[];
begin
  -- reuniones_anfitrion (anfitrion_id, inicio)
  for v_id in select r.id from public.reuniones r where r.anfitrion_id = p_perfil and r.estado = 'confirmada' order by r.inicio, r.id
  loop
    perform 1 from public.solicitudes s where s.id = (select r.solicitud_id from public.reuniones r where r.id = v_id) for update;
    select * into v_r from public.reuniones r
     where r.id = v_id and r.estado = 'confirmada' and r.anfitrion_id = p_perfil for update;
    continue when v_r.id is null;
    if v_r.inicio > now() then
      if public._pasar_reunion(v_r, public._orden_reunion(v_r.inicio,
           public._candidatos_reunion(v_r.inicio, public._limitar_a(v_r.solicitud_id), v_r.id), null, v_r.id)) is null then
        if not public._es_elegible(p_respaldo, v_r.inicio, v_r.id, false) then
          perform public._fallar('E14');
        end if;
        if public._pasar_reunion(v_r, array[p_respaldo]) is null then
          perform public._fallar('E14');
        end if;
      end if;
      v_futuras := v_futuras || v_r.id;
    else
      begin
        update public.reuniones set anfitrion_id = p_respaldo where id = v_r.id;
      exception when exclusion_violation then
        perform public._fallar('E14');
      end;
      update public.solicitudes set asignado_a = p_respaldo where id = v_r.solicitud_id;
    end if;
  end loop;
  return coalesce((select jsonb_agg(public._resumen_reunion(f.id, p_perfil) order by f.i)
                     from unnest(v_futuras) with ordinality f (id, i)), '[]'::jsonb);
end;
$$;

-- C11 paso 6 (C3): reparte sus `nueva`. Primero calcula todos los receptores con nada escrito (cada uno que recibe suma 1 para la
-- siguiente) y después escribe: así nada se cuenta dos veces. Devuelve `[{id, asignadoA}]` (null = sin nadie en turno).
create function public._repartir_solicitudes(p_perfil uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_x uuid;
  v_extra jsonb := '{}'::jsonb;
  v_plan jsonb := '[]'::jsonb;
begin
  -- solicitudes_asignado (asignado_a, creado_en desc, id desc)
  for v_id in select s.id from public.solicitudes s where s.asignado_a = p_perfil and s.estado = 'nueva' order by s.creado_en, s.id
  loop
    v_x := public._elegir_asignado(v_extra);
    v_plan := v_plan || jsonb_build_array(jsonb_build_object('id', v_id, 'asignadoA', v_x));
    if v_x is not null then
      v_extra := v_extra || jsonb_build_object(v_x::text, coalesce((v_extra ->> v_x::text)::int, 0) + 1);
    end if;
  end loop;
  update public.solicitudes s set asignado_a = (e.value ->> 'asignadoA')::uuid
    from jsonb_array_elements(v_plan) e
   where s.id = (e.value ->> 'id')::uuid;
  return v_plan;
end;
$$;

-- C11 (R3.3, R4.3): desactiva a otra persona del panel y reparte lo suyo. Quien desactiva es el respaldo de las demos: necesita su Meet
-- (§5.6 l. 515) y su WhatsApp, que el visitante recibe (P5a). El perfil va `for no key update`: no choca con el KEY SHARE que toman
-- las FK de notas o bloqueos al insertar.
create function public.desactivar_usuario(p_perfil_id uuid, p_actualizado_en_esperado timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_yo uuid := (select auth.uid());
  v_p public.perfiles;
  v_reuniones jsonb;
  v_solicitudes jsonb;
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
  if not exists (select 1 from public.perfiles p where p.id = v_yo and coalesce(p.enlace_meet, '') <> '') then
    perform public._fallar('E13');
  end if;
  if not exists (select 1 from public.perfiles p where p.id = v_yo and coalesce(p.whatsapp, '') <> '') then
    perform public._fallar('E17');
  end if;
  perform public._bloquear_agenda();
  perform public._bloquear_solicitudes();
  select * into v_p from public.perfiles p where p.id = p_perfil_id for no key update;
  if v_p.id is null or not v_p.activo then
    perform public._fallar('E15');
  end if;
  if v_p.actualizado_en <> p_actualizado_en_esperado then
    perform public._fallar('E16');
  end if;
  -- Desactivarse a sí mismo lo rechaza el trigger de columnas protegidas, antes de mover nada.
  update public.perfiles set activo = false, en_turno = false where id = p_perfil_id returning * into v_p;
  v_reuniones := public._repartir_reuniones(p_perfil_id, v_yo);
  v_solicitudes := public._repartir_solicitudes(p_perfil_id);
  return jsonb_build_object('perfil', jsonb_build_object('id', v_p.id, 'activo', v_p.activo, 'enTurno', v_p.en_turno,
      'actualizadoEn', v_p.actualizado_en), 'reuniones', v_reuniones, 'solicitudes', v_solicitudes);
end;
$$;

-- C15: las del panel, sólo `authenticated` (sin sesión no hay a quién atribuir el cambio); los ayudantes, nadie.
revoke all on function public._fallar(text), public._pasar_reunion(public.reuniones, uuid[]), public._auditar_perfil(),
  public._repartir_reuniones(uuid, uuid), public._repartir_solicitudes(uuid)
  from public, anon, authenticated;
revoke all on function public.reasignar_solicitud(uuid, uuid, timestamptz), public.desactivar_usuario(uuid, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.reasignar_solicitud(uuid, uuid, timestamptz), public.desactivar_usuario(uuid, timestamptz)
  to authenticated;

-- La clave nace con su punto de aplicación (§2: sólo el admin, todas). Desactivar va con `usuarios.gestionar`.
insert into public.permisos (clave, descripcion) values
  ('solicitudes.reasignar', 'Reasignar una solicitud y su demo a otra persona.'),
  ('usuarios.gestionar', 'Ver, invitar y desactivar a las personas del panel.')
on conflict (clave) do update set descripcion = excluded.descripcion;
insert into public.permisos_rol (rol, clave, alcance) values ('admin', 'solicitudes.reasignar', 'todos')
on conflict (rol, clave) do update set alcance = excluded.alcance;
