-- Crear una solicitud (semilla §5.6 l. 512, R4.9, R4.19, R2.2; paso P30, C2–C5, C4b, C7, C15). `crear_o_juntar_solicitud` es sólo de
-- `service_role`: aquí corre como postgres, y los grants van con `pruebas.caso`. A = …01, V1 = …02, V2 = …03, V3 = …04 (inactivo);
-- V4 = …05 lo crea el bloque que lo usa. LU-01 es un enlace de V2. Cada bloque deja la base como estaba.

-- @test crear: reparto · menos solicitudes en la semana; las de la semana pasada no cuentan; fuera de turno no recibe
begin;
do $$
declare
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  v2 constant uuid := '00000000-0000-4000-8000-000000000003';
  r jsonb;
begin
  -- V2 tiene dos de la semana pasada (S2 y otra): si contaran, empataría con V1 y ganaría V1 por id.
  perform pruebas.solicitud(v2);
  update public.solicitudes set creado_en = now() - interval '8 days';
  perform pruebas.solicitud(v1), pruebas.solicitud(v1), pruebas.solicitud(v2);
  r := public.crear_o_juntar_solicitud('formulario', 'Nueva Uno', 'n1@ejemplo.test', now(), 'Imp Uno', 'BO', '+59171000001', 10);
  if r #>> '{asignado,id}' is distinct from v2::text then
    raise exception 'con 2 y 1 no fue a quien tiene menos: %', r;
  end if;
  update public.perfiles set en_turno = false where id = v2;
  r := public.crear_o_juntar_solicitud('formulario', 'Nueva Dos', 'n2@ejemplo.test', now(), 'Imp Dos', 'BO', '+59171000002', 10);
  if r #>> '{asignado,id}' is distinct from v1::text then
    raise exception 'un vendedor fuera de turno recibió: %', r;
  end if;
end $$;
rollback;

-- @test crear: reparto · con el mismo conteo, la última más antigua; sin ninguna, el perfil más antiguo
begin;
do $$
declare
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  v2 constant uuid := '00000000-0000-4000-8000-000000000003';
  v_lunes timestamptz := date_trunc('week', now() at time zone 'America/La_Paz') at time zone 'America/La_Paz';
  v_vieja uuid;
  r jsonb;
begin
  update public.solicitudes set creado_en = now() - interval '8 days';
  v_vieja := pruebas.solicitud(v1);
  update public.solicitudes set creado_en = v_lunes where id = v_vieja;
  perform pruebas.solicitud(v2);
  r := public.crear_o_juntar_solicitud('formulario', 'Nueva Uno', 'n1@ejemplo.test', now(), 'Imp Uno', 'BO', '+59171000001', 10);
  if r #>> '{asignado,id}' is distinct from v1::text then
    raise exception 'con 1 y 1 no fue a quien tiene la última más antigua: %', r;
  end if;
  update public.solicitudes set asignado_a = null where asignado_a is not null;
  update public.perfiles set creado_en = creado_en - interval '1 day' where id = v2;
  r := public.crear_o_juntar_solicitud('formulario', 'Nueva Dos', 'n2@ejemplo.test', now(), 'Imp Dos', 'BO', '+59171000002', 10);
  if r #>> '{asignado,id}' is distinct from v2::text then
    raise exception 'con 0 y 0 sin ninguna no fue al perfil más antiguo: %', r;
  end if;
end $$;
rollback;

-- @test crear: reparto · con el mismo conteo, sin ninguna va antes que con una vieja, aunque su perfil sea más nuevo
begin;
do $$
declare
  v4 constant uuid := '00000000-0000-4000-8000-000000000005';
  r jsonb;
begin
  update public.solicitudes set creado_en = now() - interval '8 days';
  update public.perfiles set en_turno = false where id = '00000000-0000-4000-8000-000000000002';
  insert into auth.users (id, email) values (v4, 'v4@ejemplo.test');
  insert into public.perfiles (id, nombre, email, rol, whatsapp, enlace_meet, en_turno)
  values (v4, 'Vendedor Cuatro', 'v4@ejemplo.test', 'vendedor', '+59170000005', 'https://meet.google.com/vvv-cuat-roo', true);
  r := public.crear_o_juntar_solicitud('formulario', 'Nueva Uno', 'n1@ejemplo.test', now(), 'Imp Uno', 'BO', '+59171000001', 10);
  if r #>> '{asignado,id}' is distinct from v4::text then
    raise exception 'quien no tiene ninguna no fue primero: %', r;
  end if;
end $$;
rollback;

-- @test crear: respaldo · sin vendedores en turno, el admin en turno; si tampoco, sin asignar (R4.9)
begin;
do $$
declare
  a constant uuid := '00000000-0000-4000-8000-000000000001';
  r jsonb;
begin
  update public.perfiles set en_turno = false where rol = 'vendedor';
  update public.perfiles set whatsapp = '+59170000001', enlace_meet = 'https://meet.google.com/adm-inis-tra', en_turno = true
   where id = a;
  r := public.crear_o_juntar_solicitud('formulario', 'Nueva Uno', 'n1@ejemplo.test', now(), 'Imp Uno', 'BO', '+59171000001', 10);
  if r #>> '{asignado,id}' is distinct from a::text then
    raise exception 'no fue al admin en turno: %', r;
  end if;
  update public.perfiles set activo = false where id = a;
  r := public.crear_o_juntar_solicitud('formulario', 'Nueva Dos', 'n2@ejemplo.test', now(), 'Imp Dos', 'BO', '+59171000002', 10);
  if r -> 'asignado' is distinct from 'null'::jsonb then
    raise exception 'un admin inactivo recibió: %', r;
  end if;
  update public.perfiles set activo = true, en_turno = false where id = a;
  r := public.crear_o_juntar_solicitud('formulario', 'Nueva Tres', 'n3@ejemplo.test', now(), 'Imp Tres', 'BO', '+59171000003', 10);
  if r -> 'asignado' is distinct from 'null'::jsonb
     or (select asignado_a from public.solicitudes where id = (r ->> 'id')::uuid) is not null then
    raise exception 'sin nadie en turno no quedó sin asignar: %', r;
  end if;
end $$;
rollback;

-- @test crear: prospección · el código en mayúsculas va al creador activo; inactivo, inexistente o sin creador: reparto (R4.19, C4b)
begin;
do $$
declare
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  v2 constant uuid := '00000000-0000-4000-8000-000000000003';
  r jsonb;
  v_s public.solicitudes;
  v_con uuid;
  v_sin uuid;
begin
  update public.perfiles set en_turno = false where id = v2;
  r := public.crear_o_juntar_solicitud('formulario', 'Pros Uno', 'p1@ejemplo.test', now(), 'Imp', 'BO', '+59171000001', 10,
    p_ref_codigo => 'lu-01 ');
  select * into v_s from public.solicitudes where id = (r ->> 'id')::uuid;
  if v_s.asignado_a is distinct from v2 or v_s.origen <> 'prospeccion' or v_s.ref_codigo is distinct from 'LU-01'
     or r ->> 'origen' <> 'prospeccion' then
    raise exception 'el enlace no fue a su creador: %', r;
  end if;
  r := public.crear_o_juntar_solicitud('formulario', 'Pros Dos', 'p2@ejemplo.test', now(), 'Imp', 'BO', '+59171000001', 10,
    p_ref_codigo => 'ZZ-99');
  select * into v_s from public.solicitudes where id = (r ->> 'id')::uuid;
  if v_s.asignado_a is distinct from v1 or v_s.origen <> 'formulario' or v_s.ref_codigo is not null then
    raise exception 'un código inexistente no se ignoró: %', r;
  end if;
  r := public.crear_o_juntar_solicitud(p_origen => 'calculadora', p_nombre => 'Calc Uno', p_email => 'c1@ejemplo.test',
    p_consentimiento_en => now(), p_calc_margen => 500, p_ref_codigo => 'LU-01');
  select * into v_s from public.solicitudes where id = (r ->> 'id')::uuid;
  if v_s.asignado_a is distinct from v2 or v_s.origen <> 'calculadora' or v_s.ref_codigo is distinct from 'LU-01'
     or public._limitar_a(v_s.id) is distinct from v2 then
    raise exception 'la calculadora con enlace no fue al creador ni limitó su agenda: %', r;
  end if;
  v_con := pruebas.solicitud(v1, 'nueva', 'formulario', 'LU-01');
  v_sin := pruebas.solicitud(v1);
  if public._limitar_a(v_con) is distinct from v2 or public._limitar_a(v_sin) is not null then
    raise exception '_limitar_a no mira ref_codigo sin importar el origen';
  end if;
  update public.perfiles set activo = false where id = v2;
  r := public.crear_o_juntar_solicitud('formulario', 'Pros Tres', 'p3@ejemplo.test', now(), 'Imp', 'BO', '+59171000001', 10,
    p_ref_codigo => 'LU-01');
  select * into v_s from public.solicitudes where id = (r ->> 'id')::uuid;
  if v_s.asignado_a is distinct from v1 or v_s.origen <> 'prospeccion' or v_s.ref_codigo is distinct from 'LU-01' then
    raise exception 'con el creador inactivo no fue al reparto: %', r;
  end if;
  update public.perfiles set activo = true where id = v2;
  update public.enlaces_prospeccion set activo = false where codigo = 'LU-01';
  r := public.crear_o_juntar_solicitud('formulario', 'Pros Cuatro', 'p4@ejemplo.test', now(), 'Imp', 'BO', '+59171000001', 10,
    p_ref_codigo => 'LU-01');
  select * into v_s from public.solicitudes where id = (r ->> 'id')::uuid;
  if v_s.asignado_a is distinct from v1 or v_s.origen <> 'formulario' or v_s.ref_codigo is not null then
    raise exception 'un enlace inactivo no se ignoró: %', r;
  end if;
end $$;
rollback;

-- @test crear: respuesta exacta y validación · un dato inválido es 22023 con su campo y no inserta nada (C5, C7)
begin;
do $$
declare
  r jsonb;
begin
  r := public.crear_o_juntar_solicitud('formulario', 'Nueva Uno', 'n1@ejemplo.test', now(), 'Imp Uno', 'BO', '+59171000001', 10);
  if not pruebas.claves(r, array['id', 'juntada', 'origen', 'estado', 'creadoEn', 'asignado'])
     or not pruebas.claves(r -> 'asignado', array['id', 'nombre', 'email', 'whatsapp'])
     or r -> 'juntada' <> 'false'::jsonb or r ->> 'estado' <> 'nueva' or r ->> 'origen' <> 'formulario'
     or (select ultimo_contacto_en from public.solicitudes where id = (r ->> 'id')::uuid) <> now() then
    raise exception 'la respuesta de crear no es la de C7: %', r;
  end if;
  update public.perfiles set en_turno = false;
  r := public.crear_o_juntar_solicitud('formulario', 'Nueva Dos', 'n2@ejemplo.test', now(), 'Imp Dos', 'BO', '+59171000002', 10);
  if r -> 'asignado' is distinct from 'null'::jsonb then
    raise exception 'sin asignado no da null: %', r;
  end if;
end $$;
select pruebas.caso('origen prospección', 'service_role', $$select public.crear_o_juntar_solicitud('prospeccion', 'Nombre',
  'x1@ejemplo.test', now(), 'Imp', 'BO', '+59171000001', 10)$$, 'error=22023:p_origen');
select pruebas.caso('origen nulo', 'service_role', $$select public.crear_o_juntar_solicitud(null, 'Nombre', 'x2@ejemplo.test', now(),
  'Imp', 'BO', '+59171000001', 10)$$, 'error=22023:p_origen');
select pruebas.caso('nombre corto', 'service_role', $$select public.crear_o_juntar_solicitud('formulario', 'N', 'x3@ejemplo.test',
  now(), 'Imp', 'BO', '+59171000001', 10)$$, 'error=22023:solicitudes_nombre_check');
select pruebas.caso('país', 'service_role', $$select public.crear_o_juntar_solicitud('formulario', 'Nombre', 'x4@ejemplo.test',
  now(), 'Imp', 'ZZ', '+59171000001', 10)$$, 'error=22023:solicitudes_pais_check');
select pruebas.caso('sin consentimiento', 'service_role', $$select public.crear_o_juntar_solicitud('formulario', 'Nombre',
  'x5@ejemplo.test', null, 'Imp', 'BO', '+59171000001', 10)$$, 'error=22023:consentimiento_en');
select pruebas.caso('sin importadora', 'service_role', $$select public.crear_o_juntar_solicitud('formulario', 'Nombre',
  'x6@ejemplo.test', now(), null, 'BO', '+59171000001', 10)$$, 'error=22023:solicitudes_obligatorios_fuera_de_calculadora');
do $$
begin
  if exists (select 1 from public.solicitudes where email::text like 'x_@ejemplo.test') then
    raise exception 'un dato inválido dejó una solicitud';
  end if;
end $$;
rollback;

-- @test crear: grants y forma · sólo service_role; definidor con search_path vacío; candado de solicitudes; ayudantes internos
begin;
select pruebas.caso('anon', 'anon', $$select public.crear_o_juntar_solicitud('formulario', 'Nombre', 'g1@ejemplo.test', now(),
  'Imp', 'BO', '+59171000001', 10)$$, 'error=42501');
select pruebas.caso('admin', 'A', $$select public.crear_o_juntar_solicitud('formulario', 'Nombre', 'g2@ejemplo.test', now(),
  'Imp', 'BO', '+59171000001', 10)$$, 'error=42501');
select pruebas.caso('vendedora', 'V1', $$select public.crear_o_juntar_solicitud('formulario', 'Nombre', 'g3@ejemplo.test', now(),
  'Imp', 'BO', '+59171000001', 10)$$, 'error=42501');
select pruebas.caso('servidor', 'service_role', $$select public.crear_o_juntar_solicitud('formulario', 'Nombre', 'g4@ejemplo.test',
  now(), 'Imp', 'BO', '+59171000001', 10)$$, 'filas=1');
do $$
declare
  v_p record;
begin
  select p.prosecdef, p.proconfig, p.prosrc into v_p from pg_proc p
   where p.oid = 'public.crear_o_juntar_solicitud'::regproc;
  if not v_p.prosecdef or not coalesce(v_p.proconfig @> array['search_path=""'], false)
     or v_p.prosrc !~ '_bloquear_solicitudes\(\)' then
    raise exception 'crear_o_juntar_solicitud no es definidor con search_path vacío y candado: %', v_p.proconfig;
  end if;
  if has_function_privilege('authenticated', 'public._bloquear_solicitudes()', 'execute')
     or has_function_privilege('authenticated', 'public._elegir_asignado(jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public._juntar_solicitud(public.solicitudes, public.solicitudes)', 'execute')
     or has_function_privilege('authenticated', 'public._limitar_a(uuid)', 'execute') then
    raise exception 'authenticated ejecuta un ayudante interno de crear';
  end if;
end $$;
rollback;
