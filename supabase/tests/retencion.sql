-- Borrar una solicitud a pedido (C3, R4.17; paso P30, C12, C16) y la retención diaria (C2, R3.4, §3 l. 300-302; C13). El borrado es
-- del panel (sólo `authenticated` con `solicitudes.borrar`); la retención, sólo de `service_role`. A = …01, V1 = …02 (carla@…).
-- Cada bloque deja la base como estaba.

-- @test borrar: correos pendientes fuera, enviados vaciados, cascada y una sola fila de auditoría (fila 36 permitida, P6a, P7a)
begin;
do $$
declare
  a constant uuid := '00000000-0000-4000-8000-000000000001';
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  v_s uuid := pruebas.solicitud(v1, 'agendada');
  v_r uuid := pruebas.reunion(v_s, v1, now() + interval '3 days');
  v_email text := (select email::text from public.solicitudes where id = v_s);
  v_ajeno uuid;
  v_enviado uuid;
  v_n uuid;
begin
  insert into public.notas (solicitud_id, autor_id, texto) values (v_s, v1, 'Nota que se borra.') returning id into v_n;
  insert into public.correos_salientes (para, plantilla, estado, resend_id, solicitud_id, reunion_id) values
    (v_email, 'recordatorio-24', 'programado', 're_1', v_s, v_r),
    ('carla@ejemplo.test', 'recordatorio-1-anfitrion', 'programado', 're_2', null, v_r),
    (upper(v_email), 'confirmacion', 'fallido', null, null, null);
  insert into public.correos_salientes (para, plantilla, datos, adjunto_ics, estado, solicitud_id)
  values (v_email, 'confirmacion', '{"nombre": "Cliente"}', 'BEGIN:VCALENDAR', 'enviado', v_s) returning id into v_enviado;
  insert into public.correos_salientes (para, plantilla, datos, estado)
  values ('otra@ejemplo.test', 'confirmacion', '{"nombre": "Otra"}', 'enviado') returning id into v_ajeno;
  insert into public.auditoria (actor_id, accion, tabla, registro_id) values (v1, 'estado', 'solicitudes', v_s),
    (v1, 'reagenda', 'reuniones', v_r);
  perform pruebas.caso('36 por RPC', 'A', format($f$select public.borrar_solicitud(%L, %L) = jsonb_build_object('id', %L::uuid,
    'resendIds', '["re_1", "re_2"]'::jsonb)$f$, v_s, (select actualizado_en from public.solicitudes where id = v_s), v_s), 'verdad');
  if exists (select 1 from public.correos_salientes where estado in ('programado', 'fallido') and (lower(para::text) = lower(v_email) or reunion_id = v_r))
     or (select datos <> '{}' or adjunto_ics is not null from public.correos_salientes where id = v_enviado)
     or (select datos <> '{"nombre": "Otra"}' from public.correos_salientes where id = v_ajeno) then
    raise exception 'los correos no quedaron como dice P6a';
  end if;
  if exists (select 1 from public.solicitudes where id = v_s) or exists (select 1 from public.reuniones where id = v_r)
     or exists (select 1 from public.notas where id = v_n) then
    raise exception 'la solicitud, su reunión o su nota siguen';
  end if;
  if (select count(*) from public.auditoria where registro_id in (v_s, v_r)) <> 1
     or not exists (select 1 from public.auditoria where registro_id = v_s and accion = 'borrado' and tabla = 'solicitudes'
                      and actor_id = a and antes is null and despues is null) then
    raise exception 'la auditoría no quedó en una sola fila borrado de A';
  end if;
end $$;
rollback;

-- @test borrar: errores y grants · sin la clave E11, versión vieja o ya borrada E7, argumentos nulos; sólo authenticated
begin;
do $$
declare
  a constant uuid := '00000000-0000-4000-8000-000000000001';
  s2 constant uuid := '00000000-0000-4000-8000-000000000012';
  v_act timestamptz := (select actualizado_en from public.solicitudes where id = s2);
  v_sql text := format('select public.borrar_solicitud(%L, %L)', s2, v_act);
begin
  perform pruebas.error('sin clave', 'V1', v_sql, '42501', 'No tienes permiso para hacer esto.');
  perform pruebas.error('versión vieja', 'A', format('select public.borrar_solicitud(%L, %L)', s2, v_act - interval '1 second'),
    'PT409', 'Esta demo o solicitud cambió mientras la mirabas. Recarga para ver lo último.');
  perform pruebas.caso('sin solicitud', 'A', format('select public.borrar_solicitud(null, %L)', v_act), 'error=22023:p_solicitud_id');
  perform pruebas.caso('sin versión', 'A', format('select public.borrar_solicitud(%L, null)', s2),
    'error=22023:p_actualizado_en_esperado');
  perform pruebas.caso('servidor', 'service_role', v_sql, 'error=42501');
  perform pruebas.caso('anon', 'anon', v_sql, 'error=42501');
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform public.borrar_solicitud(s2, v_act);
  perform set_config('request.jwt.claim.sub', '', true);
  perform pruebas.error('ya borrada', 'A', v_sql, 'PT409',
    'Esta demo o solicitud cambió mientras la mirabas. Recarga para ver lo último.');
end $$;
rollback;

-- @test retención: 24 meses de las solicitudes y de eventos, 90 días de los correos que no esperan y 2 días de limites (C2, P8a)
begin;
do $$
declare
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  v_vieja uuid := pruebas.solicitud(v1, 'agendada');
  v_r uuid := pruebas.reunion(v_vieja, v1, now() - interval '25 months');
  v_queda uuid := pruebas.solicitud(v1);
  r jsonb;
begin
  insert into public.notas (solicitud_id, autor_id, texto) values (v_vieja, v1, 'Vieja.');
  insert into public.auditoria (actor_id, accion, tabla, registro_id) values (v1, 'estado', 'solicitudes', v_vieja),
    (v1, 'reagenda', 'reuniones', v_r);
  update public.solicitudes set ultimo_contacto_en = now() - interval '24 months 1 second' where id = v_vieja;
  update public.solicitudes set ultimo_contacto_en = now() - interval '24 months' + interval '1 second' where id = v_queda;
  insert into public.eventos (tipo, creado_en) values ('clic_agendar', now() - interval '24 months 1 second'),
    ('clic_agendar', now() - interval '24 months' + interval '1 second');
  insert into public.correos_salientes (para, plantilla, estado, creado_en) values
    ('a@ejemplo.test', 'x', 'enviado', now() - interval '90 days 1 second'),
    ('b@ejemplo.test', 'x', 'cancelado', now() - interval '90 days 1 second'),
    ('c@ejemplo.test', 'x', 'fallido', now() - interval '90 days 1 second'),
    ('d@ejemplo.test', 'x', 'programado', now() - interval '100 days'),
    ('e@ejemplo.test', 'x', 'enviado', now() - interval '90 days' + interval '1 second');
  insert into public.limites (clave, ventana_inicio) values ('vieja', now() - interval '2 days 1 second'),
    ('queda', now() - interval '47 hours');
  r := public.retencion_diaria();
  if r <> '{"solicitudes": 1, "eventos": 1, "correos": 3, "limites": 1, "quedanMas": false}'::jsonb then
    raise exception 'la retención no borró lo esperado: %', r;
  end if;
  if exists (select 1 from public.solicitudes where id = v_vieja) or exists (select 1 from public.reuniones where id = v_r)
     or not exists (select 1 from public.solicitudes where id = v_queda)
     or (select array_agg(para::text order by para) from public.correos_salientes where plantilla = 'x') <> array['d@ejemplo.test', 'e@ejemplo.test']
     or (select array_agg(clave) from public.limites where clave in ('vieja', 'queda')) <> array['queda'] then
    raise exception 'la retención borró de más o de menos';
  end if;
  if (select count(*) from public.auditoria where registro_id in (v_vieja, v_r)) <> 1
     or not exists (select 1 from public.auditoria where registro_id = v_vieja and accion = 'borrado' and actor_id is null) then
    raise exception 'la retención no dejó una sola fila borrado sin actor';
  end if;
end $$;
rollback;

-- @test retención: topes por corrida · 1000 solicitudes y 10 000 de las demás, y quedanMas dice si sigue
begin;
do $$
declare
  r jsonb;
begin
  insert into public.solicitudes (origen, nombre, email, importadora, pais, whatsapp, autos_hoy, consentimiento_en,
    ultimo_contacto_en)
  select 'formulario', 'Vieja', 'v' || i || '@ejemplo.test', 'Imp', 'BO', '+59171000001', 10, now(), now() - interval '25 months'
    from generate_series(1, 1001) i;
  insert into public.limites (clave, ventana_inicio) select 'l' || i, now() - interval '3 days' from generate_series(1, 10001) i;
  r := public.retencion_diaria();
  if r <> '{"solicitudes": 1000, "eventos": 0, "correos": 0, "limites": 10000, "quedanMas": true}'::jsonb then
    raise exception 'la primera corrida no respetó los topes: %', r;
  end if;
  r := public.retencion_diaria();
  if r <> '{"solicitudes": 1, "eventos": 0, "correos": 0, "limites": 1, "quedanMas": false}'::jsonb then
    raise exception 'la segunda corrida no terminó: %', r;
  end if;
end $$;
rollback;

-- @test retención: grants y forma · sólo service_role, definidor con search_path vacío, y los índices de C16
begin;
select pruebas.caso('anon', 'anon', $$select public.retencion_diaria()$$, 'error=42501');
select pruebas.caso('admin', 'A', $$select public.retencion_diaria()$$, 'error=42501');
select pruebas.caso('vendedora', 'V1', $$select public.retencion_diaria()$$, 'error=42501');
select pruebas.caso('servidor', 'service_role', $$select public.retencion_diaria()$$, 'filas=1');
do $$
begin
  if not (select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = 'public.retencion_diaria'::regproc)
     or not (select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = 'public.borrar_solicitud'::regproc) then
    raise exception 'retencion_diaria o borrar_solicitud no son definidor con search_path vacío';
  end if;
  if has_function_privilege('service_role', 'public.borrar_solicitud(uuid, timestamptz)', 'execute')
     or not has_function_privilege('authenticated', 'public.borrar_solicitud(uuid, timestamptz)', 'execute') then
    raise exception 'borrar_solicitud no es sólo de authenticated';
  end if;
  if (select count(*) from pg_indexes where schemaname = 'public' and tablename = 'correos_salientes'
        and indexname in ('correos_salientes_para', 'correos_salientes_de_solicitud', 'correos_salientes_de_reunion')) <> 3 then
    raise exception 'faltan los índices de correos_salientes de C16';
  end if;
end $$;
rollback;
