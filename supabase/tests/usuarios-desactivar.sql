-- Desactivar a una persona del panel (semilla §5.6 l. 515, R3.3, R4.3, R4.8; paso P30, C1, C3, C10, C11, C15). Es del panel: sólo
-- `authenticated` con `usuarios.gestionar`. Las llamadas que miran la respuesta corren como postgres con A puesto en la sesión; los
-- grants y los errores, con `pruebas.caso` y `pruebas.error`. A = …01 (admin), V1 = …02, V2 = …03, V3 = …04 (inactivo); S1 = …11
-- (de V1, agendada) con R1 = …21 el 3 nov, ya pasada. Antes de que A sea respaldo se le ponen WhatsApp y Meet.

-- @test desactivar: reparte · la demo futura al reparto, la ya empezada al admin con su demo, la cancelada se queda (P4a)
begin;
do $$
declare
  a constant uuid := '00000000-0000-4000-8000-000000000001';
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  v2 constant uuid := '00000000-0000-4000-8000-000000000003';
  r1 constant uuid := '00000000-0000-4000-8000-000000000021';
  v_sf uuid := pruebas.solicitud(v1, 'agendada');
  v_rf uuid := pruebas.reunion(v_sf, v1, pruebas.hora(3, '09:00'));
  v_rc uuid := pruebas.reunion(pruebas.solicitud(v1), v1, pruebas.hora(4, '09:00'));
  v_antes public.reuniones;
  v_r1 public.reuniones;
  r jsonb;
begin
  update public.perfiles set whatsapp = '+59170000001', enlace_meet = 'https://meet.google.com/adm-inis-tra' where id = a;
  update public.reuniones set estado = 'cancelada' where id = v_rc;
  select * into v_antes from public.reuniones where id = r1;
  perform set_config('request.jwt.claim.sub', a::text, true);
  r := public.desactivar_usuario(v1, (select actualizado_en from public.perfiles where id = v1));
  perform set_config('request.jwt.claim.sub', '', true);
  if not pruebas.claves(r, array['perfil', 'reuniones', 'solicitudes'])
     or not pruebas.claves(r -> 'perfil', array['id', 'activo', 'enTurno', 'actualizadoEn'])
     or r #>> '{perfil,activo}' <> 'false' or r #>> '{perfil,enTurno}' <> 'false'
     or (select activo or en_turno from public.perfiles where id = v1) then
    raise exception 'V1 no quedó inactiva y fuera de turno: %', r;
  end if;
  if (select anfitrion_id from public.reuniones where id = v_rf) is distinct from v2
     or (select asignado_a from public.solicitudes where id = v_sf) is distinct from v2
     or jsonb_array_length(r -> 'reuniones') <> 1 or r #>> '{reuniones,0,reunion,id}' <> v_rf::text
     or r #>> '{reuniones,0,anfitrionAnterior,id}' <> v1::text then
    raise exception 'la demo futura no pasó a V2: %', r;
  end if;
  select * into v_r1 from public.reuniones where id = r1;
  if v_r1.anfitrion_id is distinct from a or v_r1.enlace_meet <> v_antes.enlace_meet or v_r1.secuencia_ics <> v_antes.secuencia_ics
     or (select asignado_a from public.solicitudes where id = '00000000-0000-4000-8000-000000000011') is distinct from a then
    raise exception 'la demo ya empezada no pasó al admin tal cual: %', to_jsonb(v_r1);
  end if;
  if (select anfitrion_id from public.reuniones where id = v_rc) is distinct from v1 then
    raise exception 'la demo cancelada cambió de anfitrión';
  end if;
  if not exists (select 1 from public.auditoria where accion = 'activo' and tabla = 'perfiles' and registro_id = v1 and actor_id = a
                   and antes = '{"activo": true}' and despues = '{"activo": false}') then
    raise exception 'la desactivación no quedó auditada';
  end if;
end $$;
rollback;

-- @test desactivar: reparto de varias · se calcula todo antes de escribir y cada una que alguien recibe le suma 1 (C3)
begin;
do $$
declare
  a constant uuid := '00000000-0000-4000-8000-000000000001';
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  v2 constant uuid := '00000000-0000-4000-8000-000000000003';
  v4 constant uuid := '00000000-0000-4000-8000-000000000005';
  v_tres uuid[];
  r jsonb;
begin
  update public.perfiles set whatsapp = '+59170000001', enlace_meet = 'https://meet.google.com/adm-inis-tra' where id = a;
  update public.solicitudes set creado_en = now() - interval '8 days' where id = '00000000-0000-4000-8000-000000000012';
  insert into auth.users (id, email) values (v4, 'v4@ejemplo.test');
  insert into public.perfiles (id, nombre, email, rol, whatsapp, enlace_meet, en_turno)
  values (v4, 'Vendedor Cuatro', 'v4@ejemplo.test', 'vendedor', '+59170000005', 'https://meet.google.com/vvv-cuat-roo', true);
  perform pruebas.solicitud(v4);
  v_tres := array[pruebas.solicitud(v1), pruebas.solicitud(v1), pruebas.solicitud(v1)];
  perform set_config('request.jwt.claim.sub', a::text, true);
  r := public.desactivar_usuario(v1, (select actualizado_en from public.perfiles where id = v1));
  if (select array_agg(asignado_a order by id) from public.solicitudes where id = any (v_tres)) is distinct from array[v2, v2, v4] then
    raise exception 'el reparto de varias no fue V2, V2, V4: %', r -> 'solicitudes';
  end if;
  if jsonb_array_length(r -> 'solicitudes') <> 3 or not pruebas.claves(r -> 'solicitudes', array['id', 'asignadoA']) then
    raise exception 'la respuesta no lista las tres repartidas: %', r;
  end if;
end $$;
rollback;

-- @test desactivar: respaldo · nadie elegible: la demo al admin fuera de turno; el admin ocupado: E14 y nada cambia (R4.3, P5a)
begin;
do $$
declare
  a constant uuid := '00000000-0000-4000-8000-000000000001';
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  v_r uuid := pruebas.reunion(pruebas.solicitud(v1, 'agendada'), v1, pruebas.hora(3, '09:00'));
  v_n uuid := pruebas.solicitud(v1);
  r jsonb;
begin
  update public.perfiles set whatsapp = '+59170000001', enlace_meet = 'https://meet.google.com/adm-inis-tra' where id = a;
  update public.perfiles set en_turno = false where id = '00000000-0000-4000-8000-000000000003';
  insert into public.bloqueos (perfil_id, inicio, fin, creado_por) values (a, pruebas.hora(3, '09:00'), pruebas.hora(3, '10:00'), a);
  perform pruebas.error('admin ocupado', 'A', format('select public.desactivar_usuario(%L, %L)', v1,
    (select actualizado_en from public.perfiles where id = v1)), 'P0001',
    'Hay una demo que nadie puede tomar. Reagéndala, cancélala o márcala antes de desactivar a esta persona.');
  if not (select activo from public.perfiles where id = v1) or (select anfitrion_id from public.reuniones where id = v_r) <> v1 then
    raise exception 'un E14 dejó cambios';
  end if;
  delete from public.bloqueos where perfil_id = a;
  perform set_config('request.jwt.claim.sub', a::text, true);
  r := public.desactivar_usuario(v1, (select actualizado_en from public.perfiles where id = v1));
  if (select anfitrion_id from public.reuniones where id = v_r) is distinct from a
     or (select enlace_meet from public.reuniones where id = v_r) <> 'https://meet.google.com/adm-inis-tra'
     or (select asignado_a from public.solicitudes where id = v_n) is not null then
    raise exception 'sin nadie elegible la demo no fue al admin o la nueva no quedó sin asignar: %', r;
  end if;
end $$;
rollback;

-- @test desactivar: prospección · con su creador desactivado, la nueva y la demo de su enlace van a la regla general
begin;
do $$
declare
  a constant uuid := '00000000-0000-4000-8000-000000000001';
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  v2 constant uuid := '00000000-0000-4000-8000-000000000003';
  v_n uuid;
  v_s uuid;
  v_r uuid;
begin
  update public.perfiles set whatsapp = '+59170000001', enlace_meet = 'https://meet.google.com/adm-inis-tra' where id = a;
  insert into public.enlaces_prospeccion (codigo, creado_por) values ('CA-01', v1);
  v_n := pruebas.solicitud(v1, 'nueva', 'prospeccion', 'CA-01');
  v_s := pruebas.solicitud(v1, 'agendada', 'prospeccion', 'CA-01');
  v_r := pruebas.reunion(v_s, v1, pruebas.hora(3, '09:00'));
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform public.desactivar_usuario(v1, (select actualizado_en from public.perfiles where id = v1));
  if (select asignado_a from public.solicitudes where id = v_n) is distinct from v2
     or (select anfitrion_id from public.reuniones where id = v_r) is distinct from v2 then
    raise exception 'lo del enlace de V1 no fue a la regla general';
  end if;
end $$;
rollback;

-- @test desactivar: errores · sin Meet E13, sin WhatsApp E17, sin la clave E11, inactivo E15, versión vieja E16, a sí mismo 42501
begin;
do $$
declare
  a constant uuid := '00000000-0000-4000-8000-000000000001';
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  v_act timestamptz := (select actualizado_en from public.perfiles where id = v1);
  v_sql text := format('select public.desactivar_usuario(%L, %L)', v1, v_act);
begin
  perform pruebas.error('sin Meet', 'A', v_sql, 'P0001', 'Carga tu enlace de Meet antes de desactivar a esta persona.');
  update public.perfiles set enlace_meet = 'https://meet.google.com/adm-inis-tra' where id = a;
  perform pruebas.error('sin WhatsApp', 'A', v_sql, 'P0001', 'Carga tu WhatsApp antes de desactivar a esta persona.');
  update public.perfiles set whatsapp = '+59170000001' where id = a;
  perform pruebas.error('sin clave', 'V1', format('select public.desactivar_usuario(%L, %L)', '00000000-0000-4000-8000-000000000003',
    v_act), '42501', 'No tienes permiso para hacer esto.');
  perform pruebas.error('inactivo', 'A', format('select public.desactivar_usuario(%L, %L)', '00000000-0000-4000-8000-000000000004',
    v_act), 'P0001', 'Esa persona no está activa.');
  perform pruebas.error('versión vieja', 'A', format('select public.desactivar_usuario(%L, %L)', v1, v_act - interval '1 second'),
    'PT409', 'Esta persona cambió mientras la mirabas. Recarga para ver lo último.');
  perform pruebas.error('a sí mismo', 'A', format('select public.desactivar_usuario(%L, %L)', a,
    (select actualizado_en from public.perfiles where id = a)), '42501', 'Nadie puede desactivarse a sí mismo.');
  perform pruebas.caso('sin persona', 'A', format('select public.desactivar_usuario(null, %L)', v_act), 'error=22023:p_perfil_id');
  perform pruebas.caso('sin versión', 'A', format('select public.desactivar_usuario(%L, null)', v1),
    'error=22023:p_actualizado_en_esperado');
  perform pruebas.caso('servidor', 'service_role', v_sql, 'error=42501');
  perform pruebas.caso('anon', 'anon', v_sql, 'error=42501');
end $$;
do $$
declare
  v_d text := (select prosrc from pg_proc where oid = 'public.desactivar_usuario'::regproc);
  v_r text := (select prosrc from pg_proc where oid = 'public._repartir_reuniones'::regproc);
begin
  if v_d !~ 'for no key update' or v_r ~ '_bloquear_vigente' or v_r !~ 'r\.id = v_id and r\.estado = ''confirmada''[^;]*for update' then
    raise exception 'desactivar no tiene la forma de C2 y C11';
  end if;
  if not (select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = 'public.desactivar_usuario'::regproc)
     or has_function_privilege('service_role', 'public.desactivar_usuario(uuid, timestamptz)', 'execute')
     or has_function_privilege('authenticated', 'public._repartir_reuniones(uuid, uuid)', 'execute')
     or has_function_privilege('authenticated', 'public._repartir_solicitudes(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public._auditar_perfil()', 'execute') then
    raise exception 'desactivar no es definidor o un ayudante queda para authenticated';
  end if;
end $$;
rollback;
