-- Calesa · poner en turno o pausar a una persona del panel (semilla R3.3, R4.9, §5.6 l. 512; paso P34, C1–C4, C10). `cambiar_en_turno`
-- es del panel (`/panel/usuarios`, P14): sólo `authenticated`, con `usuarios.gestionar`, sobre cualquier perfil activo (también el
-- propio: el admin se pone de respaldo, R4.9). Al pausar, sus demos futuras y sus `nueva` pasan al reparto parejo (R3.3) con el turno
-- exigido: el admin entra sólo si está en turno, porque la única excepción de R4.9 es desactivar (R4.3). Lo de su propio enlace de
-- prospección y lo ya empezado se quedan con la persona (P5a, docs/pasos/P34/decisiones.md).

-- C1: los errores de P05, P30 y P31 (E1–E19, iguales) y los de P34. E21–E25 los usan las dos migraciones siguientes: así `_fallar` se
-- recrea una sola vez.
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
    when 'E18' then
      raise exception 'Los datos de la calculadora cambiaron mientras los mirabas. Recarga para ver lo último.' using errcode = 'PT409';
    when 'E19' then raise exception 'Tu perfil cambió mientras lo mirabas. Recarga para ver lo último.' using errcode = 'PT409';
    when 'E20' then
      raise exception 'Hay una demo que nadie en turno puede tomar. Reagéndala, cancélala o pon a alguien en turno antes de pausar a esta persona.';
    when 'E21' then
      raise exception 'Las reglas de la agenda cambiaron mientras las mirabas. Recarga para ver lo último.' using errcode = 'PT409';
    when 'E22' then raise exception 'El horario cambió mientras lo mirabas. Recarga para ver lo último.' using errcode = 'PT409';
    when 'E23' then raise exception 'Tu invitación no es válida o venció. Pide otra al administrador.' using errcode = '42501';
    when 'E24' then raise exception 'Ya hay un administrador.';
    when 'E25' then raise exception 'El panel no puede quedarse sin administrador.';
    when 'E26' then raise exception 'Esa persona necesita WhatsApp y enlace de Meet para entrar al turno.';
  end case;
end;
$$;

-- C2: el reparto de las demos de una persona, de P30, con un modo pausa. Sin pausa (desactivar, R4.3) hace lo mismo que antes: las
-- futuras al reparto y, sin nadie, a `p_respaldo` aunque no esté en turno; las ya empezadas, a `p_respaldo`. En pausa (R3.3, R4.9) sólo
-- recorre las futuras, salta las de su propio enlace de prospección y no usa respaldo: sin candidato en turno, E20 y la llamada entera
-- se deshace.
create function public._repartir_reuniones(p_perfil uuid, p_respaldo uuid, p_pausa boolean)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_r public.reuniones;
  v_futuras uuid[] := '{}'::uuid[];
begin
  -- reuniones_anfitrion (anfitrion_id, inicio): en pausa, sólo desde ahora.
  for v_id in select r.id from public.reuniones r
               where r.anfitrion_id = p_perfil and r.estado = 'confirmada'
                 and r.inicio > case when p_pausa then now() else '-infinity'::timestamptz end
               order by r.inicio, r.id
  loop
    perform 1 from public.solicitudes s where s.id = (select r.solicitud_id from public.reuniones r where r.id = v_id) for update;
    select * into v_r from public.reuniones r
     where r.id = v_id and r.estado = 'confirmada' and r.anfitrion_id = p_perfil for update;
    continue when v_r.id is null;
    if p_pausa then
      continue when v_r.inicio <= now() or public._limitar_a(v_r.solicitud_id) = p_perfil;
      if public._pasar_reunion(v_r, public._orden_reunion(v_r.inicio,
           public._candidatos_reunion(v_r.inicio, public._limitar_a(v_r.solicitud_id), v_r.id), null, v_r.id)) is null then
        perform public._fallar('E20');
      end if;
      v_futuras := v_futuras || v_r.id;
    elsif v_r.inicio > now() then
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

-- La de P30 queda como envoltura: `desactivar_usuario` no cambia.
create or replace function public._repartir_reuniones(p_perfil uuid, p_respaldo uuid)
returns jsonb
language sql
set search_path = ''
as $$
  select public._repartir_reuniones(p_perfil, p_respaldo, false)
$$;

-- C3: el reparto de sus `nueva`, de P30 (todo calculado antes de escribir). En pausa salta las de su propio enlace de prospección. Sin
-- nadie en turno, `asignadoA` null (§5.6 l. 512).
create function public._repartir_solicitudes(p_perfil uuid, p_pausa boolean)
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
    continue when p_pausa and public._limitar_a(v_id) = p_perfil;
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

create or replace function public._repartir_solicitudes(p_perfil uuid)
returns jsonb
language sql
set search_path = ''
as $$
  select public._repartir_solicitudes(p_perfil, false)
$$;

-- C4: los candados en el orden de P30 (agenda, solicitudes, el perfil `for no key update`). Con el mismo valor no escribe. Para entrar
-- al turno hacen falta WhatsApp y Meet (E26, antes que el check de la tabla). Al pausar, quien pausa no hace de respaldo. No audita
-- (P6a): `auditoria.accion` no tiene turno.
create function public.cambiar_en_turno(p_perfil_id uuid, p_en_turno boolean, p_actualizado_en_esperado timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.perfiles;
  v_reuniones jsonb := '[]'::jsonb;
  v_solicitudes jsonb := '[]'::jsonb;
begin
  if p_perfil_id is null then
    raise exception 'Falta la persona.' using errcode = '22023', hint = 'p_perfil_id';
  end if;
  if p_en_turno is null then
    raise exception 'Falta el turno.' using errcode = '22023', hint = 'p_en_turno';
  end if;
  if p_actualizado_en_esperado is null then
    raise exception 'Falta la versión de la persona.' using errcode = '22023', hint = 'p_actualizado_en_esperado';
  end if;
  if not (select public.tiene_permiso('usuarios.gestionar')) then
    perform public._fallar('E11');
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
  if v_p.en_turno is distinct from p_en_turno then
    if p_en_turno and (coalesce(v_p.whatsapp, '') = '' or coalesce(v_p.enlace_meet, '') = '') then
      perform public._fallar('E26');
    end if;
    update public.perfiles set en_turno = p_en_turno where id = p_perfil_id returning * into v_p;
    if not p_en_turno then
      v_reuniones := public._repartir_reuniones(p_perfil_id, null, true);
      v_solicitudes := public._repartir_solicitudes(p_perfil_id, true);
    end if;
  end if;
  return jsonb_build_object('perfil', jsonb_build_object('id', v_p.id, 'enTurno', v_p.en_turno, 'actualizadoEn', v_p.actualizado_en),
    'reuniones', v_reuniones, 'solicitudes', v_solicitudes);
end;
$$;

-- C10: la del panel, sólo `authenticated` (sin sesión no hay a quién atribuir el cambio); los repartos, nadie del API. `_fallar` y las
-- envolturas conservan sus grants (create or replace).
revoke all on function public._repartir_reuniones(uuid, uuid, boolean), public._repartir_solicitudes(uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.cambiar_en_turno(uuid, boolean, timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.cambiar_en_turno(uuid, boolean, timestamptz) to authenticated;
