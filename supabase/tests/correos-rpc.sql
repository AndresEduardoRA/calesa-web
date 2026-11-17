-- El registro de correos (X6, §3 l. 264 y 296; paso P27, C1–C6): registrar_correo, correo_por_referencia, correo_por_id y
-- correos_programados_de. Sólo service_role (el servidor, con el cliente admin; P29 es el adaptador). Cada bloque deja la base como
-- estaba. La respuesta es la fila con las 14 claves de FilaDeCorreo (src/modules/notificaciones/entities/registro.ts).

-- @test registrar: enviado, programado y fallido · las 14 claves, la respuesta es la fila y la fila es lo pedido (C1, C4)
begin;
create function pg_temp.fila(p_id uuid) returns jsonb language sql stable as $f$
  select jsonb_build_object('id', c.id, 'para', c.para::text, 'plantilla', c.plantilla, 'datos', c.datos, 'adjuntoIcs', c.adjunto_ics,
    'estado', c.estado, 'resendId', c.resend_id, 'programadoPara', c.programado_para, 'intentos', c.intentos,
    'ultimoError', c.ultimo_error, 'enviadoEn', c.enviado_en, 'referencia', c.referencia, 'reunionId', c.reunion_id,
    'solicitudId', c.solicitud_id)
    from public.correos_salientes c where c.id = p_id
$f$;
do $$
declare
  v_claves constant text[] := array['id', 'para', 'plantilla', 'datos', 'adjuntoIcs', 'estado', 'resendId', 'programadoPara',
    'intentos', 'ultimoError', 'enviadoEn', 'referencia', 'reunionId', 'solicitudId'];
  v_r constant uuid := gen_random_uuid();
  v_s constant uuid := gen_random_uuid();
  v_t constant timestamptz := date_trunc('second', now()) + interval '2 days';
  v_sin_ref bigint := (select count(*) from public.correos_salientes where referencia is null);
  r jsonb;
  c public.correos_salientes;
begin
  -- enviado, con dos destinatarios (V12) y todo lleno
  r := public.registrar_correo(p_para => 'a@x.test, b@y.test', p_plantilla => 'confirmacion', p_datos => '{"nombre": "Ana"}',
    p_estado => 'enviado', p_intentos => 1, p_adjunto_ics => 'BEGIN:VCALENDAR', p_resend_id => 're_e', p_enviado_en => v_t,
    p_referencia => 'confirmacion:1', p_reunion_id => v_r, p_solicitud_id => v_s);
  select * into c from public.correos_salientes where id = (r ->> 'id')::uuid;
  if c.id is null or not pruebas.claves(r, v_claves) or r is distinct from pg_temp.fila(c.id) then
    raise exception 'enviado: la respuesta no es la fila con sus 14 claves: %', r;
  end if;
  if (c.para::text, c.plantilla, c.datos, c.adjunto_ics, c.estado, c.resend_id, c.programado_para, c.intentos, c.ultimo_error,
      c.enviado_en, c.referencia, c.reunion_id, c.solicitud_id)
     is distinct from ('a@x.test, b@y.test'::text, 'confirmacion'::text, '{"nombre": "Ana"}'::jsonb, 'BEGIN:VCALENDAR'::text,
      'enviado'::public.estado_correo, 're_e'::text, null::timestamptz, 1, null::text, v_t, 'confirmacion:1'::text, v_r, v_s)
     or (r ->> 'enviadoEn')::timestamptz <> v_t or r -> 'programadoPara' <> 'null'::jsonb then
    raise exception 'enviado: la fila no es lo pedido: %', r;
  end if;

  -- programado, sin referencia ni ids
  r := public.registrar_correo(p_para => 'c@x.test', p_plantilla => 'recordatorio-24h', p_datos => '{}', p_estado => 'programado',
    p_programado_para => v_t);
  select * into c from public.correos_salientes where id = (r ->> 'id')::uuid;
  if c.id is null or not pruebas.claves(r, v_claves) or r is distinct from pg_temp.fila(c.id) then
    raise exception 'programado: la respuesta no es la fila con sus 14 claves: %', r;
  end if;
  if (c.para::text, c.estado, c.resend_id, c.programado_para, c.intentos, c.ultimo_error, c.enviado_en, c.referencia, c.reunion_id)
     is distinct from ('c@x.test'::text, 'programado'::public.estado_correo, null::text, v_t, 0, null::text, null::timestamptz,
      null::text, null::uuid)
     or (r ->> 'programadoPara')::timestamptz <> v_t or r -> 'enviadoEn' <> 'null'::jsonb then
    raise exception 'programado: la fila no es lo pedido: %', r;
  end if;

  -- fallido, con un error largo del proveedor: queda en 1000
  r := public.registrar_correo(p_para => 'd@x.test', p_plantilla => 'confirmacion', p_datos => '{"n": 1}', p_estado => 'fallido',
    p_intentos => 3, p_ultimo_error => repeat('e', 1500));
  select * into c from public.correos_salientes where id = (r ->> 'id')::uuid;
  if c.id is null or not pruebas.claves(r, v_claves) or r is distinct from pg_temp.fila(c.id) then
    raise exception 'fallido: la respuesta no es la fila con sus 14 claves: %', r;
  end if;
  if (c.estado, c.intentos, c.ultimo_error, c.programado_para, c.enviado_en)
     is distinct from ('fallido'::public.estado_correo, 3, repeat('e', 1000), null::timestamptz, null::timestamptz) then
    raise exception 'fallido: la fila no es lo pedido (estado %, intentos %, error de %)', c.estado, c.intentos,
      char_length(c.ultimo_error);
  end if;

  -- las dos sin referencia conviven
  if (select count(*) from public.correos_salientes where referencia is null) <> v_sin_ref + 2 then
    raise exception 'dos correos sin referencia no conviven';
  end if;
end $$;
rollback;

-- @test registrar: duplicado · la misma referencia da 23505 con su texto y su campo, y la fila no cambia (C2, C4)
begin;
do $$
declare
  v_id uuid;
  v_antes jsonb;
  v_sql constant text := $q$select public.registrar_correo(p_para => 'b@x.test', p_plantilla => 'otra', p_datos => '{"x": 1}',
    p_estado => 'programado', p_programado_para => now() + interval '1 day', p_referencia => 'dup:1')$q$;
begin
  v_id := (public.registrar_correo(p_para => 'a@x.test', p_plantilla => 'confirmacion', p_datos => '{}', p_estado => 'enviado',
    p_enviado_en => now(), p_referencia => 'dup:1') ->> 'id')::uuid;
  select to_jsonb(c) into v_antes from public.correos_salientes c where c.id = v_id;
  perform pruebas.error('duplicado', 'service_role', v_sql, '23505', 'Ya existe un correo con esa referencia.');
  perform pruebas.caso('duplicado con su campo', 'service_role', v_sql, 'error=23505:p_referencia');
  if (select count(*) from public.correos_salientes where referencia = 'dup:1') <> 1
     or (select to_jsonb(c) from public.correos_salientes c where c.id = v_id) is distinct from v_antes then
    raise exception 'el duplicado cambió algo';
  end if;
end $$;
rollback;

-- @test registrar: validación · cada dato inválido da 22023 con su campo y no inserta nada (C2, C4)
begin;
do $$
declare
  v_n bigint := (select count(*) from public.correos_salientes);
  v_base constant text := $q$p_plantilla => 'confirmacion', p_datos => '{}', p_estado => 'enviado', p_enviado_en => now()$q$;
  v_casos constant text[][] := array[
    ['p_para => null, ' || v_base, 'p_para'],
    ['p_para => ''sin-arroba'', ' || v_base, 'p_para'],
    ['p_para => ''a@x.test,malo'', ' || v_base, 'p_para'],
    ['p_para => ''' || repeat('a', 994) || '@x.test'', ' || v_base, 'p_para'],
    [$q$p_para => 'a@x.test', p_plantilla => '', p_datos => '{}', p_estado => 'enviado', p_enviado_en => now()$q$, 'p_plantilla'],
    ['p_para => ''a@x.test'', p_plantilla => ''' || repeat('p', 81) || ''', p_datos => ''{}'', p_estado => ''enviado'', '
      || 'p_enviado_en => now()', 'p_plantilla'],
    [$q$p_para => 'a@x.test', p_plantilla => 'c', p_datos => null, p_estado => 'enviado', p_enviado_en => now()$q$, 'p_datos'],
    [$q$p_para => 'a@x.test', p_plantilla => 'c', p_datos => '[]', p_estado => 'enviado', p_enviado_en => now()$q$, 'p_datos'],
    [$q$p_para => 'a@x.test', p_plantilla => 'c', p_datos => '{}', p_estado => null, p_enviado_en => now()$q$, 'p_estado'],
    [$q$p_para => 'a@x.test', p_plantilla => 'c', p_datos => '{}', p_estado => 'cancelado'$q$, 'p_estado'],
    [$q$p_para => 'a@x.test', p_intentos => null, $q$ || v_base, 'p_intentos'],
    [$q$p_para => 'a@x.test', p_intentos => -1, $q$ || v_base, 'p_intentos'],
    [$q$p_para => 'a@x.test', p_plantilla => 'c', p_datos => '{}', p_estado => 'programado'$q$, 'p_programado_para'],
    [$q$p_para => 'a@x.test', p_plantilla => 'c', p_datos => '{}', p_estado => 'enviado'$q$, 'p_enviado_en'],
    [$q$p_para => 'a@x.test', p_plantilla => 'c', p_datos => '{}', p_estado => 'fallido'$q$, 'p_ultimo_error'],
    [$q$p_para => 'a@x.test', p_plantilla => 'c', p_datos => '{}', p_estado => 'fallido', p_ultimo_error => ''$q$, 'p_ultimo_error'],
    [$q$p_para => 'a@x.test', p_referencia => '', $q$ || v_base, 'p_referencia'],
    ['p_para => ''a@x.test'', p_referencia => ''' || repeat('r', 257) || ''', ' || v_base, 'p_referencia']];
  i int;
begin
  for i in 1 .. array_length(v_casos, 1) loop
    perform pruebas.caso('validación ' || i, 'service_role', 'select public.registrar_correo(' || v_casos[i][1] || ')',
      'error=22023:' || v_casos[i][2]);
  end loop;
  if (select count(*) from public.correos_salientes) <> v_n then
    raise exception 'un dato inválido insertó algo';
  end if;
  -- en el borde: 256 de referencia y 1000 de para se aceptan
  perform pruebas.caso('referencia de 256', 'service_role', 'select public.registrar_correo(p_para => ''a@x.test'', p_referencia => '''
    || repeat('r', 256) || ''', ' || v_base || ')', 'filas=1');
  perform pruebas.caso('para de 1000', 'service_role', 'select public.registrar_correo(p_para => ''' || repeat('a', 993)
    || '@x.test'', ' || v_base || ')', 'filas=1');
end $$;
rollback;

-- @test leer: por referencia y por id · lo mismo que se registró; sin fila, null; sin argumento, 22023 (C1, C5)
begin;
do $$
declare
  r jsonb;
begin
  r := public.registrar_correo(p_para => 'a@x.test', p_plantilla => 'recordatorio-1h', p_datos => '{"hora": "10:00"}',
    p_estado => 'programado', p_programado_para => now() + interval '1 day', p_resend_id => 're_l', p_referencia => 'lee:1');
  if public.correo_por_referencia('lee:1') is distinct from r or public.correo_por_id((r ->> 'id')::uuid) is distinct from r then
    raise exception 'leer no devuelve lo registrado';
  end if;
  if public.correo_por_referencia('lee:otra') is not null or public.correo_por_id(gen_random_uuid()) is not null then
    raise exception 'sin fila no es null';
  end if;
  perform pruebas.caso('sin referencia', 'service_role', 'select public.correo_por_referencia(null)', 'error=22023:p_referencia');
  perform pruebas.caso('sin id', 'service_role', 'select public.correo_por_id(null)', 'error=22023:p_id');
end $$;
rollback;

-- @test leer: programados de una reunión o de una solicitud · sólo los programados, por hora; tope acotado; uno de los dos ids (C1, C6)
begin;
do $$
declare
  v_t constant timestamptz := date_trunc('second', now()) + interval '1 day';
  v_r constant uuid := gen_random_uuid();
  v_s constant uuid := gen_random_uuid();
  v_r2 constant uuid := gen_random_uuid();
  v_otra constant uuid := gen_random_uuid();
  r jsonb;
begin
  insert into public.correos_salientes (para, plantilla, estado, programado_para, reunion_id, solicitud_id) values
    ('a@x.test', 'r2', 'programado', v_t + interval '2 hours', v_r, null),
    ('a@x.test', 'r1', 'programado', v_t + interval '1 hour', v_r, null),
    ('a@x.test', 'rc', 'cancelado', v_t, v_r, null),
    ('a@x.test', 're', 'enviado', v_t, v_r, null),
    ('a@x.test', 'ro', 'programado', v_t, v_otra, null),
    ('a@x.test', 's2', 'programado', v_t + interval '2 hours', null, v_s),
    ('a@x.test', 's1', 'programado', v_t + interval '1 hour', null, v_s),
    ('a@x.test', 'sc', 'cancelado', v_t, null, v_s);
  r := public.correos_programados_de(p_reunion_id => v_r);
  if jsonb_array_length(r) <> 2 or not pruebas.claves(r, array['id', 'para', 'plantilla', 'datos', 'adjuntoIcs', 'estado',
       'resendId', 'programadoPara', 'intentos', 'ultimoError', 'enviadoEn', 'referencia', 'reunionId', 'solicitudId'])
     or r -> 0 ->> 'plantilla' <> 'r1' or r -> 1 ->> 'plantilla' <> 'r2'
     or (r -> 0 ->> 'programadoPara')::timestamptz <> v_t + interval '1 hour' then
    raise exception 'programados de la reunión: %', r;
  end if;
  r := public.correos_programados_de(p_solicitud_id => v_s);
  if jsonb_array_length(r) <> 2 or r -> 0 ->> 'plantilla' <> 's1' or r -> 1 ->> 'plantilla' <> 's2' then
    raise exception 'programados de la solicitud: %', r;
  end if;
  r := public.correos_programados_de(p_reunion_id => v_r, p_tope => 1);
  if jsonb_array_length(r) <> 1 or r -> 0 ->> 'plantilla' <> 'r1' then
    raise exception 'tope 1: %', r;
  end if;

  -- 101 de una reunión, con horas crecientes insertadas en desorden: el tope corta los más próximos
  insert into public.correos_salientes (para, plantilla, estado, programado_para, reunion_id)
  select 'a@x.test', 'g' || g, 'programado', v_t + g * interval '1 minute', v_r2
    from generate_series(1, 101) g order by (g * 37) % 101;
  r := public.correos_programados_de(p_reunion_id => v_r2);
  if jsonb_array_length(r) <> 50 or r -> 0 ->> 'plantilla' <> 'g1' or r -> 49 ->> 'plantilla' <> 'g50' then
    raise exception 'tope nulo: % filas, de % a %', jsonb_array_length(r), r -> 0 ->> 'plantilla', r -> -1 ->> 'plantilla';
  end if;
  if jsonb_array_length(public.correos_programados_de(p_reunion_id => v_r2, p_tope => 1000)) <> 100
     or jsonb_array_length(public.correos_programados_de(p_reunion_id => v_r2, p_tope => 0)) <> 1
     or jsonb_array_length(public.correos_programados_de(p_reunion_id => v_r2, p_tope => -5)) <> 1 then
    raise exception 'el tope no se acota a 1..100';
  end if;

  if public.correos_programados_de(p_reunion_id => gen_random_uuid()) <> '[]'::jsonb then
    raise exception 'sin filas no da []';
  end if;
  perform pruebas.caso('sin ids', 'service_role', 'select public.correos_programados_de()', 'error=22023:p_reunion_id');
  perform pruebas.caso('los dos ids', 'service_role', format('select public.correos_programados_de(%L, %L)', v_r, v_s),
    'error=22023:p_reunion_id');
end $$;
rollback;

-- @test grants y forma · sólo service_role; definidor con search_path vacío; ayudantes internos sin definidor (C3)
begin;
select pruebas.caso('anon', 'anon', 'select public.correo_por_id(gen_random_uuid())', 'error=42501');
select pruebas.caso('vendedora', 'V1', 'select public.correo_por_id(gen_random_uuid())', 'error=42501');
select pruebas.caso('admin', 'A', 'select public.correo_por_id(gen_random_uuid())', 'error=42501');
select pruebas.caso('servidor', 'service_role', 'select public.correo_por_id(gen_random_uuid())', 'filas=1');
do $$
declare
  f regproc;
begin
  foreach f in array array['public.registrar_correo', 'public.correo_por_referencia', 'public.correo_por_id',
    'public.correos_programados_de']::regproc[] loop
    if not (select p.prosecdef and coalesce(p.proconfig @> array['search_path=""'], false) from pg_proc p where p.oid = f) then
      raise exception '% no es de definidor con search_path vacío', f;
    end if;
    if not has_function_privilege('service_role', f, 'execute') or has_function_privilege('authenticated', f, 'execute')
       or has_function_privilege('anon', f, 'execute') then
      raise exception '% no es sólo de service_role', f;
    end if;
    if exists (select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x
                where p.oid = f and x.grantee = 0) then
      raise exception 'PUBLIC ejecuta %', f;
    end if;
  end loop;
  foreach f in array array['public._correo_json', 'public._correo_invalido']::regproc[] loop
    if (select p.prosecdef or not coalesce(p.proconfig @> array['search_path=""'], false) from pg_proc p where p.oid = f) then
      raise exception '% es de definidor o no fija search_path vacío', f;
    end if;
    if has_function_privilege('authenticated', f, 'execute') or has_function_privilege('anon', f, 'execute') then
      raise exception 'authenticated o anon ejecutan %', f;
    end if;
  end loop;
end $$;
rollback;
