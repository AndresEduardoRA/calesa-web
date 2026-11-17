-- Los datos de la calculadora y la auditoría de las configuraciones (semilla §2 l. 82, §3 l. 262, §4 filas 2, 3, 28 y 38; paso P31,
-- C6–C10): `guardar_config_calculadora` es la única escritura de `config_calculadora` (sólo `authenticated`, con
-- `calculadora.configurar`), y todo cambio de `config_calculadora` o `config_agenda` deja una fila `config` con lo que cambió. Las
-- llamadas que miran la respuesta corren como postgres con el usuario puesto en la sesión; los grants y los errores, con
-- `pruebas.caso` y `pruebas.error`. A = …01 (admin), V1 = …02, V2 = …03. Cada bloque deja la base como estaba.

-- @test config: el admin guarda los 9 datos con su versión y queda como quien los cambió (C7, C8)
begin;
do $$
declare
  a constant uuid := '00000000-0000-4000-8000-000000000001';
  v_antes timestamptz := (select actualizado_en from public.config_calculadora where id = 1);
  v_c public.config_calculadora;
  r jsonb;
begin
  perform set_config('request.jwt.claim.sub', a::text, true);
  r := public.guardar_config_calculadora(20000, 50, 2500, false, 30, 'alta', 800, 12, 90, v_antes);
  perform set_config('request.jwt.claim.sub', '', true);
  select * into v_c from public.config_calculadora where id = 1;
  if (v_c.precio, v_c.pct_sena, v_c.sena, v_c.moneda_local, v_c.pct_local, v_c.volatilidad, v_c.sueldo, v_c.tasa, v_c.ciclo_dias)
     is distinct from (20000, 50, 2500, false, 30, 'alta'::public.volatilidad, 800, 12, 90)
     or v_c.actualizado_por is distinct from a or v_c.actualizado_en <= v_antes then
    raise exception 'la fila no quedó con lo guardado por A: %', to_jsonb(v_c);
  end if;
  if not pruebas.claves(r, array['precio', 'pctSena', 'sena', 'monedaLocal', 'pctLocal', 'volatilidad', 'sueldo', 'tasa', 'cicloDias',
       'actualizadoEn'])
     or r -> 'precio' <> '20000'::jsonb or r -> 'pctSena' <> '50'::jsonb or r -> 'monedaLocal' <> 'false'::jsonb
     or r ->> 'volatilidad' <> 'alta' or r -> 'cicloDias' <> '90'::jsonb
     or (r ->> 'actualizadoEn')::timestamptz is distinct from v_c.actualizado_en then
    raise exception 'la respuesta no es la fila guardada: %', r;
  end if;
end $$;
rollback;

-- @test config: sin la clave → E11; versión vieja → E18; un check o un null → 22023 con su hint (C7)
begin;
do $$
declare
  v_act text := (select actualizado_en::text from public.config_calculadora where id = 1);
  v_sql constant text := 'select public.guardar_config_calculadora(%s, %L)';
  v_datos constant text := '18000, 60, 2000, true, 40, ''media'', 700, 15, 76';
begin
  perform pruebas.error('V1', 'V1', format(v_sql, v_datos, v_act), '42501', 'No tienes permiso para hacer esto.');
  perform pruebas.error('E18', 'A', format(v_sql, v_datos, '2020-01-01 00:00Z'), 'PT409',
    'Los datos de la calculadora cambiaron mientras los mirabas. Recarga para ver lo último.');
  perform pruebas.caso('precio', 'A', format(v_sql, '1, 60, 2000, true, 40, ''media'', 700, 15, 76', v_act),
    'error=22023:config_calculadora_precio_check');
  perform pruebas.error('precio texto', 'A', format(v_sql, '1, 60, 2000, true, 40, ''media'', 700, 15, 76', v_act), '22023',
    'Los datos de la calculadora no son válidos.');
  perform pruebas.caso('tasa nula', 'A', format(v_sql, '18000, 60, 2000, true, 40, ''media'', 700, null, 76', v_act),
    'error=22023:p_tasa');
  perform pruebas.caso('volatilidad nula', 'A', format(v_sql, '18000, 60, 2000, true, 40, null, 700, 15, 76', v_act),
    'error=22023:p_volatilidad');
  perform pruebas.caso('sin versión', 'A', format('select public.guardar_config_calculadora(%s, null)', v_datos),
    'error=22023:p_actualizado_en_esperado');
  if (select precio from public.config_calculadora where id = 1) <> 18000 then
    raise exception 'un intento rechazado cambió la configuración';
  end if;
  perform pruebas.caso('A ok', 'A', format(v_sql, v_datos, v_act), 'filas=1');
end $$;
rollback;

-- @test config: la RPC la ejecuta sólo authenticated; nadie escribe la tabla directo; la clave es sólo del admin, todas (C9)
do $$
declare
  f constant text := 'public.guardar_config_calculadora(integer, integer, integer, boolean, integer, public.volatilidad, integer, '
    || 'integer, integer, timestamptz)';
  v_rol text;
begin
  if not has_function_privilege('authenticated', f, 'execute') then raise exception 'authenticated no puede ejecutar la RPC'; end if;
  if has_function_privilege('anon', f, 'execute') then raise exception 'anon (o PUBLIC) puede ejecutar la RPC'; end if;
  if has_function_privilege('service_role', f, 'execute') then raise exception 'service_role puede ejecutar la RPC'; end if;
  if not exists (select 1 from pg_proc p where p.oid = f::regprocedure and p.prosecdef and p.proconfig @> array['search_path=""']) then
    raise exception 'la RPC no es de definidor con search_path vacío';
  end if;
  -- Una fórmula se escribe sólo por RPC (migraciones.md): ni tabla ni columna con insert, update o delete.
  foreach v_rol in array array['authenticated', 'anon'] loop
    if has_table_privilege(v_rol, 'public.config_calculadora', 'insert') or has_table_privilege(v_rol, 'public.config_calculadora', 'update')
       or has_table_privilege(v_rol, 'public.config_calculadora', 'delete')
       or has_any_column_privilege(v_rol, 'public.config_calculadora', 'insert')
       or has_any_column_privilege(v_rol, 'public.config_calculadora', 'update') then
      raise exception '% puede escribir config_calculadora directo', v_rol;
    end if;
  end loop;
  if (select array_agg(rol::text || ':' || alcance order by rol) from public.permisos_rol where clave = 'calculadora.configurar')
     is distinct from array['admin:todos'] then
    raise exception 'calculadora.configurar no es sólo del admin con alcance todos';
  end if;
  if not exists (select 1 from public.permisos where clave = 'calculadora.configurar') then
    raise exception 'calculadora.configurar no está en el catálogo';
  end if;
  -- El trigger de auditoría escribe una tabla sin grant: de definidor, y nadie del API lo ejecuta (C22).
  if has_function_privilege('authenticated', 'public._auditar_config()', 'execute')
     or has_function_privilege('anon', 'public._auditar_config()', 'execute')
     or not exists (select 1 from pg_proc p where p.oid = 'public._auditar_config()'::regprocedure and p.prosecdef
                     and p.proconfig @> array['search_path=""']) then
    raise exception '_auditar_config no es de definidor o lo ejecuta alguien del API';
  end if;
end $$;

-- @test auditoría: config con registro nulo y sólo lo cambiado; guardar lo mismo no audita; config_agenda también (C10)
begin;
do $$
declare
  a constant uuid := '00000000-0000-4000-8000-000000000001';
  nulo constant uuid := '00000000-0000-0000-0000-000000000000';
  v_fila public.auditoria;
begin
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform public.guardar_config_calculadora(20000, 60, 2000, true, 40, 'media', 700, 15, 76,
    (select actualizado_en from public.config_calculadora where id = 1));
  select * into v_fila from public.auditoria where accion = 'config' and tabla = 'config_calculadora';
  if v_fila.id is null or v_fila.registro_id is distinct from nulo or v_fila.actor_id is distinct from a
     or v_fila.antes <> '{"precio": 18000}'::jsonb or v_fila.despues <> '{"precio": 20000}'::jsonb then
    raise exception 'la auditoría de la calculadora no es la esperada: %', to_jsonb(v_fila);
  end if;
  perform public.guardar_config_calculadora(20000, 60, 2000, true, 40, 'media', 700, 15, 76,
    (select actualizado_en from public.config_calculadora where id = 1));
  if (select count(*) from (select 1 from public.auditoria where accion = 'config' limit 10) x) <> 1 then
    raise exception 'guardar lo mismo escribió auditoría';
  end if;
  update public.config_agenda set descanso_min = 20 where id = 1;
  select * into v_fila from public.auditoria where accion = 'config' and tabla = 'config_agenda';
  if v_fila.id is null or v_fila.registro_id is distinct from nulo or v_fila.actor_id is distinct from a
     or v_fila.antes <> '{"descanso_min": 15}'::jsonb or v_fila.despues <> '{"descanso_min": 20}'::jsonb then
    raise exception 'la auditoría de la agenda no es la esperada: %', to_jsonb(v_fila);
  end if;
  perform set_config('request.jwt.claim.sub', '', true);
end $$;
rollback;

-- @test auditoría: las filas rol y config sólo las ve quien tiene auditoria.ver con todos; el vendedor, ninguna (V12, C6, C10)
begin;
do $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
  update public.perfiles set rol = 'admin' where id = '00000000-0000-4000-8000-000000000003';
  update public.config_calculadora set precio = 20000 where id = 1;
  perform set_config('request.jwt.claim.sub', '', true);
  perform pruebas.caso('V1 rol y config', 'V1', $q$select 1 from public.auditoria where accion in ('rol', 'config')$q$, 'filas=0');
  perform pruebas.caso('A rol y config', 'A', $q$select 1 from public.auditoria where accion in ('rol', 'config')$q$, 'filas=2');
end $$;
rollback;
