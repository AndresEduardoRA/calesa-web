-- La guarda del reloj en la base (paso P38, C8): toda lectura del presente en `public` pasa por `public._ahora()`, para que el reloj
-- de las pruebas locales alcance a todas. Cae con la próxima función o default que escriba `now()` (o sus parientes). Quedan con el
-- reloj real, por par (función, palabra), las versiones de edición (tienen que avanzar aunque el reloj esté quieto, o dos ediciones
-- darían PT409), `_validar_zona` (sólo prueba que la zona exista) y la propia `_ahora`. Entre los defaults, `actualizado_en` y
-- `horario_base.creado_en` (la versión de `guardar_horario_base`).

-- @test reloj · guarda: ninguna función de public lee la hora sin _ahora()
do $$
declare
  v_leen text;
begin
  select string_agg(distinct format('%s (%s)', p.proname, lower(coalesce(m[1], m[2]))), ', ') into v_leen
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
   cross join lateral regexp_matches(p.prosrc,
     '\m(now|clock_timestamp|statement_timestamp|transaction_timestamp|timeofday)\s*\(|\m(current_timestamp|current_date|current_time|localtimestamp|localtime)\M',
     'gi') m
   where (p.proname, lower(coalesce(m[1], m[2]))) not in (('_ahora', 'now'), ('_validar_zona', 'now'),
     ('_tocar_actualizado_en', 'clock_timestamp'), ('guardar_horario_base', 'clock_timestamp'));
  if v_leen is not null then
    raise exception 'leen la hora sin public._ahora(): %', v_leen;
  end if;
end $$;

-- @test reloj · guarda: ningún default de public lee la hora sin _ahora(), salvo las versiones
do $$
declare
  v_leen text;
  v_ahora int;
begin
  select string_agg(format('%s.%s', c.relname, a.attname), ', ' order by c.relname, a.attname) into v_leen
    from pg_attrdef d
    join pg_class c on c.oid = d.adrelid
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
   where pg_get_expr(d.adbin, d.adrelid) ~*
           '\m(now|clock_timestamp|statement_timestamp|transaction_timestamp|timeofday)\s*\(|\m(current_timestamp|current_date|current_time|localtimestamp|localtime)\M'
     and a.attname <> 'actualizado_en'
     and not (c.relname = 'horario_base' and a.attname = 'creado_en');
  if v_leen is not null then
    raise exception 'defaults que leen la hora sin public._ahora(): %', v_leen;
  end if;
  -- Y los 22 que P38 pasó a `_ahora()` siguen ahí (no se quitó un default de hora sin reemplazo).
  select count(*) into v_ahora
    from pg_attrdef d
    join pg_class c on c.oid = d.adrelid
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
   where pg_get_expr(d.adbin, d.adrelid) ~ '\m_ahora\(';
  if v_ahora < 22 then
    raise exception 'sólo % defaults de public usan _ahora(); P38 dejó 22', v_ahora;
  end if;
end $$;
