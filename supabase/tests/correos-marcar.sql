-- Mover el estado de un correo registrado (X6; paso P27, C8–C12): marcar_correo_enviado, _fallido, _cancelado y _reprogramado sobre
-- la tabla de transiciones (enviado es terminal; cancelar dos veces no es error). Sin versión: la fila se toma `for update` y se
-- valida su estado (P1a). Sólo service_role. Cada bloque deja la base como estaba.

-- @test marcar: enviado · desde programado y desde fallido; limpia el error y no toca la hora (C9)
begin;
do $$
declare
  v_t constant timestamptz := date_trunc('second', now());
  v_p uuid;
  v_f uuid;
  r jsonb;
  c public.correos_salientes;
begin
  insert into public.correos_salientes (para, plantilla, estado, programado_para, resend_id)
  values ('a@x.test', 'p', 'programado', v_t + interval '1 day', 're_p') returning id into v_p;
  insert into public.correos_salientes (para, plantilla, estado, resend_id, intentos, ultimo_error)
  values ('a@x.test', 'f', 'fallido', 're_f', 2, 'boom') returning id into v_f;

  r := public.marcar_correo_enviado(v_p, 1, v_t, 're_x');
  select * into c from public.correos_salientes where id = v_p;
  if not pruebas.claves(r, array['id', 'para', 'plantilla', 'datos', 'adjuntoIcs', 'estado', 'resendId', 'programadoPara',
       'intentos', 'ultimoError', 'enviadoEn', 'referencia', 'reunionId', 'solicitudId'])
     or (c.estado, c.resend_id, c.intentos, c.enviado_en, c.ultimo_error, c.programado_para)
        is distinct from ('enviado'::public.estado_correo, 're_x'::text, 1, v_t, null::text, v_t + interval '1 day')
     or r ->> 'estado' <> 'enviado' or (r ->> 'enviadoEn')::timestamptz <> v_t or (r ->> 'id')::uuid <> v_p then
    raise exception 'enviado desde programado: %', r;
  end if;

  r := public.marcar_correo_enviado(v_f, 3, v_t);
  select * into c from public.correos_salientes where id = v_f;
  if (c.estado, c.resend_id, c.intentos, c.enviado_en, c.ultimo_error)
     is distinct from ('enviado'::public.estado_correo, null::text, 3, v_t, null::text)
     or r -> 'resendId' <> 'null'::jsonb or r -> 'ultimoError' <> 'null'::jsonb then
    raise exception 'enviado desde fallido: %', r;
  end if;
end $$;
rollback;

-- @test marcar: fallido · desde programado y desde fallido; guarda el error (hasta 1000) y conserva resend_id y la hora (C10)
begin;
do $$
declare
  v_t constant timestamptz := date_trunc('second', now()) + interval '1 day';
  v_p uuid;
  v_f uuid;
  r jsonb;
  c public.correos_salientes;
begin
  insert into public.correos_salientes (para, plantilla, estado, programado_para, resend_id)
  values ('a@x.test', 'p', 'programado', v_t, 're_1') returning id into v_p;
  insert into public.correos_salientes (para, plantilla, estado, resend_id, intentos, ultimo_error)
  values ('a@x.test', 'f', 'fallido', 're_1', 1, 'viejo') returning id into v_f;

  r := public.marcar_correo_fallido(v_p, 1, 'Resend respondió 500');
  select * into c from public.correos_salientes where id = v_p;
  if (c.estado, c.intentos, c.ultimo_error, c.resend_id, c.programado_para)
     is distinct from ('fallido'::public.estado_correo, 1, 'Resend respondió 500'::text, 're_1'::text, v_t)
     or r ->> 'ultimoError' <> 'Resend respondió 500' or r ->> 'resendId' <> 're_1' then
    raise exception 'fallido desde programado: %', r;
  end if;

  r := public.marcar_correo_fallido(v_f, 2, repeat('e', 1500));
  select * into c from public.correos_salientes where id = v_f;
  if (c.estado, c.intentos, c.ultimo_error, c.resend_id)
     is distinct from ('fallido'::public.estado_correo, 2, repeat('e', 1000), 're_1'::text) then
    raise exception 'fallido desde fallido: intentos %, error de %, resend %', c.intentos, char_length(c.ultimo_error), c.resend_id;
  end if;
end $$;
rollback;

-- @test marcar: cancelado · desde programado y desde fallido sólo cambia el estado; sobre un cancelado devuelve lo mismo (C11)
begin;
do $$
declare
  v_p uuid;
  v_f uuid;
  v_antes jsonb;
  r jsonb;
begin
  insert into public.correos_salientes (para, plantilla, datos, estado, programado_para, resend_id, intentos, referencia, reunion_id)
  values ('a@x.test', 'p', '{"n": 1}', 'programado', now() + interval '1 day', 're_1', 1, 'canc:1', gen_random_uuid())
  returning id into v_p;
  insert into public.correos_salientes (para, plantilla, estado, programado_para, resend_id, intentos, ultimo_error, solicitud_id)
  values ('a@x.test', 'f', 'fallido', now() + interval '2 days', 're_2', 2, 'boom', gen_random_uuid()) returning id into v_f;

  select to_jsonb(c) into v_antes from public.correos_salientes c where c.id = v_p;
  r := public.marcar_correo_cancelado(v_p);
  if (select to_jsonb(c) - 'estado' from public.correos_salientes c where c.id = v_p) is distinct from v_antes - 'estado'
     or (select estado from public.correos_salientes where id = v_p) <> 'cancelado' or r ->> 'estado' <> 'cancelado' then
    raise exception 'cancelado desde programado cambió algo más que el estado: %', r;
  end if;
  if public.marcar_correo_cancelado(v_p) is distinct from r then
    raise exception 'cancelar dos veces no devuelve la misma fila';
  end if;

  select to_jsonb(c) into v_antes from public.correos_salientes c where c.id = v_f;
  r := public.marcar_correo_cancelado(v_f);
  if (select to_jsonb(c) - 'estado' from public.correos_salientes c where c.id = v_f) is distinct from v_antes - 'estado'
     or r ->> 'estado' <> 'cancelado' or r ->> 'ultimoError' <> 'boom' then
    raise exception 'cancelado desde fallido cambió algo más que el estado: %', r;
  end if;
end $$;
rollback;

-- @test marcar: reprogramado · nueva hora y error limpio; resend_id queda, se borra o se cambia según la bandera; desde fallido (C12)
begin;
do $$
declare
  v_t constant timestamptz := date_trunc('second', now()) + interval '3 days';
  v_p uuid;
  v_f uuid;
  r jsonb;
  c public.correos_salientes;
begin
  insert into public.correos_salientes (para, plantilla, estado, programado_para, resend_id, intentos, ultimo_error)
  values ('a@x.test', 'p', 'programado', now() + interval '1 day', 're_1', 2, 'x') returning id into v_p;
  insert into public.correos_salientes (para, plantilla, estado, resend_id, intentos, ultimo_error)
  values ('a@x.test', 'f', 'fallido', null, 4, 'boom') returning id into v_f;

  r := public.marcar_correo_reprogramado(v_p, v_t);
  select * into c from public.correos_salientes where id = v_p;
  if (c.estado, c.programado_para, c.resend_id, c.ultimo_error, c.intentos)
     is distinct from ('programado'::public.estado_correo, v_t, 're_1'::text, null::text, 2)
     or (r ->> 'programadoPara')::timestamptz <> v_t or r ->> 'resendId' <> 're_1' then
    raise exception 'reprogramado sin la bandera: %', r;
  end if;

  r := public.marcar_correo_reprogramado(v_p, v_t + interval '1 hour', p_cambiar_resend_id => true);
  if (select resend_id from public.correos_salientes where id = v_p) is not null or r -> 'resendId' <> 'null'::jsonb
     or (r ->> 'programadoPara')::timestamptz <> v_t + interval '1 hour' then
    raise exception 'reprogramado con la bandera y sin id no borró resend_id: %', r;
  end if;

  r := public.marcar_correo_reprogramado(v_p, v_t + interval '2 hours', 're_2', true);
  if (select resend_id from public.correos_salientes where id = v_p) is distinct from 're_2' or r ->> 'resendId' <> 're_2' then
    raise exception 'reprogramado con la bandera y un id no lo cambió: %', r;
  end if;

  r := public.marcar_correo_reprogramado(v_f, v_t);
  select * into c from public.correos_salientes where id = v_f;
  if (c.estado, c.programado_para, c.ultimo_error, c.intentos)
     is distinct from ('programado'::public.estado_correo, v_t, null::text, 4) then
    raise exception 'reprogramado desde fallido: %', r;
  end if;
end $$;
rollback;

-- @test marcar: transiciones prohibidas · enviado no pasa a nada; cancelado sólo a cancelado; P0001 con su texto y la fila igual (C2, C8)
begin;
do $$
declare
  v_e uuid;
  v_c uuid;
  v_antes_e jsonb;
  v_antes_c jsonb;
begin
  insert into public.correos_salientes (para, plantilla, estado, enviado_en, resend_id)
  values ('a@x.test', 'e', 'enviado', now(), 're_e') returning id into v_e;
  insert into public.correos_salientes (para, plantilla, estado, programado_para, resend_id)
  values ('a@x.test', 'c', 'cancelado', now() + interval '1 day', 're_c') returning id into v_c;
  select to_jsonb(c) into v_antes_e from public.correos_salientes c where c.id = v_e;
  select to_jsonb(c) into v_antes_c from public.correos_salientes c where c.id = v_c;

  perform pruebas.error('enviado → enviado', 'service_role', format('select public.marcar_correo_enviado(%L, 1, now())', v_e),
    'P0001', 'Un correo enviado no pasa a enviado.');
  perform pruebas.error('enviado → fallido', 'service_role', format('select public.marcar_correo_fallido(%L, 1, ''x'')', v_e),
    'P0001', 'Un correo enviado no pasa a fallido.');
  perform pruebas.error('enviado → cancelado', 'service_role', format('select public.marcar_correo_cancelado(%L)', v_e),
    'P0001', 'Un correo enviado no pasa a cancelado.');
  perform pruebas.error('enviado → programado', 'service_role',
    format('select public.marcar_correo_reprogramado(%L, now() + interval ''1 day'')', v_e),
    'P0001', 'Un correo enviado no pasa a programado.');
  perform pruebas.error('cancelado → enviado', 'service_role', format('select public.marcar_correo_enviado(%L, 1, now())', v_c),
    'P0001', 'Un correo cancelado no pasa a enviado.');
  perform pruebas.error('cancelado → fallido', 'service_role', format('select public.marcar_correo_fallido(%L, 1, ''x'')', v_c),
    'P0001', 'Un correo cancelado no pasa a fallido.');
  perform pruebas.error('cancelado → programado', 'service_role',
    format('select public.marcar_correo_reprogramado(%L, now() + interval ''1 day'')', v_c),
    'P0001', 'Un correo cancelado no pasa a programado.');

  if (select to_jsonb(c) from public.correos_salientes c where c.id = v_e) is distinct from v_antes_e
     or (select to_jsonb(c) from public.correos_salientes c where c.id = v_c) is distinct from v_antes_c then
    raise exception 'una transición prohibida cambió la fila';
  end if;
end $$;
rollback;

-- @test marcar: inexistente y validación · un id que no está da null; cada dato inválido, 22023 con su campo (C1, C2, C8, C12)
begin;
do $$
declare
  v_x constant uuid := gen_random_uuid();
  v_p uuid;
  v_n bigint := (select count(*) from public.correos_salientes);
  v_casos text[][];
  i int;
begin
  insert into public.correos_salientes (para, plantilla, estado, programado_para, resend_id)
  values ('a@x.test', 'p', 'programado', now() + interval '1 day', 're_1') returning id into v_p;

  perform pruebas.caso('no está: enviado', 'service_role',
    format('select public.marcar_correo_enviado(%L, 1, now()) is null', v_x), 'verdad');
  perform pruebas.caso('no está: fallido', 'service_role',
    format('select public.marcar_correo_fallido(%L, 1, ''x'') is null', v_x), 'verdad');
  perform pruebas.caso('no está: cancelado', 'service_role',
    format('select public.marcar_correo_cancelado(%L) is null', v_x), 'verdad');
  perform pruebas.caso('no está: reprogramado', 'service_role',
    format('select public.marcar_correo_reprogramado(%L, now()) is null', v_x), 'verdad');
  if (select count(*) from public.correos_salientes) <> v_n + 1 then
    raise exception 'marcar un id que no está cambió la tabla';
  end if;

  v_casos := array[
    ['select public.marcar_correo_enviado(null, 1, now())', 'p_id'],
    ['select public.marcar_correo_fallido(null, 1, ''x'')', 'p_id'],
    ['select public.marcar_correo_cancelado(null)', 'p_id'],
    ['select public.marcar_correo_reprogramado(null, now())', 'p_id'],
    [format('select public.marcar_correo_enviado(%L, null, now())', v_p), 'p_intentos'],
    [format('select public.marcar_correo_enviado(%L, -1, now())', v_p), 'p_intentos'],
    [format('select public.marcar_correo_enviado(%L, 1, null)', v_p), 'p_enviado_en'],
    [format('select public.marcar_correo_fallido(%L, null, ''x'')', v_p), 'p_intentos'],
    [format('select public.marcar_correo_fallido(%L, -1, ''x'')', v_p), 'p_intentos'],
    [format('select public.marcar_correo_fallido(%L, 1, null)', v_p), 'p_ultimo_error'],
    [format('select public.marcar_correo_fallido(%L, 1, '''')', v_p), 'p_ultimo_error'],
    [format('select public.marcar_correo_reprogramado(%L, null)', v_p), 'p_programado_para'],
    [format('select public.marcar_correo_reprogramado(%L, now(), p_cambiar_resend_id => null)', v_p), 'p_cambiar_resend_id'],
    [format('select public.marcar_correo_reprogramado(%L, now(), ''re_9'')', v_p), 'p_resend_id']];
  for i in 1 .. array_length(v_casos, 1) loop
    perform pruebas.caso('validación ' || i, 'service_role', v_casos[i][1], 'error=22023:' || v_casos[i][2]);
  end loop;
  if (select (estado, resend_id) from public.correos_salientes where id = v_p)
     is distinct from ('programado'::public.estado_correo, 're_1'::text) then
    raise exception 'un dato inválido cambió la fila';
  end if;
end $$;
rollback;

-- @test marcar: grants y forma · sólo service_role; definidor con search_path vacío; todas toman la fila con _tomar_correo (C3, C8)
begin;
select pruebas.caso('anon', 'anon', 'select public.marcar_correo_cancelado(gen_random_uuid())', 'error=42501');
select pruebas.caso('vendedora', 'V1', 'select public.marcar_correo_cancelado(gen_random_uuid())', 'error=42501');
select pruebas.caso('admin', 'A', 'select public.marcar_correo_cancelado(gen_random_uuid())', 'error=42501');
select pruebas.caso('servidor', 'service_role', 'select public.marcar_correo_cancelado(gen_random_uuid())', 'filas=1');
do $$
declare
  f regproc;
  v_tomar regproc := 'public._tomar_correo'::regproc;
begin
  foreach f in array array['public.marcar_correo_enviado', 'public.marcar_correo_fallido', 'public.marcar_correo_cancelado',
    'public.marcar_correo_reprogramado']::regproc[] loop
    if not (select p.prosecdef and coalesce(p.proconfig @> array['search_path=""'], false) and p.provolatile = 'v'
                   and p.prosrc ~ 'public\._tomar_correo\(' from pg_proc p where p.oid = f) then
      raise exception '% no es volátil de definidor con search_path vacío que toma la fila con _tomar_correo', f;
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
  if (select p.prosecdef or not coalesce(p.proconfig @> array['search_path=""'], false) or p.prosrc !~* 'for\s+update'
        from pg_proc p where p.oid = v_tomar) then
    raise exception '_tomar_correo es de definidor, no fija search_path vacío o no toma la fila for update';
  end if;
  if has_function_privilege('authenticated', v_tomar, 'execute') or has_function_privilege('anon', v_tomar, 'execute') then
    raise exception 'authenticated o anon ejecutan _tomar_correo';
  end if;
end $$;
rollback;
