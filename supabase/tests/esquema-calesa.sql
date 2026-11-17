-- El esquema de Calesa (semilla §3): exclusiones, el índice único de reuniones, los checks, las filas iniciales de las migraciones y
-- `actualizado_en`. Corre como el dueño de las tablas (sin RLS) y con datos propios dentro de cada bloque (`begin; … rollback;`),
-- así no depende de la semilla de pruebas. Los ids `…e0NN` son sólo de este archivo.

-- @test esquema: las tablas y los enums de §3 existen
do $$
declare
  v_faltan text[];
begin
  select array_agg(t order by t) into v_faltan
    from unnest(array['perfiles', 'invitaciones', 'config_agenda', 'horario_base', 'bloqueos', 'solicitudes', 'reuniones', 'notas',
      'enlaces_prospeccion', 'equipo', 'config_calculadora', 'eventos', 'metricas_diarias', 'metricas_persona', 'latidos',
      'auditoria', 'correos_salientes', 'limites']) t
   where to_regclass('public.' || t) is null;
  if v_faltan is not null then raise exception 'faltan tablas: %', v_faltan; end if;
  select array_agg(t order by t) into v_faltan
    from unnest(array['rol_usuario', 'estado_solicitud', 'origen_solicitud', 'estado_reunion', 'tiempo_respuesta', 'volatilidad',
      'tipo_evento', 'estado_correo']) t
   where to_regtype('public.' || t) is null;
  if v_faltan is not null then raise exception 'faltan enums: %', v_faltan; end if;
  if enum_range(null::public.estado_solicitud)::text <> '{nueva,agendada,realizada,no_asistio,ganada,descartada}' then
    raise exception 'estado_solicitud no es el de §3 (X4): %', enum_range(null::public.estado_solicitud);
  end if;
end $$;

-- @test esquema: _mas_minutos es immutable y suma minutos (la exclusión de reuniones la necesita así)
do $$
begin
  if (select provolatile from pg_proc where oid = 'public._mas_minutos(timestamptz, integer)'::regprocedure) <> 'i' then
    raise exception '_mas_minutos no es immutable';
  end if;
  if public._mas_minutos('2026-11-03 18:30Z', 15) <> '2026-11-03 18:45Z'::timestamptz then
    raise exception '_mas_minutos no suma 15 minutos';
  end if;
end $$;

-- @test esquema: exclusión de reuniones por anfitrión, con 15 min de descanso y sólo entre confirmadas
begin;
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000e001', 'e1@ejemplo.test'), ('00000000-0000-4000-8000-00000000e002', 'e2@ejemplo.test');
insert into public.perfiles (id, nombre, email) values
  ('00000000-0000-4000-8000-00000000e001', 'Prueba Uno', 'e1@ejemplo.test'),
  ('00000000-0000-4000-8000-00000000e002', 'Prueba Dos', 'e2@ejemplo.test');
insert into public.solicitudes (id, origen, nombre, email, importadora, pais, whatsapp, autos_hoy, consentimiento_en, asignado_a)
select ('00000000-0000-4000-8000-00000000e01' || n)::uuid, 'formulario', 'Cliente ' || n, 'c' || n || '@ejemplo.test',
       'Importadora ' || n, 'BO', '+5917000001' || n, 20, now(), '00000000-0000-4000-8000-00000000e001'
  from generate_series(1, 4) n;
insert into public.reuniones (id, solicitud_id, anfitrion_id, inicio, fin, zona_visitante, enlace_meet, token_hash) values
  ('00000000-0000-4000-8000-00000000e021', '00000000-0000-4000-8000-00000000e011', '00000000-0000-4000-8000-00000000e001',
   '2026-11-03 18:00Z', '2026-11-03 18:30Z', 'America/La_Paz', 'https://meet.google.com/aaa-bbbb-ccc', extensions.digest('e021', 'sha256'));
do $$
begin
  begin
    insert into public.reuniones (solicitud_id, anfitrion_id, inicio, fin, zona_visitante, enlace_meet, token_hash) values
      ('00000000-0000-4000-8000-00000000e012', '00000000-0000-4000-8000-00000000e001', '2026-11-03 18:40Z', '2026-11-03 19:10Z',
       'America/La_Paz', 'https://meet.google.com/aaa-bbbb-ccc', extensions.digest('e022', 'sha256'));
    raise exception 'entró una reunión 10 min después de otra del mismo anfitrión';
  exception when exclusion_violation then null;
  end;
  -- A los 15 min, entra.
  insert into public.reuniones (solicitud_id, anfitrion_id, inicio, fin, zona_visitante, enlace_meet, token_hash) values
    ('00000000-0000-4000-8000-00000000e012', '00000000-0000-4000-8000-00000000e001', '2026-11-03 18:45Z', '2026-11-03 19:15Z',
     'America/La_Paz', 'https://meet.google.com/aaa-bbbb-ccc', extensions.digest('e023', 'sha256'));
  -- Otro anfitrión a la misma hora, entra.
  insert into public.reuniones (solicitud_id, anfitrion_id, inicio, fin, zona_visitante, enlace_meet, token_hash) values
    ('00000000-0000-4000-8000-00000000e013', '00000000-0000-4000-8000-00000000e002', '2026-11-03 18:00Z', '2026-11-03 18:30Z',
     'America/La_Paz', 'https://meet.google.com/ddd-eeee-fff', extensions.digest('e024', 'sha256'));
  -- Una cancelada no bloquea.
  update public.reuniones set estado = 'cancelada' where id = '00000000-0000-4000-8000-00000000e021';
  insert into public.reuniones (solicitud_id, anfitrion_id, inicio, fin, zona_visitante, enlace_meet, token_hash) values
    ('00000000-0000-4000-8000-00000000e014', '00000000-0000-4000-8000-00000000e001', '2026-11-03 18:00Z', '2026-11-03 18:30Z',
     'America/La_Paz', 'https://meet.google.com/aaa-bbbb-ccc', extensions.digest('e025', 'sha256'));
end $$;
rollback;

-- @test esquema: una sola reunión confirmada por solicitud (R4.15), y otra entra si la anterior se canceló
begin;
insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000e001', 'e1@ejemplo.test');
insert into public.perfiles (id, nombre, email) values ('00000000-0000-4000-8000-00000000e001', 'Prueba Uno', 'e1@ejemplo.test');
insert into public.solicitudes (id, origen, nombre, email, importadora, pais, whatsapp, autos_hoy, consentimiento_en, asignado_a) values
  ('00000000-0000-4000-8000-00000000e011', 'formulario', 'Cliente Uno', 'c1@ejemplo.test', 'Importadora Uno', 'BO', '+59170000011',
   20, now(), '00000000-0000-4000-8000-00000000e001');
insert into public.reuniones (id, solicitud_id, anfitrion_id, inicio, fin, zona_visitante, enlace_meet, token_hash) values
  ('00000000-0000-4000-8000-00000000e021', '00000000-0000-4000-8000-00000000e011', '00000000-0000-4000-8000-00000000e001',
   '2026-11-03 18:00Z', '2026-11-03 18:30Z', 'America/La_Paz', 'https://meet.google.com/aaa-bbbb-ccc', extensions.digest('e021', 'sha256'));
do $$
begin
  begin
    insert into public.reuniones (solicitud_id, anfitrion_id, inicio, fin, zona_visitante, enlace_meet, token_hash) values
      ('00000000-0000-4000-8000-00000000e011', '00000000-0000-4000-8000-00000000e001', '2026-11-04 18:00Z', '2026-11-04 18:30Z',
       'America/La_Paz', 'https://meet.google.com/aaa-bbbb-ccc', extensions.digest('e022', 'sha256'));
    raise exception 'entró una segunda reunión confirmada de la misma solicitud';
  exception when unique_violation then null;
  end;
  update public.reuniones set estado = 'cancelada' where id = '00000000-0000-4000-8000-00000000e021';
  insert into public.reuniones (solicitud_id, anfitrion_id, inicio, fin, zona_visitante, enlace_meet, token_hash) values
    ('00000000-0000-4000-8000-00000000e011', '00000000-0000-4000-8000-00000000e001', '2026-11-04 18:00Z', '2026-11-04 18:30Z',
     'America/La_Paz', 'https://meet.google.com/aaa-bbbb-ccc', extensions.digest('e023', 'sha256'));
end $$;
rollback;

-- @test esquema: horario_base sin solapes el mismo día
begin;
do $$
begin
  begin
    insert into public.horario_base (dia_semana, desde, hasta) values (1, '09:30', '10:00');
    raise exception 'entró un tramo que se solapa con otro del mismo día';
  exception when exclusion_violation then null;
  end;
  begin
    insert into public.horario_base (dia_semana, desde, hasta) values (6, '10:00', '09:00');
    raise exception 'entró un tramo con desde >= hasta';
  exception when check_violation then null;
  end;
  begin
    insert into public.horario_base (dia_semana, desde, hasta) values (8, '09:00', '10:00');
    raise exception 'entró el día 8';
  exception when check_violation then null;
  end;
  -- El mismo tramo otro día, y uno pegado (12:00–14:00) el mismo día, entran.
  insert into public.horario_base (dia_semana, desde, hasta) values (6, '09:00', '12:00'), (1, '12:00', '14:00');
end $$;
rollback;

-- @test esquema: los checks de perfiles, solicitudes, bloqueos y las filas únicas
begin;
insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000e001', 'e1@ejemplo.test');
insert into public.perfiles (id, nombre, email) values ('00000000-0000-4000-8000-00000000e001', 'Prueba Uno', 'e1@ejemplo.test');
do $$
declare
  c record;
begin
  for c in select * from (values
      ('en_turno sin WhatsApp', $q$update public.perfiles set en_turno = true where id = '00000000-0000-4000-8000-00000000e001'$q$),
      ('whatsapp sin +', $q$update public.perfiles set whatsapp = '59170000000' where id = '00000000-0000-4000-8000-00000000e001'$q$),
      ('enlace_meet que no es Meet ni Zoom', $q$update public.perfiles set enlace_meet = 'https://ejemplo.test/x' where id = '00000000-0000-4000-8000-00000000e001'$q$),
      ('país fuera de §6.6', $q$insert into public.solicitudes (origen, nombre, email, importadora, pais, whatsapp, autos_hoy, consentimiento_en) values ('formulario', 'Cliente', 'c@ejemplo.test', 'Importadora', 'ZZ', '+59170000011', 20, now())$q$),
      ('formulario sin importadora', $q$insert into public.solicitudes (origen, nombre, email, pais, whatsapp, autos_hoy, consentimiento_en) values ('formulario', 'Cliente', 'c@ejemplo.test', 'BO', '+59170000011', 20, now())$q$),
      ('calculadora con 401 autos', $q$insert into public.solicitudes (origen, nombre, email, autos_hoy, consentimiento_en) values ('calculadora', 'Cliente', 'c@ejemplo.test', 401, now())$q$),
      ('calc_margen fuera de calculadora', $q$insert into public.solicitudes (origen, nombre, email, importadora, pais, whatsapp, autos_hoy, calc_margen, consentimiento_en) values ('formulario', 'Cliente', 'c@ejemplo.test', 'Importadora', 'BO', '+59170000011', 20, 500, now())$q$),
      ('autos_meta menor que autos_hoy', $q$insert into public.solicitudes (origen, nombre, email, importadora, pais, whatsapp, autos_hoy, autos_meta, consentimiento_en) values ('formulario', 'Cliente', 'c@ejemplo.test', 'Importadora', 'BO', '+59170000011', 20, 10, now())$q$),
      ('origen fuera de la lista', $q$insert into public.solicitudes (origen, nombre, email, importadora, pais, whatsapp, autos_hoy, origenes, consentimiento_en) values ('formulario', 'Cliente', 'c@ejemplo.test', 'Importadora', 'BO', '+59170000011', 20, array['ebay'], now())$q$),
      ('bloqueo de más de 31 días', $q$insert into public.bloqueos (perfil_id, inicio, fin, creado_por) values ('00000000-0000-4000-8000-00000000e001', '2026-11-01Z', '2026-12-03Z', '00000000-0000-4000-8000-00000000e001')$q$),
      ('config_agenda con id 2', $q$insert into public.config_agenda (id) values (2)$q$),
      ('config_calculadora con id 2', $q$insert into public.config_calculadora (id) values (2)$q$),
      ('código de prospección en minúsculas', $q$insert into public.enlaces_prospeccion (codigo, creado_por) values ('gt-02', '00000000-0000-4000-8000-00000000e001')$q$)
    ) t (caso, sql) loop
    begin
      execute c.sql;
      raise exception 'entró: %', c.caso;
    exception when check_violation then null;
    end;
  end loop;
  -- La solicitud de la calculadora sólo exige nombre, email, autos y consentimiento.
  insert into public.solicitudes (origen, nombre, email, autos_hoy, administracion, calc_margen, consentimiento_en)
  values ('calculadora', 'Cliente', 'c@ejemplo.test', 400, 80, 30000, now());
end $$;
rollback;

-- @test esquema: las filas iniciales de las migraciones (config_agenda, config_calculadora y el horario de B11)
do $$
begin
  if (select row(duracion_min, descanso_min, anticipacion_min_horas, horizonte_dias, max_reuniones_dia, cancelar_hasta_horas, zona_horaria)::text
        from public.config_agenda where id = 1) is distinct from '(30,15,12,21,4,2,America/La_Paz)' then
    raise exception 'config_agenda no tiene los valores iniciales de §3';
  end if;
  if (select row(precio, pct_sena, sena, moneda_local, pct_local, volatilidad, sueldo, tasa, ciclo_dias, actualizado_por)::text
        from public.config_calculadora where id = 1) is distinct from '(18000,60,2000,t,40,media,700,15,76,)' then
    raise exception 'config_calculadora no tiene los valores iniciales de §3';
  end if;
  if exists (
      (select dia_semana, desde, hasta from public.horario_base
       except
       select d, t.desde, t.hasta from generate_series(1, 5) d, (values (time '09:00', time '12:00'), ('14:00', '18:00')) t (desde, hasta))
      union all
      (select d, t.desde, t.hasta from generate_series(1, 5) d, (values (time '09:00', time '12:00'), ('14:00', '18:00')) t (desde, hasta)
       except
       select dia_semana, desde, hasta from public.horario_base)) then
    raise exception 'horario_base no es el de B11 (lunes a viernes 09:00–12:00 y 14:00–18:00)';
  end if;
end $$;

-- @test esquema: actualizado_en se mueve dos veces dentro de una transacción
begin;
do $$
declare
  v_0 timestamptz;
  v_1 timestamptz;
  v_2 timestamptz;
begin
  select actualizado_en into v_0 from public.config_agenda where id = 1;
  update public.config_agenda set duracion_min = 45 where id = 1 returning actualizado_en into v_1;
  update public.config_agenda set duracion_min = 30 where id = 1 returning actualizado_en into v_2;
  if not (v_0 < v_1 and v_1 < v_2) then
    raise exception 'actualizado_en no se movió dos veces: %, %, %', v_0, v_1, v_2;
  end if;
end $$;
rollback;
