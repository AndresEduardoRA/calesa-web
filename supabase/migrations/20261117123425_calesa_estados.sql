-- Calesa · la máquina de estados de la solicitud (semilla §5.7, R4.7) y la auditoría de solicitudes y reuniones (paso P05, C16–C19).
-- Un trigger valida cada cambio de `solicitudes.estado` (para cualquier rol) y mueve `ultimo_contacto_en` (C2); otro lleva el efecto a
-- la reunión confirmada; `cambiar_estado_solicitud` es la entrada del panel (fila 9 de §4). La tabla de transiciones repite la de
-- `src/modules/solicitudes/entities/estados.ts`: si cambia una, cambia la otra.

-- Los errores de las RPC de P05 (la tabla E del plan), con los textos de docs/UX.md. P0001 = una regla; PT409 = conflicto de edición;
-- 42501 = sin permiso sobre esa fila.
create function public._fallar(p_e text)
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
  end case;
end;
$$;

-- §5.7: quién puede hacer cada cambio, qué le pasa a la reunión confirmada y si sólo vale después de su inicio. Sin fila = prohibido.
-- `null → nueva` (la creación) no está: el insert lo cuida la RPC de creación (P30).
create function public._transicion(p_desde public.estado_solicitud, p_hacia public.estado_solicitud)
returns table (actores text[], efecto public.estado_reunion, solo_despues_del_inicio boolean)
language sql
immutable
set search_path = ''
as $$
  select t.actores, t.efecto::public.estado_reunion, t.solo
    from (values
      ('nueva', 'agendada', array['servidor'], 'confirmada', false),
      ('agendada', 'nueva', array['servidor'], 'cancelada', false),
      ('agendada', 'realizada', array['vendedor', 'admin'], 'realizada', true),
      ('agendada', 'no_asistio', array['vendedor', 'admin'], 'no_asistio', true),
      ('realizada', 'ganada', array['vendedor', 'admin'], null, false),
      ('realizada', 'descartada', array['vendedor', 'admin'], null, false),
      ('nueva', 'descartada', array['vendedor', 'admin'], null, false),
      ('no_asistio', 'descartada', array['vendedor', 'admin'], null, false),
      ('descartada', 'nueva', array['admin'], null, false)
    ) t (desde, hacia, actores, efecto, solo)
   where t.desde::public.estado_solicitud = p_desde and t.hacia::public.estado_solicitud = p_hacia
$$;

-- C16: la transición existe; a `agendada` o «sólo después del inicio», con su reunión confirmada (y ya empezada, I8); y el último
-- contacto pasa a ahora. Para cualquier rol, también `service_role` directo. De definidor: lee reuniones.
create function public._validar_estado_solicitud()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_regla record;
  v_inicio timestamptz;
  v_hay_reunion boolean;
  v_falta_reunion boolean;
begin
  if new.estado = old.estado then
    return new;
  end if;
  select * into v_regla from public._transicion(old.estado, new.estado);
  if not found then
    perform public._fallar('E2');
  end if;
  -- reuniones_una_confirmada (solicitud_id) where confirmada
  select r.inicio into v_inicio from public.reuniones r where r.solicitud_id = new.id and r.estado = 'confirmada';
  v_hay_reunion := found;
  v_falta_reunion := (new.estado = 'agendada' or v_regla.solo_despues_del_inicio) and not v_hay_reunion;
  if v_falta_reunion or (v_regla.solo_despues_del_inicio and now() < v_inicio) then
    perform public._fallar('E2');
  end if;
  new.ultimo_contacto_en := now();
  return new;
end;
$$;

-- C17: el único camino que cambia `reuniones.estado` fuera de la reserva (R4.7).
create function public._efecto_en_reunion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_efecto public.estado_reunion;
begin
  select t.efecto into v_efecto from public._transicion(old.estado, new.estado) t;
  if v_efecto in ('cancelada', 'realizada', 'no_asistio') then
    update public.reuniones
       set estado = v_efecto,
           cancelada_en = case when v_efecto = 'cancelada' then now() else cancelada_en end
     where solicitud_id = new.id and estado = 'confirmada';
  end if;
  return null;
end;
$$;

-- C19: quién cambió qué (null = el visitante o el sistema). Nunca datos de contacto.
create function public._auditar_solicitud()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.estado is distinct from old.estado then
    insert into public.auditoria (actor_id, accion, tabla, registro_id, antes, despues)
    values ((select auth.uid()), 'estado', 'solicitudes', new.id, jsonb_build_object('estado', old.estado),
      jsonb_build_object('estado', new.estado));
  end if;
  if new.asignado_a is distinct from old.asignado_a then
    insert into public.auditoria (actor_id, accion, tabla, registro_id, antes, despues)
    values ((select auth.uid()), 'asignacion', 'solicitudes', new.id, jsonb_build_object('asignado_a', old.asignado_a),
      jsonb_build_object('asignado_a', new.asignado_a));
  end if;
  return null;
end;
$$;

create function public._auditar_reunion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.inicio is distinct from old.inicio or new.anfitrion_id is distinct from old.anfitrion_id then
    insert into public.auditoria (actor_id, accion, tabla, registro_id, antes, despues)
    values ((select auth.uid()), 'reagenda', 'reuniones', new.id,
      jsonb_build_object('inicio', old.inicio, 'fin', old.fin, 'anfitrion_id', old.anfitrion_id),
      jsonb_build_object('inicio', new.inicio, 'fin', new.fin, 'anfitrion_id', new.anfitrion_id));
  end if;
  if new.estado = 'cancelada' and old.estado <> 'cancelada' then
    insert into public.auditoria (actor_id, accion, tabla, registro_id, antes, despues)
    values ((select auth.uid()), 'cancelacion', 'reuniones', new.id, jsonb_build_object('estado', old.estado),
      jsonb_build_object('estado', new.estado));
  end if;
  return null;
end;
$$;

create trigger estados_validar before update of estado on public.solicitudes
  for each row execute function public._validar_estado_solicitud();
create trigger estados_efecto_en_reunion after update of estado on public.solicitudes
  for each row execute function public._efecto_en_reunion();
create trigger auditar after update on public.solicitudes
  for each row execute function public._auditar_solicitud();
create trigger auditar after update on public.reuniones
  for each row execute function public._auditar_reunion();

-- C18: el panel cambia el estado de una solicitud que puede tocar con `solicitudes.estado`. El actor sale del alcance (`todos` =
-- admin, `propio` = vendedor), nunca del rol; la transición tiene que admitir a ese actor (el panel no hace las del servidor).
create function public.cambiar_estado_solicitud(p_solicitud_id uuid, p_estado public.estado_solicitud,
  p_actualizado_en_esperado timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_todos boolean := (select public.tiene_permiso('solicitudes.estado'));
  v_s public.solicitudes;
  v_regla record;
  v_puede boolean;
begin
  if p_actualizado_en_esperado is null then
    raise exception 'Falta la versión de la solicitud.' using errcode = '22023', hint = 'p_actualizado_en_esperado';
  end if;
  select * into v_s from public.solicitudes s where s.id = p_solicitud_id for update;
  v_puede := found and (v_todos or v_s.asignado_a = any ((select public.ids_con_alcance('solicitudes.estado'))::uuid[]));
  if not v_puede then
    perform public._fallar('E10');
  end if;
  if v_s.actualizado_en <> p_actualizado_en_esperado then
    perform public._fallar('E7');
  end if;
  select * into v_regla from public._transicion(v_s.estado, p_estado);
  if not found or not (case when v_todos then 'admin' else 'vendedor' end = any (v_regla.actores)) then
    perform public._fallar('E2');
  end if;
  update public.solicitudes set estado = p_estado where id = p_solicitud_id returning * into v_s;
  return jsonb_build_object('id', v_s.id, 'estado', v_s.estado, 'actualizadoEn', v_s.actualizado_en);
end;
$$;

revoke all on function public._fallar(text), public._transicion(public.estado_solicitud, public.estado_solicitud),
  public._validar_estado_solicitud(), public._efecto_en_reunion(), public._auditar_solicitud(), public._auditar_reunion()
  from public, anon, authenticated;
-- Sin sesión no hay a quién atribuir el cambio: sólo `authenticated`.
revoke all on function public.cambiar_estado_solicitud(uuid, public.estado_solicitud, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.cambiar_estado_solicitud(uuid, public.estado_solicitud, timestamptz) to authenticated;

-- La clave decide ahora también los cambios de estado (la descripción de P02 hablaba sólo del último contacto).
insert into public.permisos (clave, descripcion) values
  ('solicitudes.estado', 'Cambiar el estado de una solicitud y registrar el último contacto.')
on conflict (clave) do update set descripcion = excluded.descripcion;
