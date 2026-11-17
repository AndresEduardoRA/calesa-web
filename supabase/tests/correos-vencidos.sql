-- Los correos vencidos (X6; paso P27, C7, C13): programados sin resend_id (nadie los programó en Resend) con su hora ya pasada, los
-- más viejos primero, para el despacho de P07. La hora la pone quien llama. Índice correos_salientes_vencidos, probado con volumen
-- sobre el plan genérico (no hay db:medir:volumen). Sólo service_role. Cada bloque deja la base como estaba.

-- @test vencidos: conducta · sólo programados sin resend_id con hora ≤ ahora, por hora y id; tope; sin hora, 22023 (C7)
begin;
do $$
declare
  v_t constant timestamptz := now();
  -- Ids explícitos e insertados en desorden de hora: un recorrido con `limit` sin `order by` daría t y t−1 h (id mayor).
  e_t constant uuid := 'c0000000-0000-4000-8000-000000000003';
  e_1h_mayor constant uuid := 'c0000000-0000-4000-8000-000000000009';
  e_2h constant uuid := 'c0000000-0000-4000-8000-000000000005';
  e_1h_menor constant uuid := 'c0000000-0000-4000-8000-000000000001';
  r jsonb;
  v_ids uuid[];
begin
  insert into public.correos_salientes (id, para, plantilla, estado, programado_para) values
    (e_t, 'a@x.test', 'v', 'programado', v_t);
  insert into public.correos_salientes (id, para, plantilla, estado, programado_para) values
    (e_1h_mayor, 'a@x.test', 'v', 'programado', v_t - interval '1 hour');
  insert into public.correos_salientes (id, para, plantilla, estado, programado_para) values
    (e_2h, 'a@x.test', 'v', 'programado', v_t - interval '2 hours');
  insert into public.correos_salientes (id, para, plantilla, estado, programado_para) values
    (e_1h_menor, 'a@x.test', 'v', 'programado', v_t - interval '1 hour');
  -- fuera: en el futuro, con resend_id, fallido, enviado y sin hora
  insert into public.correos_salientes (para, plantilla, estado, programado_para, resend_id) values
    ('a@x.test', 'f', 'programado', v_t + interval '1 minute', null),
    ('a@x.test', 'f', 'programado', v_t - interval '3 hours', 're_1'),
    ('a@x.test', 'f', 'fallido', v_t - interval '3 hours', null),
    ('a@x.test', 'f', 'enviado', v_t - interval '3 hours', null),
    ('a@x.test', 'f', 'programado', null, null);

  r := public.correos_vencidos(v_t);
  select array_agg((e ->> 'id')::uuid order by i) into v_ids from jsonb_array_elements(r) with ordinality x(e, i);
  if v_ids is distinct from array[e_2h, e_1h_menor, e_1h_mayor, e_t] then
    raise exception 'vencidos: %', v_ids;
  end if;
  if not pruebas.claves(r, array['id', 'para', 'plantilla', 'datos', 'adjuntoIcs', 'estado', 'resendId', 'programadoPara',
       'intentos', 'ultimoError', 'enviadoEn', 'referencia', 'reunionId', 'solicitudId'])
     or (r -> 0 ->> 'programadoPara')::timestamptz <> v_t - interval '2 hours' then
    raise exception 'vencidos: la respuesta no es la fila: %', r -> 0;
  end if;

  r := public.correos_vencidos(v_t, 2);
  select array_agg((e ->> 'id')::uuid order by i) into v_ids from jsonb_array_elements(r) with ordinality x(e, i);
  if v_ids is distinct from array[e_2h, e_1h_menor] then
    raise exception 'tope 2: %', v_ids;
  end if;

  if public.correos_vencidos(v_t - interval '1 day') <> '[]'::jsonb then
    raise exception 'sin vencidos no da []';
  end if;
  perform pruebas.caso('sin hora', 'service_role', 'select public.correos_vencidos(null)', 'error=22023:p_ahora');
end $$;
rollback;

-- @test vencidos: índice y volumen · 20 000 filas; el plan genérico usa correos_salientes_vencidos sin Seq Scan ni Sort (C7, C13)
begin;
do $$
declare
  v_def text := (select indexdef from pg_indexes where schemaname = 'public' and indexname = 'correos_salientes_vencidos');
  v_plan text := '';
  v_linea text;
  v_t constant timestamptz := now();
  r jsonb;
  v_src text := (select prosrc from pg_proc where oid = 'public.correos_vencidos'::regproc);
begin
  if v_def is null or v_def not like '%(programado_para, id)%'
     or v_def not like '%WHERE ((estado = ''programado''::estado_correo) AND (resend_id IS NULL))%' then
    raise exception 'el índice de vencidos no es (programado_para, id) where programado sin resend_id: %', v_def;
  end if;
  -- La consulta del plan es una copia de la de correos_vencidos: la forma de la función la ata a esta.
  if v_src !~ 'c\.resend_id is null' or v_src !~ 'order by c\.programado_para, c\.id\s+limit' then
    raise exception 'correos_vencidos no filtra resend_id is null u ordena por programado_para, id antes del limit';
  end if;

  -- 18 000 enviados, 1000 programados en Resend, 500 sin programar en el futuro y 500 vencidos (en desorden de hora)
  insert into public.correos_salientes (para, plantilla, estado, enviado_en)
  select 'a@x.test', 'vol', 'enviado', v_t - g * interval '1 minute' from generate_series(1, 18000) g;
  insert into public.correos_salientes (para, plantilla, estado, programado_para, resend_id)
  select 'a@x.test', 'vol', 'programado', v_t + (g - 500) * interval '1 minute', 're_' || g from generate_series(1, 1000) g;
  insert into public.correos_salientes (para, plantilla, estado, programado_para)
  select 'a@x.test', 'vol', 'programado', v_t + g * interval '1 minute' from generate_series(1, 500) g;
  insert into public.correos_salientes (para, plantilla, estado, programado_para)
  select 'a@x.test', 'vencido', 'programado', v_t - (1 + (g * 7) % 500) * interval '1 minute' from generate_series(1, 500) g;
  analyze public.correos_salientes;

  for v_linea in execute $q$explain (generic_plan, costs off)
    select coalesce(jsonb_agg(public._correo_json(x) order by x.programado_para, x.id), '[]'::jsonb)
      from (select c.* from public.correos_salientes c
             where c.estado = 'programado' and c.resend_id is null and c.programado_para <= $1
             order by c.programado_para, c.id limit $2) x$q$ loop
    v_plan := v_plan || v_linea || E'\n';
  end loop;
  if v_plan not like '%correos_salientes_vencidos%' or v_plan ~ 'Seq Scan' or v_plan ~ 'Sort' then
    raise exception 'el plan de vencidos no usa su índice o recorre u ordena: %', v_plan;
  end if;

  r := public.correos_vencidos(v_t, 1000);
  if jsonb_array_length(r) <> 100 or (r -> 0 ->> 'programadoPara')::timestamptz <> v_t - interval '500 minutes'
     or exists (select 1 from jsonb_array_elements(r) e where e ->> 'plantilla' <> 'vencido')
     or exists (select 1 from jsonb_array_elements(r) with ordinality a(e, i)
                  join jsonb_array_elements(r) with ordinality b(e, i) on b.i = a.i + 1
                 where (b.e ->> 'programadoPara')::timestamptz < (a.e ->> 'programadoPara')::timestamptz) then
    raise exception 'con volumen: % filas, la primera %', jsonb_array_length(r), r -> 0 ->> 'programadoPara';
  end if;
end $$;
rollback;

-- @test vencidos: grants y forma · sólo service_role; definidor con search_path vacío; estable (C3)
begin;
select pruebas.caso('anon', 'anon', 'select public.correos_vencidos(now())', 'error=42501');
select pruebas.caso('vendedora', 'V1', 'select public.correos_vencidos(now())', 'error=42501');
select pruebas.caso('admin', 'A', 'select public.correos_vencidos(now())', 'error=42501');
select pruebas.caso('servidor', 'service_role', 'select public.correos_vencidos(now())', 'filas=1');
do $$
declare
  f constant regproc := 'public.correos_vencidos'::regproc;
begin
  if not (select p.prosecdef and coalesce(p.proconfig @> array['search_path=""'], false) and p.provolatile = 's'
            from pg_proc p where p.oid = f) then
    raise exception 'correos_vencidos no es estable de definidor con search_path vacío';
  end if;
  if not has_function_privilege('service_role', f, 'execute') or has_function_privilege('authenticated', f, 'execute')
     or has_function_privilege('anon', f, 'execute') then
    raise exception 'correos_vencidos no es sólo de service_role';
  end if;
  if exists (select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x
              where p.oid = f and x.grantee = 0) then
    raise exception 'PUBLIC ejecuta correos_vencidos';
  end if;
end $$;
rollback;
