-- El perfil de cada persona del panel (semilla R4.21, §3 l. 262, §4 fila 23; paso P31, C1–C6): `actualizar_meet` cambia el Meet
-- propio y lo lleva a sus demos futuras confirmadas; el Meet ya no se cambia con un `update` directo (P2a) y el cambio de rol queda en
-- la auditoría. Es del panel: sólo `authenticated` (P1a). Las llamadas que miran la respuesta corren como postgres con el usuario puesto
-- en la sesión (lo mismo que `definer:V1`); los grants y los errores, con `pruebas.caso` y `pruebas.error`. A = …01, V1 = …02,
-- V2 = …03, V3 = …04 (inactivo), R1 = …21 (demo pasada de V1). Cada bloque deja la base como estaba.

-- @test meet: cambia las demos futuras confirmadas de quien llama, les sube la secuencia del .ics y devuelve su resumen (C1–C3)
begin;
do $$
declare
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  v2 constant uuid := '00000000-0000-4000-8000-000000000003';
  r1 constant uuid := '00000000-0000-4000-8000-000000000021';
  nuevo constant text := 'https://meet.google.com/nue-vooo-mmm';
  v_f1 uuid := pruebas.reunion(pruebas.solicitud(v1, 'agendada'), v1, now() + interval '2 days');
  v_f2 uuid := pruebas.reunion(pruebas.solicitud(v1, 'agendada'), v1, now() + interval '5 days');
  v_cancelada uuid := pruebas.reunion(pruebas.solicitud(v1), v1, now() + interval '3 days');
  v_de_v2 uuid := pruebas.reunion(pruebas.solicitud(v2, 'agendada'), v2, now() + interval '2 days');
  v_antes timestamptz := (select actualizado_en from public.perfiles where id = v1);
  r jsonb;
begin
  update public.reuniones set estado = 'cancelada' where id = v_cancelada;
  perform set_config('request.jwt.claim.sub', v1::text, true);
  r := public.actualizar_meet(nuevo, v_antes);
  perform set_config('request.jwt.claim.sub', '', true);
  if (select enlace_meet from public.perfiles where id = v1) <> nuevo
     or (select actualizado_en from public.perfiles where id = v1) <= v_antes then
    raise exception 'el perfil de V1 no quedó con el Meet nuevo y la versión movida';
  end if;
  if not pruebas.claves(r, array['perfil', 'reuniones']) or not pruebas.claves(r -> 'perfil', array['id', 'enlaceMeet', 'actualizadoEn'])
     or r #>> '{perfil,id}' is distinct from v1::text or r #>> '{perfil,enlaceMeet}' is distinct from nuevo
     or (r #>> '{perfil,actualizadoEn}')::timestamptz is distinct from (select actualizado_en from public.perfiles where id = v1) then
    raise exception 'el perfil de la respuesta no es el de V1 con la versión nueva: %', r -> 'perfil';
  end if;
  if jsonb_array_length(r -> 'reuniones') <> 2
     or not pruebas.claves(r -> 'reuniones', array['reunion', 'solicitud', 'anfitrion', 'anfitrionAnterior'])
     or r #>> '{reuniones,0,reunion,id}' is distinct from v_f1::text or r #>> '{reuniones,1,reunion,id}' is distinct from v_f2::text
     or r #>> '{reuniones,0,reunion,enlaceMeet}' is distinct from nuevo or r #>> '{reuniones,1,reunion,secuenciaIcs}' <> '1'
     or r #> '{reuniones,0,anfitrionAnterior}' <> 'null'::jsonb then
    raise exception 'las reuniones de la respuesta no son las dos futuras, en orden y con el Meet nuevo: %', r -> 'reuniones';
  end if;
  if exists (select 1 from public.reuniones where id in (v_f1, v_f2) and (enlace_meet <> nuevo or secuencia_ics <> 1)) then
    raise exception 'las demos futuras confirmadas de V1 no quedaron con el Meet nuevo y la secuencia en 1';
  end if;
  if (select enlace_meet from public.reuniones where id = r1) <> 'https://meet.google.com/abc-defg-hij'
     or (select secuencia_ics from public.reuniones where id = r1) <> 0 then
    raise exception 'la demo pasada R1 cambió';
  end if;
  if exists (select 1 from public.reuniones where id in (v_cancelada, v_de_v2)
              and (enlace_meet <> 'https://meet.google.com/aaa-bbbb-ccc' or secuencia_ics <> 0)) then
    raise exception 'cambió la demo cancelada de V1 o la de V2';
  end if;
end $$;
rollback;

-- @test meet: con el mismo enlace que ya tiene no escribe nada y devuelve reuniones vacío (C2)
begin;
do $$
declare
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  v_f uuid := pruebas.reunion(pruebas.solicitud(v1, 'agendada'), v1, now() + interval '2 days');
  v_antes timestamptz := (select actualizado_en from public.perfiles where id = v1);
  r jsonb;
begin
  perform set_config('request.jwt.claim.sub', v1::text, true);
  r := public.actualizar_meet('https://meet.google.com/abc-defg-hij', v_antes);
  perform set_config('request.jwt.claim.sub', '', true);
  if r -> 'reuniones' <> '[]'::jsonb or (r #>> '{perfil,actualizadoEn}')::timestamptz is distinct from v_antes
     or (select actualizado_en from public.perfiles where id = v1) <> v_antes
     or (select secuencia_ics from public.reuniones where id = v_f) <> 0 then
    raise exception 'el mismo enlace escribió algo: %', r;
  end if;
end $$;
rollback;

-- @test meet: el enlace (nunca vacío, P11a) y la versión se validan; versión vieja → E19; inactivo → E11 (C1)
begin;
do $$
declare
  v_act text := (select actualizado_en::text from public.perfiles where id = '00000000-0000-4000-8000-000000000002');
  v_act_v3 text := (select actualizado_en::text from public.perfiles where id = '00000000-0000-4000-8000-000000000004');
  bueno constant text := 'https://meet.google.com/nue-vooo-mmm';
begin
  perform pruebas.caso('nulo', 'V1', format('select public.actualizar_meet(null, %L)', v_act), 'error=22023:p_enlace_meet');
  perform pruebas.error('nulo texto', 'V1', format('select public.actualizar_meet(null, %L)', v_act), '22023',
    'El enlace de Meet no es válido.');
  perform pruebas.caso('no es Meet', 'V1', format('select public.actualizar_meet(%L, %L)', 'https://ejemplo.test/x', v_act),
    'error=22023:p_enlace_meet');
  perform pruebas.caso('sin versión', 'V1', format('select public.actualizar_meet(%L, null)', bueno),
    'error=22023:p_actualizado_en_esperado');
  perform pruebas.error('E19', 'V1', format('select public.actualizar_meet(%L, %L)', bueno, '2020-01-01 00:00Z'), 'PT409',
    'Tu perfil cambió mientras lo mirabas. Recarga para ver lo último.');
  perform pruebas.error('V3', 'V3', format('select public.actualizar_meet(%L, %L)', bueno, v_act_v3), '42501',
    'No tienes permiso para hacer esto.');
  if (select enlace_meet from public.perfiles where id = '00000000-0000-4000-8000-000000000002')
     <> 'https://meet.google.com/abc-defg-hij' then
    raise exception 'un intento rechazado cambió el Meet de V1';
  end if;
  -- authenticated la ejecuta: V1 con su versión cambia su Meet.
  perform pruebas.caso('V1 ok', 'V1', format('select public.actualizar_meet(%L, %L)', bueno, v_act), 'filas=1');
end $$;
rollback;

-- @test meet: la ejecuta sólo authenticated (ni anon, ni PUBLIC, ni service_role) y es de definidor con search_path vacío (C4)
do $$
declare
  f constant text := 'public.actualizar_meet(text, timestamptz)';
begin
  if not has_function_privilege('authenticated', f, 'execute') then raise exception 'authenticated no puede ejecutar %', f; end if;
  if has_function_privilege('anon', f, 'execute') then raise exception 'anon (o PUBLIC) puede ejecutar %', f; end if;
  if has_function_privilege('service_role', f, 'execute') then raise exception 'service_role puede ejecutar %', f; end if;
  if not exists (select 1 from pg_proc p where p.oid = f::regprocedure and p.prosecdef and p.proconfig @> array['search_path=""']) then
    raise exception '% no es de definidor con search_path vacío', f;
  end if;
end $$;

-- @test meet: el update directo del Meet da 42501 (P2a); el WhatsApp propio sigue directo (fila 23) (C5)
begin;
select pruebas.caso('23 meet', 'V1', $$update public.perfiles set enlace_meet = 'https://meet.google.com/zzz-zzzz-zzz' where id = {V1}$$,
  'error=42501');
select pruebas.caso('23 whatsapp', 'V1', $$update public.perfiles set whatsapp = '+59170000001' where id = {V1}$$, 'filas=1');
select pruebas.caso('23 nombre', 'V1', $$update public.perfiles set nombre = 'Carla Dos' where id = {V1}$$, 'filas=1');
rollback;

-- @test auditoría: el cambio de rol queda con su actor; activo sigue auditado; cambiar el nombre no audita (C6)
begin;
do $$
declare
  a constant uuid := '00000000-0000-4000-8000-000000000001';
  v2 constant uuid := '00000000-0000-4000-8000-000000000003';
  v_fila public.auditoria;
  v_n bigint;
begin
  -- Un solo admin (X12, índice perfiles_un_admin): A baja a vendedor sin actor para que V2 pueda subir.
  update public.perfiles set rol = 'vendedor' where id = a;
  perform set_config('request.jwt.claim.sub', a::text, true);
  update public.perfiles set rol = 'admin' where id = v2;
  select * into v_fila from public.auditoria where accion = 'rol' and registro_id = v2;
  if v_fila.id is null or v_fila.actor_id is distinct from a or v_fila.tabla <> 'perfiles'
     or v_fila.antes <> '{"rol": "vendedor"}'::jsonb or v_fila.despues <> '{"rol": "admin"}'::jsonb then
    raise exception 'el cambio de rol de V2 no quedó auditado con el actor A: %', to_jsonb(v_fila);
  end if;
  v_n := (select count(*) from (select 1 from public.auditoria where registro_id = v2 limit 100) x);
  update public.perfiles set nombre = 'Luis Dos' where id = v2;
  if (select count(*) from (select 1 from public.auditoria where registro_id = v2 limit 100) x) <> v_n then
    raise exception 'cambiar el nombre escribió auditoría';
  end if;
  update public.perfiles set activo = false, en_turno = false where id = v2;
  if not exists (select 1 from public.auditoria where accion = 'activo' and registro_id = v2 and actor_id = a) then
    raise exception 'desactivar dejó de auditarse';
  end if;
  perform set_config('request.jwt.claim.sub', '', true);
end $$;
rollback;
