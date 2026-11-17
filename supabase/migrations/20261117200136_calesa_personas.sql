-- Calesa · el perfil de cada persona del panel (semilla R4.21, §3 l. 262 y 282, §4 fila 23; paso P31, C1–C6): `actualizar_meet` cambia
-- el Meet propio y lo lleva a las demos futuras confirmadas; el Meet deja de cambiarse con un `update` directo y el cambio de rol queda
-- en la auditoría. Es una acción de la persona desde `/panel/perfil`: sólo `authenticated`, sobre su propia fila (P1a, como P05/P1). Se
-- aparta a propósito de §4 l. 360, que la dejaba a `service_role` (docs/pasos/P31/decisiones.md).

-- Los errores de P05 y P30 (E1–E17, iguales) y los de P31.
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
  end case;
end;
$$;

-- C1–C3 (R4.21, P5a, P11a): el Meet se cambia, no se borra. Toma el candado de agenda antes que su perfil: la reserva copia el Meet
-- del perfil bajo ese candado, y sin él una reserva simultánea quedaría con el enlace viejo. El perfil va `for no key update` (no
-- choca con el KEY SHARE de las FK). Las demos `confirmada` de quien llama con `inicio` futuro cambian de enlace y suben la secuencia
-- del .ics (el calendario del visitante reemplaza el evento); devuelve su resumen para el correo `meet-cambiado` (P14). Con el mismo
-- enlace no escribe nada y devuelve `reuniones: []`.
create function public.actualizar_meet(p_enlace_meet text, p_actualizado_en_esperado timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_yo uuid := (select auth.uid());
  v_p public.perfiles;
  v_ids uuid[];
begin
  if p_enlace_meet is null or p_enlace_meet !~ '^https://(meet\.google\.com/|([a-z0-9-]+\.)*zoom\.us/)' then
    raise exception 'El enlace de Meet no es válido.' using errcode = '22023', hint = 'p_enlace_meet';
  end if;
  if p_actualizado_en_esperado is null then
    raise exception 'Falta la versión de tu perfil.' using errcode = '22023', hint = 'p_actualizado_en_esperado';
  end if;
  if not (select public.es_usuario_activo()) then
    perform public._fallar('E11');
  end if;
  perform public._bloquear_agenda();
  select * into v_p from public.perfiles p where p.id = v_yo for no key update;
  if v_p.actualizado_en <> p_actualizado_en_esperado then
    perform public._fallar('E19');
  end if;
  if v_p.enlace_meet is not distinct from p_enlace_meet then
    return jsonb_build_object('perfil', jsonb_build_object('id', v_p.id, 'enlaceMeet', v_p.enlace_meet,
      'actualizadoEn', v_p.actualizado_en), 'reuniones', '[]'::jsonb);
  end if;
  update public.perfiles set enlace_meet = p_enlace_meet where id = v_yo returning * into v_p;
  -- reuniones_anfitrion (anfitrion_id, inicio)
  with cambiadas as (
    update public.reuniones r
       set enlace_meet = p_enlace_meet, secuencia_ics = r.secuencia_ics + 1
     where r.anfitrion_id = v_yo and r.estado = 'confirmada' and r.inicio > now()
    returning r.id, r.inicio
  )
  select array_agg(c.id order by c.inicio, c.id) into v_ids from cambiadas c;
  -- El resumen va en otra sentencia: la del `update` no ve sus propios cambios.
  return jsonb_build_object('perfil', jsonb_build_object('id', v_p.id, 'enlaceMeet', v_p.enlace_meet,
      'actualizadoEn', v_p.actualizado_en),
    'reuniones', coalesce((select jsonb_agg(public._resumen_reunion(f.id, null) order by f.i)
                             from unnest(v_ids) with ordinality f (id, i)), '[]'::jsonb));
end;
$$;

-- C5 (P2a): el Meet sólo por `actualizar_meet` (si no, las demos futuras quedarían con el enlace viejo y sin aviso). Nombre y WhatsApp
-- siguen directos (fila 23). `_proteger_perfiles` no cambia: queda de red.
revoke update (enlace_meet) on public.perfiles from authenticated;

-- C6: quién activó, desactivó o cambió el rol de quién (el rol lo cambiará `asignar_rol`, P34).
create or replace function public._auditar_perfil()
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
  if new.rol is distinct from old.rol then
    insert into public.auditoria (actor_id, accion, tabla, registro_id, antes, despues)
    values ((select auth.uid()), 'rol', 'perfiles', new.id, jsonb_build_object('rol', old.rol), jsonb_build_object('rol', new.rol));
  end if;
  return null;
end;
$$;

drop trigger auditar on public.perfiles;
create trigger auditar after update of activo, rol on public.perfiles
  for each row execute function public._auditar_perfil();

-- C4: sólo `authenticated` (sin sesión no hay cuyo Meet cambiar); `_fallar` y `_auditar_perfil` conservan sus grants (create or replace).
revoke all on function public.actualizar_meet(text, timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.actualizar_meet(text, timestamptz) to authenticated;
