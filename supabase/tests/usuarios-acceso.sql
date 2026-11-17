-- Quién entra al panel y con qué rol (semilla X12, R4.12, R4.14, F5, §9.7 l. 943; paso P34, C5–C8, C10). `reactivar_usuario` y
-- `aceptar_invitacion` son del panel (sólo `authenticated`); `asignar_rol` es la RPC de `pnpm admin:crear` (sólo `service_role`) y hace
-- cumplir X12: un solo perfil admin, contando los inactivos, que además fija el índice `perfiles_un_admin`. Las llamadas que miran la
-- respuesta corren como postgres con el usuario puesto en la sesión (vacío para el script); los grants y los errores, con
-- `pruebas.caso` y `pruebas.error`. El alta del invitado está en `usuarios-alta.sql`. A = …01 (admin), V1 = …02, V2 = …03, V3 = …04
-- (inactivo).

-- @test acceso: reactivar · vuelve activa y fuera de turno, con su fila `activo`; si ya está activa no escribe (C5, P7a)
begin;
do $$
declare
  a constant uuid := '00000000-0000-4000-8000-000000000001';
  v3 constant uuid := '00000000-0000-4000-8000-000000000004';
  r jsonb;
  r2 jsonb;
begin
  perform set_config('request.jwt.claim.sub', a::text, true);
  r := public.reactivar_usuario(v3, (select actualizado_en from public.perfiles where id = v3));
  if not pruebas.claves(r, array['perfil']) or not pruebas.claves(r -> 'perfil', array['id', 'activo', 'enTurno', 'actualizadoEn'])
     or r #>> '{perfil,activo}' <> 'true' or r #>> '{perfil,enTurno}' <> 'false'
     or not (select activo and not en_turno from public.perfiles where id = v3) then
    raise exception 'V3 no quedó activa y fuera de turno: %', r;
  end if;
  if not exists (select 1 from public.auditoria where accion = 'activo' and registro_id = v3 and actor_id = a
                   and antes = '{"activo": false}' and despues = '{"activo": true}') then
    raise exception 'la reactivación no quedó auditada con el actor A';
  end if;
  r2 := public.reactivar_usuario(v3, (r #>> '{perfil,actualizadoEn}')::timestamptz);
  if r2 #>> '{perfil,actualizadoEn}' <> r #>> '{perfil,actualizadoEn}' then
    raise exception 'reactivar a una persona activa escribió: %', r2;
  end if;
end $$;
rollback;

-- @test acceso: reactivar, errores · sin la clave E11, inexistente 22023, versión vieja E16, nulos 22023 (C5)
begin;
do $$
declare
  v3 constant uuid := '00000000-0000-4000-8000-000000000004';
  v_act timestamptz := (select actualizado_en from public.perfiles where id = v3);
begin
  perform pruebas.error('sin clave', 'V1', format('select public.reactivar_usuario(%L, %L)', v3, v_act), '42501',
    'No tienes permiso para hacer esto.');
  perform pruebas.caso('inexistente', 'A', format('select public.reactivar_usuario(%L, %L)', gen_random_uuid(), v_act),
    'error=22023:p_perfil_id');
  perform pruebas.error('versión vieja', 'A', format('select public.reactivar_usuario(%L, %L)', v3, v_act - interval '1 second'),
    'PT409', 'Esta persona cambió mientras la mirabas. Recarga para ver lo último.');
  perform pruebas.caso('sin persona', 'A', format('select public.reactivar_usuario(null, %L)', v_act), 'error=22023:p_perfil_id');
  perform pruebas.caso('sin versión', 'A', format('select public.reactivar_usuario(%L, null)', v3),
    'error=22023:p_actualizado_en_esperado');
end $$;
rollback;

-- @test acceso: primer admin, camino que inserta · crea el perfil admin con su fila `rol` sin actor; la segunda vez no cambia (C6)
begin;
do $$
declare
  u constant uuid := '00000000-0000-4000-8000-000000000061';
  r jsonb;
  r2 jsonb;
begin
  update public.perfiles set rol = 'vendedor' where id = '00000000-0000-4000-8000-000000000001';
  insert into auth.users (id, email) values (u, 'duena@ejemplo.test');
  r := public.asignar_rol(u, 'admin', 'Dueña');
  if not pruebas.claves(r, array['perfil', 'cambio'])
     or not pruebas.claves(r -> 'perfil', array['id', 'nombre', 'email', 'rol', 'activo', 'enTurno', 'actualizadoEn'])
     or r ->> 'cambio' <> 'true' or r #>> '{perfil,rol}' <> 'admin' or r #>> '{perfil,email}' <> 'duena@ejemplo.test'
     or not exists (select 1 from public.perfiles where id = u and rol = 'admin' and activo and not en_turno and nombre = 'Dueña') then
    raise exception 'el primer admin no nació como se espera: %', r;
  end if;
  if (select count(*) from (select 1 from public.auditoria where registro_id = u limit 10) x) <> 1
     or not exists (select 1 from public.auditoria where accion = 'rol' and tabla = 'perfiles' and registro_id = u and actor_id is null
                      and antes = '{"rol": null}' and despues = '{"rol": "admin"}') then
    raise exception 'el alta del admin no quedó auditada sin actor';
  end if;
  r2 := public.asignar_rol(u, 'admin', 'Dueña');
  if r2 ->> 'cambio' <> 'false' or (select count(*) from (select 1 from public.auditoria where registro_id = u limit 10) x) <> 1 then
    raise exception 'la segunda llamada cambió o auditó: %', r2;
  end if;
end $$;
rollback;

-- @test acceso: primer admin, camino que actualiza · sin ningún admin, V3 pasa a admin y activa con las filas del trigger (C6)
begin;
do $$
declare
  v3 constant uuid := '00000000-0000-4000-8000-000000000004';
  r jsonb;
begin
  update public.perfiles set rol = 'vendedor' where id = '00000000-0000-4000-8000-000000000001';
  r := public.asignar_rol(v3, 'admin');
  if r ->> 'cambio' <> 'true' or not (select rol = 'admin' and activo from public.perfiles where id = v3)
     or not exists (select 1 from public.auditoria where accion = 'rol' and registro_id = v3 and actor_id is null
                      and despues = '{"rol": "admin"}')
     or not exists (select 1 from public.auditoria where accion = 'activo' and registro_id = v3 and actor_id is null
                      and despues = '{"activo": true}') then
    raise exception 'V3 no pasó a admin activo con su auditoría: %', r;
  end if;
end $$;
rollback;

-- @test acceso: X12 · otro admin E24 (también inactivo), bajar al único E25, sin cambio no escribe, y los 22023 (C6, P4a)
begin;
do $$
declare
  a constant uuid := '00000000-0000-4000-8000-000000000001';
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  u constant uuid := '00000000-0000-4000-8000-000000000062';
  w constant uuid := '00000000-0000-4000-8000-000000000063';
  r jsonb;
begin
  insert into auth.users (id, email) values (u, 'socia@ejemplo.test'), (w, 'luis.nuevo@ejemplo.test');
  perform pruebas.error('E24', 'service_role', format('select public.asignar_rol(%L, %L)', v1, 'admin'), 'P0001',
    'Ya hay un administrador.');
  perform pruebas.error('E25', 'service_role', format('select public.asignar_rol(%L, %L)', a, 'vendedor'), 'P0001',
    'El panel no puede quedarse sin administrador.');
  update public.perfiles set activo = false where id = a;
  perform pruebas.error('E24 inactivo', 'service_role', format('select public.asignar_rol(%L, %L)', v1, 'admin'), 'P0001',
    'Ya hay un administrador.');
  r := public.asignar_rol(v1, 'vendedor');
  if r ->> 'cambio' <> 'false' then
    raise exception 'un rol igual escribió: %', r;
  end if;
  perform pruebas.caso('vendedor sin perfil', 'service_role', format('select public.asignar_rol(%L, %L)', u, 'vendedor'),
    'error=22023:p_usuario_id');
  perform pruebas.caso('fuera de Auth', 'service_role', format('select public.asignar_rol(%L, %L, %L)', gen_random_uuid(), 'admin',
    'Nadie'), 'error=22023:p_usuario_id');
  perform pruebas.caso('sin usuario', 'service_role', $q$select public.asignar_rol(null, 'admin')$q$, 'error=22023:p_usuario_id');
  perform pruebas.caso('sin rol', 'service_role', format('select public.asignar_rol(%L, null)', u), 'error=22023:p_rol');
  update public.perfiles set rol = 'vendedor', activo = true where id = a;
  perform pruebas.caso('sin nombre', 'service_role', format('select public.asignar_rol(%L, %L)', u, 'admin'), 'error=22023:p_nombre');
  perform pruebas.caso('nombre corto', 'service_role', format('select public.asignar_rol(%L, %L, %L)', u, 'admin', 'X'),
    'error=22023:perfiles_nombre_check');
  -- Auth no repite correos: el choque es con un perfil que quedó con un correo que Auth ya no le da (el de V2).
  update public.perfiles set email = 'luis.nuevo@ejemplo.test' where id = '00000000-0000-4000-8000-000000000003';
  perform pruebas.caso('correo ajeno', 'service_role', format('select public.asignar_rol(%L, %L, %L)', w, 'admin', 'Otro Luis'),
    'error=22023:email');
end $$;
rollback;

-- @test acceso: recuperación · el único admin inactivo vuelve activo con asignar_rol(A, 'admin') (C5, C6)
begin;
do $$
declare
  a constant uuid := '00000000-0000-4000-8000-000000000001';
  r jsonb;
begin
  update public.perfiles set activo = false where id = a;
  r := public.asignar_rol(a, 'admin');
  if r ->> 'cambio' <> 'true' or not (select activo from public.perfiles where id = a)
     or not exists (select 1 from public.auditoria where accion = 'activo' and registro_id = a and actor_id is null
                      and despues = '{"activo": true}') then
    raise exception 'el admin inactivo no volvió: %', r;
  end if;
end $$;
rollback;

-- @test acceso: índice · un segundo perfil admin da 23505 también como postgres, por update o por insert (C6, X12)
begin;
do $$
declare
  u constant uuid := '00000000-0000-4000-8000-000000000064';
  v_estado text;
begin
  begin
    update public.perfiles set rol = 'admin' where id = '00000000-0000-4000-8000-000000000002';
  exception when unique_violation then
    v_estado := '23505';
  end;
  if v_estado is distinct from '23505' then
    raise exception 'un segundo admin por update no dio 23505';
  end if;
  v_estado := null;
  insert into auth.users (id, email) values (u, 'otra@ejemplo.test');
  begin
    insert into public.perfiles (id, nombre, email, rol) values (u, 'Otra Admin', 'otra@ejemplo.test', 'admin');
  exception when unique_violation then
    v_estado := '23505';
  end;
  if v_estado is distinct from '23505'
     or not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'perfiles_un_admin'
                      and indexdef ~* 'unique' and indexdef ~ 'rol = ''admin''') then
    raise exception 'falta el índice de un solo admin';
  end if;
end $$;
rollback;

-- @test acceso: grants y forma · reactivar y aceptar sólo authenticated; asignar_rol sólo service_role; definidor; el candado primero (C10)
begin;
do $$
declare
  v_f text;
  v_s text := (select prosrc from pg_proc where oid = 'public.asignar_rol(uuid, public.rol_usuario, text)'::regprocedure);
begin
  foreach v_f in array array['public.reactivar_usuario(uuid, timestamptz)', 'public.aceptar_invitacion()'] loop
    if not has_function_privilege('authenticated', v_f, 'execute') or has_function_privilege('anon', v_f, 'execute')
       or has_function_privilege('service_role', v_f, 'execute') or has_function_privilege('public', v_f, 'execute') then
      raise exception '% no es sólo de authenticated', v_f;
    end if;
  end loop;
  v_f := 'public.asignar_rol(uuid, public.rol_usuario, text)';
  if not has_function_privilege('service_role', v_f, 'execute') or has_function_privilege('authenticated', v_f, 'execute')
     or has_function_privilege('anon', v_f, 'execute') or has_function_privilege('public', v_f, 'execute') then
    raise exception 'asignar_rol no es sólo de service_role';
  end if;
  if exists (select 1 from pg_proc
              where oid in ('public.reactivar_usuario(uuid, timestamptz)'::regprocedure, 'public.aceptar_invitacion()'::regprocedure,
                            v_f::regprocedure)
                and not (prosecdef and proconfig @> array['search_path=""'])) then
    raise exception 'una RPC de acceso no es definidor con search_path vacío';
  end if;
  if position('calesa:roles' in v_s) = 0 or position('calesa:roles' in v_s) > position('select' in v_s) then
    raise exception 'asignar_rol no toma el candado de roles antes de leer';
  end if;
end $$;
rollback;
