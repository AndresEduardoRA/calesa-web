-- El catálogo de permisos de Calesa (semilla §2), sus funciones y los grants de `authenticated` (paso P02). Usa la semilla de
-- pruebas (`supabase/semillas/pruebas.sql`): A admin, V1 vendedora, V3 vendedor inactivo; `{A}`, `{S1}`… los reemplaza
-- `pruebas.caso`. Cada bloque deja la base como estaba (`begin; … rollback;`).

-- @test permisos: el catálogo y permisos_rol son exactamente los de §2 (con notas.gestionar, reuniones.cambiar y las de P30 y P31)
do $$
declare
  v_dif text;
begin
  with esperado (rol, clave, alcance) as (
    select 'vendedor', c, 'propio' from unnest(array['solicitudes.ver', 'solicitudes.estado', 'notas.crear', 'reuniones.ver',
      'bloqueos.gestionar', 'prospeccion.gestionar', 'metricas.ver', 'auditoria.ver', 'reuniones.cambiar']) c
    union all
    select 'admin', c, 'todos' from unnest(array['solicitudes.ver', 'solicitudes.estado', 'notas.crear', 'reuniones.ver',
      'bloqueos.gestionar', 'prospeccion.gestionar', 'metricas.ver', 'auditoria.ver', 'solicitudes.editar_contacto',
      'notas.gestionar', 'agenda.configurar', 'equipo.gestionar', 'usuarios.gestionar', 'actividad.ver', 'reuniones.cambiar',
      'solicitudes.reasignar', 'solicitudes.borrar', 'calculadora.configurar']) c
  ), real as (
    select rol::text, clave, alcance from public.permisos_rol
  )
  select string_agg(d, ', ' order by d) into v_dif from (
    (select 'falta ' || rol || ' ' || clave || ' ' || alcance as d from (select * from esperado except select * from real) x)
    union all
    (select 'sobra ' || rol || ' ' || clave || ' ' || alcance from (select * from real except select * from esperado) y)
  ) t;
  if v_dif is not null then raise exception 'permisos_rol no es el de §2: %', v_dif; end if;
  if (select array_agg(clave order by clave collate "C") from public.permisos)
     is distinct from (select array_agg(distinct clave collate "C" order by clave collate "C") from public.permisos_rol) then
    raise exception 'el catálogo de permisos no coincide con las claves de permisos_rol';
  end if;
  if exists (select 1 from public.permisos where char_length(descripcion) < 10) then
    raise exception 'una clave del catálogo no tiene descripción';
  end if;
end $$;

-- @test permisos: tiene_permiso e ids_con_alcance según el rol, el alcance y activo
begin;
select pruebas.caso('admin', 'A', $$select public.tiene_permiso('solicitudes.ver') and public.tiene_permiso('usuarios.gestionar')
  and public.ids_con_alcance('solicitudes.ver') = array[{A}] and public.es_admin() and public.es_usuario_activo()$$, 'verdad');
select pruebas.caso('vendedora', 'V1', $$select not public.tiene_permiso('solicitudes.ver') and not public.tiene_permiso('usuarios.gestionar')
  and public.ids_con_alcance('solicitudes.ver') = array[{V1}] and public.ids_con_alcance('usuarios.gestionar') = '{}'
  and not public.es_admin() and public.es_usuario_activo()$$, 'verdad');
select pruebas.caso('vendedor inactivo', 'V3', $$select not public.tiene_permiso('solicitudes.ver')
  and public.ids_con_alcance('solicitudes.ver') = '{}' and not public.es_usuario_activo()$$, 'verdad');
select pruebas.caso('puede_en_solicitud', 'V1', $$select public.puede_en_solicitud({S1}, 'solicitudes.ver')
  and not public.puede_en_solicitud({S2}, 'solicitudes.ver') and not public.puede_en_solicitud({S1}, 'usuarios.gestionar')$$, 'verdad');
select pruebas.caso('puede_en_solicitud del admin', 'A', $$select public.puede_en_solicitud({S2}, 'notas.crear')$$, 'verdad');
-- Va al final: deja a A inactivo hasta el rollback.
-- Es el único caso que distingue la condición `activo` de tiene_permiso: V3 no tiene ninguna clave con alcance `todos`.
select pruebas.caso('admin inactivo', 'A', $$select not public.tiene_permiso('solicitudes.ver') and not public.tiene_permiso('usuarios.gestionar')
  and public.ids_con_alcance('solicitudes.ver') = '{}' and not public.es_admin() and not public.es_usuario_activo()$$, 'verdad',
  $$update public.perfiles set activo = false where id = {A}$$);
rollback;

-- @test permisos: sin sesión no hay permisos
do $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  if public.tiene_permiso('solicitudes.ver') or public.ids_con_alcance('solicitudes.ver') <> '{}' or public.es_admin()
     or public.es_usuario_activo() or public.mis_permisos() <> '{"activo": false, "permisos": []}'::jsonb then
    raise exception 'sin sesión hay algún permiso';
  end if;
end $$;

-- @test permisos: mis_permisos da las claves exactas de V1 y nada al inactivo
begin;
select pruebas.caso('mis_permisos V1', 'V1', $$select jsonb_path_query_array(public.mis_permisos(), '$.permisos[*].clave')
  = '["auditoria.ver", "bloqueos.gestionar", "metricas.ver", "notas.crear", "prospeccion.gestionar", "reuniones.cambiar",
      "reuniones.ver", "solicitudes.estado", "solicitudes.ver"]'::jsonb
  and jsonb_path_query_array(public.mis_permisos(), '$.permisos[*] ? (@.alcance != "propio")') = '[]'::jsonb
  and jsonb_path_query_first(public.mis_permisos(), '$.activo') = 'true'::jsonb
  and not public.mis_permisos() ? 'rol'$$, 'verdad');
select pruebas.caso('mis_permisos V3', 'V3', $$select public.mis_permisos() = '{"activo": false, "permisos": []}'::jsonb$$, 'verdad');
rollback;

-- @test permisos: los grants de authenticated en public son exactamente los de C10 (tabla y columnas)
do $$
declare
  v_dif text;
begin
  with esperado (tabla, columna, privilegio) as (
    select t, '*', 'SELECT' from unnest(array['perfiles', 'invitaciones', 'config_agenda', 'horario_base', 'config_calculadora',
      'bloqueos', 'solicitudes', 'notas', 'enlaces_prospeccion', 'equipo', 'eventos', 'metricas_diarias', 'metricas_persona',
      'latidos', 'auditoria', 'correos_salientes', 'permisos', 'permisos_rol']) t
    union all select t, '*', 'DELETE' from unnest(array['bloqueos', 'notas', 'equipo']) t
    -- El Meet, sólo por actualizar_meet (P31, P2a).
    union all select 'perfiles', c, 'UPDATE' from unnest(array['nombre', 'whatsapp']) c
    union all select 'invitaciones', c, 'INSERT' from unnest(array['email', 'invitado_por']) c
    union all select 'invitaciones', 'estado', 'UPDATE'
    union all select 'bloqueos', c, 'INSERT' from unnest(array['perfil_id', 'inicio', 'fin', 'motivo', 'creado_por']) c
    union all select 'solicitudes', c, 'UPDATE' from unnest(array['nombre', 'email', 'importadora', 'pais', 'whatsapp',
      'ultimo_contacto_en']) c
    union all select 'reuniones', c, 'SELECT' from unnest(array['id', 'solicitud_id', 'anfitrion_id', 'inicio', 'fin',
      'zona_visitante', 'enlace_meet', 'estado', 'secuencia_ics', 'recordatorio_24_en', 'recordatorio_1_en', 'cancelada_en',
      'creado_en', 'actualizado_en']) c
    union all select 'notas', c, 'INSERT' from unnest(array['solicitud_id', 'autor_id', 'texto']) c
    union all select 'notas', 'texto', 'UPDATE'
    union all select 'enlaces_prospeccion', c, 'INSERT' from unnest(array['codigo', 'etiqueta', 'creado_por']) c
    union all select 'enlaces_prospeccion', c, 'UPDATE' from unnest(array['etiqueta', 'activo']) c
    union all select 'equipo', c, p from unnest(array['nombre', 'cargo', 'frase', 'foto_ruta', 'orden', 'visible']) c,
      unnest(array['INSERT', 'UPDATE']) p
  ), real as (
    select c.relname::text as tabla, '*' as columna, x.privilege_type as privilegio
      from pg_class c cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) x
     where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and x.grantee = 'authenticated'::regrole
    union all
    select c.relname::text, a.attname::text, x.privilege_type
      from pg_attribute a join pg_class c on c.oid = a.attrelid cross join lateral aclexplode(a.attacl) x
     where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped
       and x.grantee = 'authenticated'::regrole
  )
  select string_agg(d, ', ' order by d) into v_dif from (
    (select 'falta ' || privilegio || ' ' || tabla || '.' || columna as d from (select * from esperado except select * from real) x)
    union all
    (select 'sobra ' || privilegio || ' ' || tabla || '.' || columna from (select * from real except select * from esperado) y)
  ) t;
  if v_dif is not null then raise exception 'los grants de authenticated no son los de C10: %', v_dif; end if;
end $$;

-- @test permisos: quién ejecuta las funciones de permisos y de columnas protegidas
do $$
declare
  c record;
begin
  for c in select * from (values
      ('public.tiene_permiso(text)', true), ('public.ids_con_alcance(text)', true), ('public.es_usuario_activo()', true),
      ('public.es_admin()', true), ('public.puede_en_solicitud(uuid, text)', true), ('public.mis_permisos()', true),
      ('public._columna_cambiada(jsonb, jsonb, text[])', true), ('public._mas_minutos(timestamptz, integer)', true),
      ('public._proteger_solicitudes()', false), ('public._proteger_perfiles()', false), ('public._proteger_reuniones()', false),
      ('public._tocar_actualizado_en()', false), ('public._validar_estado_solicitud()', false),
      ('public._efecto_en_reunion()', false), ('public._auditar_solicitud()', false), ('public._auditar_reunion()', false),
      ('public._fallar(text)', false)
    ) t (f, autenticado) loop
    if has_function_privilege('authenticated', c.f, 'execute') is distinct from c.autenticado then
      raise exception 'authenticated % ejecutar %', case when c.autenticado then 'no puede' else 'puede' end, c.f;
    end if;
    if has_function_privilege('anon', c.f, 'execute') then raise exception 'anon puede ejecutar %', c.f; end if;
    if c.autenticado and not has_function_privilege('service_role', c.f, 'execute') then
      raise exception 'service_role no puede ejecutar %', c.f;
    end if;
  end loop;
  -- Toda función de definidor (prosecdef) de public fija su search_path vacío.
  for c in select p.oid::regprocedure::text as f from pg_proc p
            where p.pronamespace = 'public'::regnamespace and p.prosecdef
              and not coalesce(p.proconfig @> array['search_path=""'], false) loop
    raise exception 'función de definidor sin search_path vacío: %', c.f;
  end loop;
end $$;

-- @test permisos: la policy de solicitudes es InitPlan, no una llamada por fila
begin;
do $$
declare
  v_plan text := '';
  r record;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
  perform set_config('role', 'authenticated', true);
  for r in execute 'explain select * from public.solicitudes' loop
    v_plan := v_plan || r."QUERY PLAN" || E'\n';
  end loop;
  perform set_config('role', 'none', true);
  if v_plan !~ 'InitPlan' or v_plan ~ 'SubPlan' then
    raise exception 'la policy de solicitudes no es InitPlan: %', v_plan;
  end if;
end $$;
rollback;

-- @test permisos: lo público va por el esquema publico (dos funciones, ninguna tabla) y el bucket equipo tiene sus límites
do $$
declare
  c record;
begin
  if not has_schema_privilege('anon', 'publico', 'usage') or has_schema_privilege('anon', 'publico', 'create') then
    raise exception 'anon no tiene sólo usage en publico';
  end if;
  if exists (select 1 from pg_class where relnamespace = 'publico'::regnamespace) then
    raise exception 'publico tiene tablas, vistas o secuencias: lo público se lee sólo por sus funciones';
  end if;
  for c in select p.oid::regprocedure::text as f, p.prosecdef, p.proconfig, p.proacl
             from pg_proc p where p.pronamespace = 'publico'::regnamespace loop
    if c.f not in ('publico.equipo_visible()', 'publico.config_calculadora()') then
      raise exception 'publico tiene una función de más: %', c.f;
    end if;
    if not (c.prosecdef and c.proconfig @> array['search_path=""']) then
      raise exception '% no es de definidor con search_path vacío', c.f;
    end if;
    if not (has_function_privilege('anon', c.f, 'execute') and has_function_privilege('authenticated', c.f, 'execute')
            and has_function_privilege('service_role', c.f, 'execute')) then
      raise exception 'anon, authenticated y service_role no ejecutan %', c.f;
    end if;
    if exists (select 1 from aclexplode(c.proacl) x where x.grantee = 0) then
      raise exception 'PUBLIC ejecuta %', c.f;
    end if;
  end loop;
  if exists (select 1 from pg_proc p, unnest(p.proargnames) a
              where p.oid = 'publico.config_calculadora()'::regprocedure and a = 'actualizado_por') then
    raise exception 'publico.config_calculadora() expone actualizado_por';
  end if;
  if (select row(public, file_size_limit, allowed_mime_types)::text from storage.buckets where id = 'equipo')
     is distinct from '(t,5242880,"{image/jpeg,image/png,image/webp}")' then
    raise exception 'el bucket equipo no tiene 5 MiB y jpeg, png y webp';
  end if;
end $$;

-- @test permisos: el ayudante pruebas.caso (ejecuta SQL con cambio de rol) no lo alcanzan anon ni authenticated
do $$
begin
  if has_schema_privilege('anon', 'pruebas', 'usage') or has_schema_privilege('authenticated', 'pruebas', 'usage') then
    raise exception 'anon o authenticated tienen usage en el esquema pruebas';
  end if;
  if has_function_privilege('anon', 'pruebas.caso(text, text, text, text, text)', 'execute')
     or has_function_privilege('authenticated', 'pruebas.caso(text, text, text, text, text)', 'execute') then
    raise exception 'anon o authenticated pueden ejecutar pruebas.caso';
  end if;
end $$;
