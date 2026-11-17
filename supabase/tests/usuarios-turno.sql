-- Poner en turno o pausar a una persona del panel (semilla R3.3, R4.9, §5.6 l. 512; paso P34, C1–C4, C10). Es del panel: sólo
-- `authenticated` con `usuarios.gestionar`. Al pausar, lo suyo va al reparto con el turno exigido: el admin entra sólo si está en turno
-- (R4.9; la excepción de R4.3 es sólo de desactivar). Las llamadas que miran la respuesta corren como postgres con A puesto en la sesión;
-- los grants y los errores, con `pruebas.caso` y `pruebas.error`. A = …01 (admin, sin contacto ni turno), V1 = …02 y V2 = …03 (en turno,
-- con contacto), V3 = …04 (inactivo); R1 = …21 (de V1, el 3 nov, ya empezada).

-- @test turno: poner en turno · con contacto entra; con el mismo valor no escribe ni reparte (C4)
begin;
do $$
declare
  v3 constant uuid := '00000000-0000-4000-8000-000000000004';
  v_antes timestamptz;
  r jsonb;
  r2 jsonb;
begin
  update public.perfiles set activo = true, whatsapp = '+59170000004', enlace_meet = 'https://meet.google.com/vvv-tres-ccc'
   where id = v3;
  v_antes := (select actualizado_en from public.perfiles where id = v3);
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
  r := public.cambiar_en_turno(v3, true, v_antes);
  if not pruebas.claves(r, array['perfil', 'reuniones', 'solicitudes'])
     or not pruebas.claves(r -> 'perfil', array['id', 'enTurno', 'actualizadoEn'])
     or r #>> '{perfil,enTurno}' <> 'true' or r -> 'reuniones' <> '[]' or r -> 'solicitudes' <> '[]'
     or not (select en_turno from public.perfiles where id = v3)
     or (r #>> '{perfil,actualizadoEn}')::timestamptz <= v_antes then
    raise exception 'V3 no quedó en turno con una versión nueva: %', r;
  end if;
  r2 := public.cambiar_en_turno(v3, true, (r #>> '{perfil,actualizadoEn}')::timestamptz);
  if r2 #>> '{perfil,actualizadoEn}' <> r #>> '{perfil,actualizadoEn}' or r2 -> 'reuniones' <> '[]' or r2 -> 'solicitudes' <> '[]' then
    raise exception 'con el mismo valor se escribió: %', r2;
  end if;
end $$;
rollback;

-- @test turno: pausar · la demo futura y la nueva al reparto; lo ya empezado y lo de su enlace de prospección se quedan (C2–C4, P5a)
begin;
do $$
declare
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  v2 constant uuid := '00000000-0000-4000-8000-000000000003';
  r1 constant uuid := '00000000-0000-4000-8000-000000000021';
  v_sf uuid := pruebas.solicitud(v1, 'agendada');
  v_rf uuid := pruebas.reunion(v_sf, v1, pruebas.hora(3, '09:00'));
  v_n uuid := pruebas.solicitud(v1);
  v_pn uuid;
  v_ps uuid;
  v_pr uuid;
  r jsonb;
begin
  insert into public.enlaces_prospeccion (codigo, creado_por) values ('CA-01', v1);
  v_pn := pruebas.solicitud(v1, 'nueva', 'prospeccion', 'CA-01');
  v_ps := pruebas.solicitud(v1, 'agendada', 'prospeccion', 'CA-01');
  v_pr := pruebas.reunion(v_ps, v1, pruebas.hora(4, '09:00'));
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
  r := public.cambiar_en_turno(v1, false, (select actualizado_en from public.perfiles where id = v1));
  perform set_config('request.jwt.claim.sub', '', true);
  if (select en_turno or not activo from public.perfiles where id = v1) or r #>> '{perfil,enTurno}' <> 'false' then
    raise exception 'V1 no quedó activa y fuera de turno: %', r;
  end if;
  if (select anfitrion_id from public.reuniones where id = v_rf) is distinct from v2
     or (select asignado_a from public.solicitudes where id = v_sf) is distinct from v2
     or jsonb_array_length(r -> 'reuniones') <> 1 or r #>> '{reuniones,0,reunion,id}' <> v_rf::text
     or r #>> '{reuniones,0,anfitrionAnterior,id}' <> v1::text then
    raise exception 'la demo futura no pasó a V2: %', r;
  end if;
  if (select asignado_a from public.solicitudes where id = v_n) is distinct from v2
     or r -> 'solicitudes' <> jsonb_build_array(jsonb_build_object('id', v_n, 'asignadoA', v2)) then
    raise exception 'la nueva no pasó a V2: %', r -> 'solicitudes';
  end if;
  if (select anfitrion_id from public.reuniones where id = r1) is distinct from v1 then
    raise exception 'la demo ya empezada cambió de anfitrión';
  end if;
  if (select asignado_a from public.solicitudes where id = v_pn) is distinct from v1
     or (select anfitrion_id from public.reuniones where id = v_pr) is distinct from v1 then
    raise exception 'lo de su enlace de prospección no se quedó con V1';
  end if;
end $$;
rollback;

-- @test turno: pausar sin nadie en turno · con el admin fuera de turno, E20 y nada cambia; con el admin en turno, la demo va a él (R4.9)
begin;
do $$
declare
  a constant uuid := '00000000-0000-4000-8000-000000000001';
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  v_r uuid := pruebas.reunion(pruebas.solicitud(v1, 'agendada'), v1, pruebas.hora(3, '09:00'));
begin
  update public.perfiles set en_turno = false where id = '00000000-0000-4000-8000-000000000003';
  update public.perfiles set whatsapp = '+59170000001', enlace_meet = 'https://meet.google.com/adm-inis-tra' where id = a;
  perform pruebas.error('E20', 'A', format('select public.cambiar_en_turno(%L, false, %L)', v1,
    (select actualizado_en from public.perfiles where id = v1)), 'P0001',
    'Hay una demo que nadie en turno puede tomar. Reagéndala, cancélala o pon a alguien en turno antes de pausar a esta persona.');
  if not (select en_turno from public.perfiles where id = v1) or (select anfitrion_id from public.reuniones where id = v_r) <> v1 then
    raise exception 'un E20 dejó cambios';
  end if;
  update public.perfiles set en_turno = true where id = a;
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform public.cambiar_en_turno(v1, false, (select actualizado_en from public.perfiles where id = v1));
  if (select anfitrion_id from public.reuniones where id = v_r) is distinct from a
     or (select enlace_meet from public.reuniones where id = v_r) <> 'https://meet.google.com/adm-inis-tra' then
    raise exception 'con el admin en turno la demo no pasó a él';
  end if;
end $$;
rollback;

-- @test turno: pausar con una nueva · sin nadie en turno queda sin asignar; con el admin en turno, a él (§5.6 l. 512, C3)
begin;
do $$
declare
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  v_n uuid := pruebas.solicitud(v1);
  r jsonb;
begin
  update public.perfiles set en_turno = false where id = '00000000-0000-4000-8000-000000000003';
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
  r := public.cambiar_en_turno(v1, false, (select actualizado_en from public.perfiles where id = v1));
  if (select asignado_a from public.solicitudes where id = v_n) is not null
     or r -> 'solicitudes' <> jsonb_build_array(jsonb_build_object('id', v_n, 'asignadoA', null)) or r -> 'reuniones' <> '[]' then
    raise exception 'sin nadie en turno la nueva no quedó sin asignar: %', r;
  end if;
end $$;
rollback;
begin;
do $$
declare
  a constant uuid := '00000000-0000-4000-8000-000000000001';
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  v_n uuid := pruebas.solicitud(v1);
begin
  update public.perfiles set en_turno = false where id = '00000000-0000-4000-8000-000000000003';
  update public.perfiles set whatsapp = '+59170000001', enlace_meet = 'https://meet.google.com/adm-inis-tra', en_turno = true
   where id = a;
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform public.cambiar_en_turno(v1, false, (select actualizado_en from public.perfiles where id = v1));
  if (select asignado_a from public.solicitudes where id = v_n) is distinct from a then
    raise exception 'con el admin en turno la nueva no pasó a él';
  end if;
end $$;
rollback;

-- @test turno: el admin se pausa a sí mismo · su demo va a V1 si está libre; con V1 ocupada, E20 (C2)
begin;
do $$
declare
  a constant uuid := '00000000-0000-4000-8000-000000000001';
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  v_r uuid;
begin
  update public.perfiles set en_turno = false where id = '00000000-0000-4000-8000-000000000003';
  update public.perfiles set whatsapp = '+59170000001', enlace_meet = 'https://meet.google.com/adm-inis-tra', en_turno = true
   where id = a;
  v_r := pruebas.reunion(pruebas.solicitud(a, 'agendada'), a, pruebas.hora(3, '09:00'));
  insert into public.bloqueos (perfil_id, inicio, fin, creado_por) values (v1, pruebas.hora(3, '09:00'), pruebas.hora(3, '10:00'), v1);
  perform pruebas.error('E20 propio', 'A', format('select public.cambiar_en_turno(%L, false, %L)', a,
    (select actualizado_en from public.perfiles where id = a)), 'P0001',
    'Hay una demo que nadie en turno puede tomar. Reagéndala, cancélala o pon a alguien en turno antes de pausar a esta persona.');
  delete from public.bloqueos where perfil_id = v1;
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform public.cambiar_en_turno(a, false, (select actualizado_en from public.perfiles where id = a));
  if (select anfitrion_id from public.reuniones where id = v_r) is distinct from v1 or (select en_turno from public.perfiles where id = a)
  then
    raise exception 'la demo del admin no pasó a V1';
  end if;
end $$;
rollback;

-- @test turno: desactivar sigue igual · la envoltura de dos argumentos pasa la ya empezada al respaldo (C2, C3)
begin;
do $$
declare
  a constant uuid := '00000000-0000-4000-8000-000000000001';
begin
  perform public._repartir_reuniones('00000000-0000-4000-8000-000000000002', a);
  if (select anfitrion_id from public.reuniones where id = '00000000-0000-4000-8000-000000000021') is distinct from a then
    raise exception 'la envoltura no pasó la demo ya empezada al respaldo';
  end if;
end $$;
rollback;

-- @test turno: errores · sin la clave E11, inactivo E15, versión vieja E16, sin contacto E26, nulos 22023 (C1, C4)
begin;
do $$
declare
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  v_act timestamptz := (select actualizado_en from public.perfiles where id = v1);
begin
  perform pruebas.error('sin clave', 'V1', format('select public.cambiar_en_turno(%L, false, %L)',
    '00000000-0000-4000-8000-000000000003', v_act), '42501', 'No tienes permiso para hacer esto.');
  perform pruebas.error('inactivo', 'A', format('select public.cambiar_en_turno(%L, true, %L)', '00000000-0000-4000-8000-000000000004',
    v_act), 'P0001', 'Esa persona no está activa.');
  perform pruebas.error('versión vieja', 'A', format('select public.cambiar_en_turno(%L, false, %L)', v1, v_act - interval '1 second'),
    'PT409', 'Esta persona cambió mientras la mirabas. Recarga para ver lo último.');
  perform pruebas.error('sin contacto', 'A', format('select public.cambiar_en_turno(%L, true, %L)',
    '00000000-0000-4000-8000-000000000001', (select actualizado_en from public.perfiles where id = '00000000-0000-4000-8000-000000000001')),
    'P0001', 'Esa persona necesita WhatsApp y enlace de Meet para entrar al turno.');
  perform pruebas.caso('sin persona', 'A', format('select public.cambiar_en_turno(null, false, %L)', v_act), 'error=22023:p_perfil_id');
  perform pruebas.caso('sin valor', 'A', format('select public.cambiar_en_turno(%L, null, %L)', v1, v_act), 'error=22023:p_en_turno');
  perform pruebas.caso('sin versión', 'A', format('select public.cambiar_en_turno(%L, false, null)', v1),
    'error=22023:p_actualizado_en_esperado');
  perform pruebas.caso('servidor', 'service_role', format('select public.cambiar_en_turno(%L, false, %L)', v1, v_act), 'error=42501');
  perform pruebas.caso('anon', 'anon', format('select public.cambiar_en_turno(%L, false, %L)', v1, v_act), 'error=42501');
end $$;
rollback;

-- @test turno: grants y forma · sólo authenticated, definidor, los candados en orden; los repartos, nadie del API (C4, C10)
begin;
do $$
declare
  v_t text := (select prosrc from pg_proc where oid = 'public.cambiar_en_turno(uuid, boolean, timestamptz)'::regprocedure);
begin
  if not has_function_privilege('authenticated', 'public.cambiar_en_turno(uuid, boolean, timestamptz)', 'execute')
     or has_function_privilege('anon', 'public.cambiar_en_turno(uuid, boolean, timestamptz)', 'execute')
     or has_function_privilege('service_role', 'public.cambiar_en_turno(uuid, boolean, timestamptz)', 'execute')
     or not (select prosecdef and proconfig @> array['search_path=""'] from pg_proc
              where oid = 'public.cambiar_en_turno(uuid, boolean, timestamptz)'::regprocedure) then
    raise exception 'cambiar_en_turno no es sólo de authenticated o no es definidor';
  end if;
  if has_function_privilege('authenticated', 'public._repartir_reuniones(uuid, uuid)', 'execute')
     or has_function_privilege('authenticated', 'public._repartir_reuniones(uuid, uuid, boolean)', 'execute')
     or has_function_privilege('authenticated', 'public._repartir_solicitudes(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public._repartir_solicitudes(uuid, boolean)', 'execute') then
    raise exception 'un reparto queda para authenticated';
  end if;
  if position('_bloquear_agenda' in v_t) = 0 or position('_bloquear_agenda' in v_t) > position('_bloquear_solicitudes' in v_t)
     or position('_bloquear_solicitudes' in v_t) > position('for no key update' in v_t) then
    raise exception 'cambiar_en_turno no toma agenda → solicitudes → perfil';
  end if;
end $$;
rollback;
