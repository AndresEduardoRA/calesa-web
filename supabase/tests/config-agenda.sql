-- Las reglas y el horario común de la agenda (semilla §3, §5.5, B10–B12, §4 fila 27; paso P34, C10–C13). `guardar_config_agenda` y
-- `guardar_horario_base` son las únicas escrituras de `config_agenda` y `horario_base`: sólo `authenticated`, con `agenda.configurar`.
-- Las reglas quedan auditadas por `_auditar_config` (P31); el horario, por su RPC, con `tabla = 'horario_base'`. Las llamadas que miran
-- la respuesta corren como postgres con el usuario puesto en la sesión; los grants y los errores, con `pruebas.caso` y `pruebas.error`.
-- A = …01 (admin), V1 = …02. El horario de B11: lunes a viernes 09:00–12:00 y 14:00–18:00.

-- @test agenda: reglas · el admin guarda las 6 y la fila `config` lleva sólo lo cambiado, con su actor; la zona no cambia (C11, P8a)
begin;
do $$
declare
  a constant uuid := '00000000-0000-4000-8000-000000000001';
  v_antes timestamptz := (select actualizado_en from public.config_agenda where id = 1);
  v_c public.config_agenda;
  r jsonb;
begin
  perform set_config('request.jwt.claim.sub', a::text, true);
  r := public.guardar_config_agenda(45, 10, 24, 30, 6, 2, v_antes);
  perform set_config('request.jwt.claim.sub', '', true);
  select * into v_c from public.config_agenda where id = 1;
  if (v_c.duracion_min, v_c.descanso_min, v_c.anticipacion_min_horas, v_c.horizonte_dias, v_c.max_reuniones_dia,
      v_c.cancelar_hasta_horas, v_c.zona_horaria) is distinct from (45, 10, 24, 30, 6, 2, 'America/La_Paz')
     or v_c.actualizado_en <= v_antes then
    raise exception 'la fila no quedó con lo guardado: %', to_jsonb(v_c);
  end if;
  if not pruebas.claves(r, array['duracionMin', 'descansoMin', 'anticipacionMinHoras', 'horizonteDias', 'maxReunionesDia',
       'cancelarHastaHoras', 'zonaHoraria', 'actualizadoEn'])
     or r -> 'duracionMin' <> '45' or r -> 'maxReunionesDia' <> '6' or r ->> 'zonaHoraria' <> 'America/La_Paz'
     or (r ->> 'actualizadoEn')::timestamptz is distinct from v_c.actualizado_en then
    raise exception 'la respuesta no es la fila guardada: %', r;
  end if;
  if not exists (select 1 from public.auditoria where accion = 'config' and tabla = 'config_agenda' and actor_id = a
                   and registro_id = '00000000-0000-0000-0000-000000000000'
                   and antes = '{"duracion_min": 30, "descanso_min": 15, "anticipacion_min_horas": 12, "horizonte_dias": 21,
                                 "max_reuniones_dia": 4}'
                   and despues = '{"duracion_min": 45, "descanso_min": 10, "anticipacion_min_horas": 24, "horizonte_dias": 30,
                                   "max_reuniones_dia": 6}') then
    raise exception 'las reglas no quedaron auditadas con sólo lo cambiado';
  end if;
end $$;
rollback;

-- @test agenda: reglas, errores · sin la clave E11, versión vieja E21, una regla fuera de rango o nula 22023 (C11)
begin;
do $$
declare
  v_act timestamptz := (select actualizado_en from public.config_agenda where id = 1);
begin
  perform pruebas.error('sin clave', 'V1', format('select public.guardar_config_agenda(30, 15, 12, 21, 4, 2, %L)', v_act), '42501',
    'No tienes permiso para hacer esto.');
  perform pruebas.error('versión vieja', 'A', format('select public.guardar_config_agenda(30, 15, 12, 21, 4, 2, %L)',
    v_act - interval '1 second'), 'PT409', 'Las reglas de la agenda cambiaron mientras las mirabas. Recarga para ver lo último.');
  perform pruebas.caso('fuera de rango', 'A', format('select public.guardar_config_agenda(10, 15, 12, 21, 4, 2, %L)', v_act),
    'error=22023:config_agenda_duracion_min_check');
  perform pruebas.caso('nula', 'A', format('select public.guardar_config_agenda(30, 15, 12, null, 4, 2, %L)', v_act),
    'error=22023:p_horizonte_dias');
  perform pruebas.caso('sin versión', 'A', 'select public.guardar_config_agenda(30, 15, 12, 21, 4, 2, null)',
    'error=22023:p_actualizado_en_esperado');
end $$;
rollback;

-- @test agenda: horario · reemplaza el de B11, responde ordenado en HH24:MI con la versión nueva, que se mueve dos veces (C12, P9a)
begin;
do $$
declare
  v_tramos constant jsonb := '[{"diaSemana": 6, "desde": "10:00", "hasta": "12:00"},
                               {"diaSemana": 1, "desde": "09:00", "hasta": "13:00"}]';
  r jsonb;
  r2 jsonb;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
  r := public.guardar_horario_base(v_tramos, (select max(creado_en) from public.horario_base));
  if not pruebas.claves(r, array['tramos', 'actualizadoEn'])
     or r -> 'tramos' <> '[{"diaSemana": 1, "desde": "09:00", "hasta": "13:00"}, {"diaSemana": 6, "desde": "10:00", "hasta": "12:00"}]'
     or (select count(*) from public.horario_base) <> 2
     or (r ->> 'actualizadoEn')::timestamptz is distinct from (select max(creado_en) from public.horario_base) then
    raise exception 'el horario no quedó como se guardó: %', r;
  end if;
  r2 := public.guardar_horario_base('[{"diaSemana": 2, "desde": "08:00", "hasta": "10:30"}]', (r ->> 'actualizadoEn')::timestamptz);
  if (r2 ->> 'actualizadoEn')::timestamptz <= (r ->> 'actualizadoEn')::timestamptz
     or r2 -> 'tramos' <> '[{"diaSemana": 2, "desde": "08:00", "hasta": "10:30"}]' then
    raise exception 'el segundo guardado no movió la versión: % → %', r, r2;
  end if;
end $$;
rollback;

-- @test agenda: horario igual o vacío · el mismo conjunto en otro orden no escribe ni audita; con la tabla vacía, guardar entra (C12, C13)
begin;
do $$
declare
  v_ver timestamptz := (select max(creado_en) from public.horario_base);
  v_n bigint := (select count(*) from (select 1 from public.auditoria where tabla = 'horario_base' limit 10) x);
  r jsonb;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
  r := public.guardar_horario_base((select jsonb_agg(jsonb_build_object('diaSemana', dia_semana, 'desde', to_char(desde, 'HH24:MI'),
         'hasta', to_char(hasta, 'HH24:MI')) order by dia_semana desc, desde desc) from public.horario_base), v_ver);
  if (r ->> 'actualizadoEn')::timestamptz is distinct from v_ver or (select max(creado_en) from public.horario_base) <> v_ver
     or (select count(*) from (select 1 from public.auditoria where tabla = 'horario_base' limit 10) x) <> v_n
     or jsonb_array_length(r -> 'tramos') <> 10 then
    raise exception 'el mismo horario en otro orden escribió o auditó: %', r;
  end if;
  delete from public.horario_base;
  r := public.guardar_horario_base('[{"diaSemana": 3, "desde": "09:00", "hasta": "11:00"}]', '2000-01-01');
  if r ->> 'actualizadoEn' is null or (select count(*) from public.horario_base) <> 1 then
    raise exception 'con la tabla vacía no entró: %', r;
  end if;
end $$;
rollback;

-- @test agenda: horario, errores · versión vieja E22, solape y desde = hasta 22023 con la restricción, forma 22023 p_tramos, sin la clave E11
begin;
do $$
declare
  v_ver timestamptz := (select max(creado_en) from public.horario_base);
  v_sql constant text := 'select public.guardar_horario_base(%L, %L)';
  v_t text;
begin
  perform pruebas.error('versión vieja', 'A', format(v_sql, '[{"diaSemana": 1, "desde": "09:00", "hasta": "10:00"}]',
    v_ver - interval '1 second'), 'PT409', 'El horario cambió mientras lo mirabas. Recarga para ver lo último.');
  perform pruebas.caso('solape', 'A', format(v_sql, '[{"diaSemana": 1, "desde": "09:00", "hasta": "11:00"},
    {"diaSemana": 1, "desde": "10:00", "hasta": "12:00"}]', v_ver), 'error=22023:horario_base_sin_solapes');
  perform pruebas.caso('desde = hasta', 'A', format(v_sql, '[{"diaSemana": 1, "desde": "09:00", "hasta": "09:00"}]', v_ver),
    'error=22023:horario_base_desde_antes_de_hasta');
  foreach v_t in array array['{"diaSemana": 1, "desde": "09:00", "hasta": "10:00"}', '[]',
      '[{"diaSemana": 8, "desde": "09:00", "hasta": "10:00"}]', '[{"diaSemana": 1, "desde": "09:00", "hasta": "10:00", "x": 1}]',
      '[{"diaSemana": 1, "desde": "9:00", "hasta": "10:00"}]', '[{"diaSemana": "1", "desde": "09:00", "hasta": "10:00"}]',
      (select jsonb_agg(jsonb_build_object('diaSemana', 1 + g % 7, 'desde', '09:00', 'hasta', '10:00'))::text
         from generate_series(1, 36) g)] loop
    perform pruebas.caso('forma ' || left(v_t, 40), 'A', format(v_sql, v_t, v_ver), 'error=22023:p_tramos');
  end loop;
  perform pruebas.caso('nulo', 'A', format('select public.guardar_horario_base(null, %L)', v_ver), 'error=22023:p_tramos');
  perform pruebas.error('sin clave', 'V1', format(v_sql, '[{"diaSemana": 1, "desde": "09:00", "hasta": "10:00"}]', v_ver), '42501',
    'No tienes permiso para hacer esto.');
end $$;
rollback;

-- @test agenda: horario auditado · una fila `config` con los tramos de antes y de después; una demo fuera del horario nuevo sigue (C13, P11a)
begin;
do $$
declare
  a constant uuid := '00000000-0000-4000-8000-000000000001';
  v_r uuid := pruebas.reunion(pruebas.solicitud('00000000-0000-4000-8000-000000000002', 'agendada'),
    '00000000-0000-4000-8000-000000000002', pruebas.hora(3, '19:00'));
  v_antes jsonb := (select jsonb_build_object('tramos', jsonb_agg(jsonb_build_object('diaSemana', dia_semana,
                       'desde', to_char(desde, 'HH24:MI'), 'hasta', to_char(hasta, 'HH24:MI')) order by dia_semana, desde))
                      from public.horario_base);
begin
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform public.guardar_horario_base('[{"diaSemana": 1, "desde": "09:00", "hasta": "10:00"}]',
    (select max(creado_en) from public.horario_base));
  perform set_config('request.jwt.claim.sub', '', true);
  if (select count(*) from (select 1 from public.auditoria where tabla = 'horario_base' limit 10) x) <> 1
     or not exists (select 1 from public.auditoria where accion = 'config' and tabla = 'horario_base' and actor_id = a
                      and registro_id = '00000000-0000-0000-0000-000000000000' and antes = v_antes
                      and despues = '{"tramos": [{"diaSemana": 1, "desde": "09:00", "hasta": "10:00"}]}') then
    raise exception 'el horario no quedó auditado con sus tramos';
  end if;
  if jsonb_array_length(v_antes -> 'tramos') <> 10
     or not exists (select 1 from public.reuniones where id = v_r and estado = 'confirmada' and inicio = pruebas.hora(3, '19:00')) then
    raise exception 'el horario anterior no era el de B11 o la demo cambió';
  end if;
end $$;
rollback;

-- @test agenda: grants · las dos sólo authenticated y de definidor; nadie escribe las tablas directo; ningún delete sin where (C10, fila 27)
begin;
do $$
declare
  v_f text;
begin
  foreach v_f in array array['public.guardar_config_agenda(int, int, int, int, int, int, timestamptz)',
      'public.guardar_horario_base(jsonb, timestamptz)'] loop
    if not has_function_privilege('authenticated', v_f, 'execute') or has_function_privilege('anon', v_f, 'execute')
       or has_function_privilege('service_role', v_f, 'execute') or has_function_privilege('public', v_f, 'execute')
       or not (select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = v_f::regprocedure) then
      raise exception '% no es sólo de authenticated o no es definidor', v_f;
    end if;
  end loop;
  if has_table_privilege('authenticated', 'public.config_agenda', 'insert, update, delete')
     or has_table_privilege('authenticated', 'public.horario_base', 'insert, update, delete')
     or has_table_privilege('anon', 'public.config_agenda', 'insert, update, delete')
     or has_table_privilege('anon', 'public.horario_base', 'insert, update, delete') then
    raise exception 'alguien escribe la agenda directo';
  end if;
  -- PostgREST conecta como authenticator, que precarga safeupdate: un delete sin where cae (21000) aunque sea de definidor.
  if (select prosrc from pg_proc where oid = 'public.guardar_horario_base(jsonb, timestamptz)'::regprocedure)
       ~* '\mdelete\s+from\s+[a-z_.]+\s*;' then
    raise exception 'guardar_horario_base tiene un delete sin where';
  end if;
end $$;
rollback;
