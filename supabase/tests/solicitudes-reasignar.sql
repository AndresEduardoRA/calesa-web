-- Reasignar una solicitud y su demo (semilla §5.6 l. 514, R4.2, R4.8; paso P30, C1, C8, C9, C15). Es del panel: sólo `authenticated`
-- con `solicitudes.reasignar` (P1a). Las llamadas que miran la respuesta corren como postgres con el usuario A puesto en la sesión
-- (lo mismo que `definer:A`); los grants y los errores, con `pruebas.caso` y `pruebas.error`. A = …01, V1 = …02, V2 = …03,
-- V3 = …04 (inactivo), S2 = …12 (de V2, nueva). Cada bloque deja la base como estaba.

-- @test reasignar: sin reunión · pasa al destino y queda la asignación con su actor (fila 35 permitida); una demo cancelada no estorba
begin;
do $$
declare
  a constant uuid := '00000000-0000-4000-8000-000000000001';
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  v2 constant uuid := '00000000-0000-4000-8000-000000000003';
  s2 constant uuid := '00000000-0000-4000-8000-000000000012';
  v_s uuid;
  v_r uuid;
  r jsonb;
begin
  perform pruebas.caso('35 por RPC', 'A', format($f$select public.reasignar_solicitud(%L, %L, %L) #>> '{solicitud,asignadoA}' = %L$f$,
    s2, v1, (select actualizado_en from public.solicitudes where id = s2), v1), 'verdad');
  if (select asignado_a from public.solicitudes where id = s2) is distinct from v1
     or not exists (select 1 from public.auditoria where accion = 'asignacion' and registro_id = s2 and actor_id = a) then
    raise exception 'la reasignación sin reunión no pasó a V1 con la auditoría de A';
  end if;
  v_s := pruebas.solicitud(v2);
  v_r := pruebas.reunion(v_s, v2, now() + interval '3 days');
  update public.reuniones set estado = 'cancelada' where id = v_r;
  perform set_config('request.jwt.claim.sub', a::text, true);
  r := public.reasignar_solicitud(v_s, v1, (select actualizado_en from public.solicitudes where id = v_s));
  if not pruebas.claves(r, array['solicitud', 'reunion']) or not pruebas.claves(r -> 'solicitud', array['id', 'asignadoA', 'actualizadoEn'])
     or r -> 'reunion' <> 'null'::jsonb or (select asignado_a from public.solicitudes where id = v_s) is distinct from v1 then
    raise exception 'con una demo cancelada no se reasignó: %', r;
  end if;
end $$;
rollback;

-- @test reasignar: con hueco · la demo pasa a V1 (fuera de turno), con su Meet y la secuencia del .ics (R4.2, R4.8)
begin;
do $$
declare
  a constant uuid := '00000000-0000-4000-8000-000000000001';
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  v2 constant uuid := '00000000-0000-4000-8000-000000000003';
  v_s uuid := pruebas.solicitud(v2, 'agendada');
  v_r uuid := pruebas.reunion(v_s, v2, pruebas.hora(3, '09:00'));
  v_x public.reuniones;
  r jsonb;
begin
  update public.perfiles set en_turno = false where id = v1;
  perform set_config('request.jwt.claim.sub', a::text, true);
  r := public.reasignar_solicitud(v_s, v1, (select actualizado_en from public.solicitudes where id = v_s));
  perform set_config('request.jwt.claim.sub', '', true);
  select * into v_x from public.reuniones where id = v_r;
  if v_x.anfitrion_id is distinct from v1 or v_x.enlace_meet <> 'https://meet.google.com/abc-defg-hij' or v_x.secuencia_ics <> 1
     or (select asignado_a from public.solicitudes where id = v_s) is distinct from v1
     or r #>> '{reunion,anfitrionAnterior,id}' is distinct from v2::text or r #>> '{reunion,anfitrion,id}' is distinct from v1::text
     or r #>> '{solicitud,asignadoA}' is distinct from v1::text then
    raise exception 'la demo no pasó a V1: %', r;
  end if;
  if not exists (select 1 from public.auditoria where accion = 'reagenda' and registro_id = v_r and actor_id = a) then
    raise exception 'el cambio de anfitrión no quedó auditado';
  end if;
end $$;
rollback;

-- @test reasignar: sin hueco · un bloqueo, otra demo dentro del descanso o el máximo del día: E12 y nada cambia (R4.2)
begin;
do $$
declare
  a constant uuid := '00000000-0000-4000-8000-000000000001';
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  v2 constant uuid := '00000000-0000-4000-8000-000000000003';
  v_s uuid := pruebas.solicitud(v2, 'agendada');
  v_r uuid := pruebas.reunion(v_s, v2, pruebas.hora(3, '09:00'));
  v_act timestamptz := (select actualizado_en from public.solicitudes where id = v_s);
  v_sql text := format('select public.reasignar_solicitud(%L, %L, %L)', v_s, v1, v_act);
  v_otra uuid;
begin
  insert into public.bloqueos (perfil_id, inicio, fin, creado_por)
  values (v1, pruebas.hora(3, '09:00'), pruebas.hora(3, '10:00'), a);
  perform pruebas.error('bloqueo', 'A', v_sql, 'P0001', 'Esa persona no está libre a esa hora. Reagenda primero.');
  delete from public.bloqueos where perfil_id = v1;
  v_otra := pruebas.reunion(pruebas.solicitud(v1, 'agendada'), v1, pruebas.hora(3, '09:40'));
  perform pruebas.error('descanso', 'A', v_sql, 'P0001', 'Esa persona no está libre a esa hora. Reagenda primero.');
  update public.reuniones set inicio = pruebas.hora(3, '15:00'), fin = pruebas.hora(3, '15:30') where id = v_otra;
  update public.config_agenda set max_reuniones_dia = 1;
  perform pruebas.error('máximo', 'A', v_sql, 'P0001', 'Esa persona no está libre a esa hora. Reagenda primero.');
  if (select anfitrion_id from public.reuniones where id = v_r) is distinct from v2
     or (select asignado_a from public.solicitudes where id = v_s) is distinct from v2 then
    raise exception 'una reasignación rechazada cambió algo';
  end if;
end $$;
rollback;

-- @test reasignar: errores · sin la clave, destino inactivo o inexistente, versión vieja, solicitud inexistente, argumentos nulos
begin;
do $$
declare
  a constant uuid := '00000000-0000-4000-8000-000000000001';
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  v2 constant uuid := '00000000-0000-4000-8000-000000000003';
  s2 constant uuid := '00000000-0000-4000-8000-000000000012';
  v_act timestamptz := (select actualizado_en from public.solicitudes where id = s2);
  v_auditoria bigint;
  r jsonb;
begin
  perform pruebas.error('sin clave', 'V1', format('select public.reasignar_solicitud(%L, %L, %L)', s2, v1, v_act), '42501',
    'No tienes permiso para hacer esto.');
  perform pruebas.error('destino inactivo', 'A', format('select public.reasignar_solicitud(%L, %L, %L)', s2,
    '00000000-0000-4000-8000-000000000004', v_act), 'P0001', 'Esa persona no está activa.');
  perform pruebas.error('destino inexistente', 'A', format('select public.reasignar_solicitud(%L, %L, %L)', s2, gen_random_uuid(),
    v_act), 'P0001', 'Esa persona no está activa.');
  perform pruebas.error('versión vieja', 'A', format('select public.reasignar_solicitud(%L, %L, %L)', s2, v1,
    v_act - interval '1 second'), 'PT409', 'Esta demo o solicitud cambió mientras la mirabas. Recarga para ver lo último.');
  perform pruebas.error('inexistente', 'A', format('select public.reasignar_solicitud(%L, %L, %L)', gen_random_uuid(), v1, v_act),
    'PT409', 'Esta demo o solicitud cambió mientras la mirabas. Recarga para ver lo último.');
  perform pruebas.caso('sin solicitud', 'A', format('select public.reasignar_solicitud(null, %L, %L)', v1, v_act),
    'error=22023:p_solicitud_id');
  perform pruebas.caso('sin destino', 'A', format('select public.reasignar_solicitud(%L, null, %L)', s2, v_act),
    'error=22023:p_asignar_a');
  perform pruebas.caso('sin versión', 'A', format('select public.reasignar_solicitud(%L, %L, null)', s2, v1),
    'error=22023:p_actualizado_en_esperado');
  v_auditoria := (select count(*) from public.auditoria);
  perform set_config('request.jwt.claim.sub', a::text, true);
  r := public.reasignar_solicitud(s2, v2, v_act);
  if r #>> '{solicitud,asignadoA}' is distinct from v2::text or (select count(*) from public.auditoria) <> v_auditoria then
    raise exception 'reasignar al mismo escribió algo: %', r;
  end if;
end $$;
rollback;

-- @test reasignar: grants y forma · sólo authenticated; definidor con search_path vacío; candado de agenda, sin _bloquear_vigente
begin;
select pruebas.caso('servidor', 'service_role', $$select public.reasignar_solicitud({S2}, {V1}, now())$$, 'error=42501');
select pruebas.caso('anon', 'anon', $$select public.reasignar_solicitud({S2}, {V1}, now())$$, 'error=42501');
do $$
declare
  v_p record;
begin
  select p.prosecdef, p.proconfig, p.prosrc into v_p from pg_proc p where p.oid = 'public.reasignar_solicitud'::regproc;
  if not v_p.prosecdef or not coalesce(v_p.proconfig @> array['search_path=""'], false) or v_p.prosrc !~ '_bloquear_agenda\(\)'
     or v_p.prosrc ~ '_bloquear_vigente' then
    raise exception 'reasignar_solicitud no tiene la forma de C2 y C9';
  end if;
  if has_function_privilege('authenticated', 'public._pasar_reunion(public.reuniones, uuid[])', 'execute')
     or has_function_privilege('service_role', 'public.reasignar_solicitud(uuid, uuid, timestamptz)', 'execute')
     or not has_function_privilege('authenticated', 'public.reasignar_solicitud(uuid, uuid, timestamptz)', 'execute') then
    raise exception 'authenticated ejecuta _pasar_reunion, o reasignar no es sólo de authenticated';
  end if;
end $$;
rollback;
