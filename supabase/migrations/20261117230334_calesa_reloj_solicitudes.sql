-- Calesa · el reloj del reparto y de las solicitudes públicas (paso P38, C3 y C4): las funciones que leían `now()` lo leen de
-- `public._ahora()`, envuelta en `select` para que se evalúe una vez por consulta (InitPlan). Cada una es su definición vigente, sin otro
-- cambio: `create or replace` conserva dueño y grants, y la sentencia repite firma, `security definer`, `set` y volatilidad tal cual.
-- Lo vigila `supabase/tests/reloj-copias.test.ts`. `crear_o_juntar_solicitud` pasa de 80 líneas: se copia tal cual a propósito
-- (partirla cambiaría la función, y este paso sólo cambia la hora).

-- _elegir_asignado: la de calesa_crear_solicitud.sql, con la hora de _ahora() (2 líneas).
create or replace function public._elegir_asignado(p_extra jsonb default '{}')
returns uuid
language sql
stable
set search_path = ''
as $$
  with w as (
    select (date_trunc('week', (select public._ahora()) at time zone c.zona_horaria) at time zone c.zona_horaria) as desde,
           ((date_trunc('week', (select public._ahora()) at time zone c.zona_horaria) + interval '7 days') at time zone c.zona_horaria) as hasta
      from public.config_agenda c where c.id = 1
  ), rol as (
    select case when exists (select 1 from public.perfiles v where v.rol = 'vendedor' and v.activo and v.en_turno)
                then 'vendedor' else 'admin' end::public.rol_usuario as rol
  )
  select p.id
    from public.perfiles p
    join rol on rol.rol = p.rol
   cross join w
   cross join lateral (
     -- solicitudes_asignado (asignado_a, creado_en desc, id desc): las de la semana, con tope.
     select count(*) as n from (
       select 1 from public.solicitudes s
        where s.asignado_a = p.id and s.creado_en >= w.desde and s.creado_en < w.hasta
        limit 1000) x) k
   cross join lateral (
     -- solicitudes_asignado: la más reciente que tiene.
     select max(s.creado_en) as ultima from public.solicitudes s where s.asignado_a = p.id) u
   where p.activo and p.en_turno
   order by k.n + coalesce((p_extra ->> p.id::text)::int, 0), u.ultima nulls first, p.creado_en, p.id
   limit 1
$$;

-- _juntar_solicitud: la de calesa_crear_solicitud.sql, con la hora de _ahora() (1 línea).
create or replace function public._juntar_solicitud(p_e public.solicitudes, p_n public.solicitudes)
returns text[]
language plpgsql
set search_path = ''
as $$
declare
  v_calc boolean := p_e.origen = 'calculadora';
  v_j public.solicitudes := p_e;
  v_hoy int := coalesce(p_e.autos_hoy, p_n.autos_hoy);
  v_meta int := coalesce(p_e.autos_meta, p_n.autos_meta);
  v_autos boolean;
  v_campos text[];
begin
  v_j.importadora := coalesce(p_e.importadora, p_n.importadora);
  v_j.pais := coalesce(p_e.pais, p_n.pais);
  v_j.whatsapp := coalesce(p_e.whatsapp, p_n.whatsapp);
  v_j.vendedores := coalesce(p_e.vendedores, p_n.vendedores);
  v_j.administracion := coalesce(p_e.administracion, case when not v_calc or p_n.administracion <= 80 then p_n.administracion end);
  v_j.calc_margen := coalesce(p_e.calc_margen, case when v_calc then p_n.calc_margen end);
  v_j.calc_consultas := coalesce(p_e.calc_consultas, p_n.calc_consultas);
  v_j.calc_respuesta := coalesce(p_e.calc_respuesta, p_n.calc_respuesta);
  v_j.ref_codigo := coalesce(p_e.ref_codigo, p_n.ref_codigo);
  v_j.utm_source := coalesce(p_e.utm_source, p_n.utm_source);
  v_j.utm_medium := coalesce(p_e.utm_medium, p_n.utm_medium);
  v_j.utm_campaign := coalesce(p_e.utm_campaign, p_n.utm_campaign);
  v_j.utm_term := coalesce(p_e.utm_term, p_n.utm_term);
  v_j.utm_content := coalesce(p_e.utm_content, p_n.utm_content);
  v_j.pagina_origen := coalesce(p_e.pagina_origen, p_n.pagina_origen);
  -- El par de autos entra entero o no entra: nunca `meta < hoy`, ni más de 400 en una de calculadora.
  v_autos := not (v_hoy is not null and v_meta is not null and v_meta < v_hoy) and not (v_calc and coalesce(v_hoy, 0) > 400);
  if v_autos then
    v_j.autos_hoy := v_hoy;
    v_j.autos_meta := v_meta;
  end if;
  v_j.origenes := p_e.origenes || array(
    select x.o from (select o, min(i) as i from unnest(p_n.origenes) with ordinality t (o, i)
                      where not (o = any (p_e.origenes)) group by o) x
     order by x.i);
  select coalesce(array_agg(j.key order by j.key collate "C"), '{}') into v_campos
    from jsonb_each(to_jsonb(v_j)) j
   where j.value is distinct from to_jsonb(p_e) -> j.key;
  update public.solicitudes
     set importadora = v_j.importadora, pais = v_j.pais, whatsapp = v_j.whatsapp, autos_hoy = v_j.autos_hoy,
         autos_meta = v_j.autos_meta, vendedores = v_j.vendedores, administracion = v_j.administracion,
         origenes = v_j.origenes, calc_margen = v_j.calc_margen, calc_consultas = v_j.calc_consultas,
         calc_respuesta = v_j.calc_respuesta, ref_codigo = v_j.ref_codigo, utm_source = v_j.utm_source,
         utm_medium = v_j.utm_medium, utm_campaign = v_j.utm_campaign, utm_term = v_j.utm_term, utm_content = v_j.utm_content,
         pagina_origen = v_j.pagina_origen, ultimo_contacto_en = (select public._ahora())
   where id = p_e.id;
  -- Nunca valores en el historial (semilla §3 l. 262): sólo qué columnas cambiaron.
  insert into public.auditoria (actor_id, accion, tabla, registro_id, antes, despues)
  values (null, 'juntada', 'solicitudes', p_e.id, null, jsonb_build_object('campos', to_jsonb(v_campos)));
  return v_campos;
end;
$$;

-- crear_o_juntar_solicitud: la de calesa_crear_solicitud.sql, con la hora de _ahora() (2 líneas).
create or replace function public.crear_o_juntar_solicitud(p_origen public.origen_solicitud, p_nombre text, p_email text,
  p_consentimiento_en timestamptz, p_importadora text default null, p_pais text default null, p_whatsapp text default null,
  p_autos_hoy int default null, p_autos_meta int default null, p_vendedores int default null, p_administracion int default null,
  p_calc_margen int default null, p_calc_consultas int default null, p_calc_respuesta public.tiempo_respuesta default null,
  p_ref_codigo text default null, p_utm_source text default null, p_utm_medium text default null, p_utm_campaign text default null,
  p_utm_term text default null, p_utm_content text default null, p_pagina_origen text default null, p_origenes text[] default '{}')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ref text := upper(btrim(p_ref_codigo));
  v_creador uuid;
  v_creador_activo boolean;
  v_n public.solicitudes;
  v_e public.solicitudes;
  v_juntada boolean := false;
  v_columna text;
  v_restriccion text;
begin
  if p_origen is null or p_origen = 'prospeccion' then
    raise exception 'El origen de la solicitud no es válido.' using errcode = '22023', hint = 'p_origen';
  end if;
  perform public._bloquear_solicitudes();
  -- C4: enlaces_prospeccion (codigo) único. Con un enlace inexistente o inactivo, `?ref` se ignora (R4.19).
  select e.creado_por, p.activo into v_creador, v_creador_activo
    from public.enlaces_prospeccion e
    join public.perfiles p on p.id = e.creado_por
   where e.codigo = v_ref and e.activo;
  if v_creador is null then
    v_ref := null;
  end if;
  v_n.origen := case when v_creador is not null and p_origen = 'formulario' then 'prospeccion' else p_origen end;
  v_n.nombre := p_nombre;
  v_n.email := p_email::extensions.citext;
  v_n.importadora := p_importadora;
  v_n.pais := p_pais;
  v_n.whatsapp := p_whatsapp;
  v_n.autos_hoy := p_autos_hoy;
  v_n.autos_meta := p_autos_meta;
  v_n.vendedores := p_vendedores;
  v_n.administracion := p_administracion;
  v_n.origenes := coalesce(p_origenes, '{}');
  v_n.calc_margen := p_calc_margen;
  v_n.calc_consultas := p_calc_consultas;
  v_n.calc_respuesta := p_calc_respuesta;
  v_n.consentimiento_en := p_consentimiento_en;
  v_n.ref_codigo := v_ref;
  v_n.utm_source := p_utm_source;
  v_n.utm_medium := p_utm_medium;
  v_n.utm_campaign := p_utm_campaign;
  v_n.utm_term := p_utm_term;
  v_n.utm_content := p_utm_content;
  v_n.pagina_origen := p_pagina_origen;
  -- C6, solicitudes_email (email): la abierta más reciente de los últimos 30 días. Con `search_path` vacío, `=` entre citext cae en
  -- `text = text` y distingue mayúsculas: va el operador de citext, calificado.
  select * into v_e from public.solicitudes s
   where s.email operator(extensions.=) p_email::extensions.citext and s.estado in ('nueva', 'agendada') and s.creado_en >= (select public._ahora()) - interval '30 days'
   order by s.creado_en desc, s.id desc
   limit 1
     for update;
  begin
    if v_e.id is not null then
      -- R4.5 conserva el asignado: un enlace de otro le pasaría la agenda y, al reservar, la solicitud (P3a).
      if v_e.asignado_a is distinct from v_creador then
        v_n.ref_codigo := null;
      end if;
      perform public._juntar_solicitud(v_e, v_n);
      v_juntada := true;
      select * into v_n from public.solicitudes where id = v_e.id;
    else
      insert into public.solicitudes (origen, nombre, email, importadora, pais, whatsapp, autos_hoy, autos_meta, vendedores,
        administracion, origenes, calc_margen, calc_consultas, calc_respuesta, consentimiento_en, ref_codigo, utm_source,
        utm_medium, utm_campaign, utm_term, utm_content, pagina_origen, asignado_a, estado, ultimo_contacto_en)
      values (v_n.origen, v_n.nombre, v_n.email, v_n.importadora, v_n.pais, v_n.whatsapp, v_n.autos_hoy, v_n.autos_meta,
        v_n.vendedores, v_n.administracion, v_n.origenes, v_n.calc_margen, v_n.calc_consultas, v_n.calc_respuesta,
        v_n.consentimiento_en, v_n.ref_codigo, v_n.utm_source, v_n.utm_medium, v_n.utm_campaign, v_n.utm_term, v_n.utm_content,
        v_n.pagina_origen, case when v_creador_activo then v_creador else public._elegir_asignado() end, 'nueva', (select public._ahora()))
      returning * into v_n;
    end if;
  exception when check_violation or not_null_violation then
    get stacked diagnostics v_columna = column_name, v_restriccion = constraint_name;
    raise exception 'Los datos de la solicitud no son válidos.' using errcode = '22023',
      hint = coalesce(nullif(v_columna, ''), v_restriccion);
  end;
  return jsonb_build_object('id', v_n.id, 'juntada', v_juntada, 'origen', v_n.origen, 'estado', v_n.estado, 'creadoEn', v_n.creado_en,
    'asignado', (select jsonb_build_object('id', p.id, 'nombre', p.nombre, 'email', p.email::text, 'whatsapp', p.whatsapp)
                   from public.perfiles p where p.id = v_n.asignado_a));
end;
$$;

-- elegir_whatsapp: la de calesa_whatsapp_eventos.sql, con la hora de _ahora() (2 líneas).
create or replace function public.elegir_whatsapp(p_pagina text default null, p_utm_source text default null, p_utm_medium text default null,
  p_utm_campaign text default null, p_utm_term text default null, p_utm_content text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_whatsapp text;
  v_columna text;
  v_restriccion text;
begin
  perform pg_advisory_xact_lock(hashtext('calesa:whatsapp'));
  with w as (
    select (date_trunc('week', (select public._ahora()) at time zone c.zona_horaria) at time zone c.zona_horaria) as desde,
           ((date_trunc('week', (select public._ahora()) at time zone c.zona_horaria) + interval '7 days') at time zone c.zona_horaria) as hasta
      from public.config_agenda c where c.id = 1
  ), rol as (
    select case when exists (select 1 from public.perfiles v
                              where v.rol = 'vendedor' and v.activo and v.en_turno and v.whatsapp is not null)
                then 'vendedor' else 'admin' end::public.rol_usuario as rol
  )
  select p.id, p.whatsapp into v_id, v_whatsapp
    from public.perfiles p
    join rol on rol.rol = p.rol
   cross join w
   cross join lateral (
     -- eventos_tipo (tipo, perfil_id, creado_en desc): los clics de la semana, con tope.
     select count(*) as n from (
       select 1 from public.eventos e
        where e.tipo = 'clic_whatsapp' and e.perfil_id = p.id and e.creado_en >= w.desde and e.creado_en < w.hasta
        limit 1000) x) k
   cross join lateral (
     -- eventos_tipo: su último clic.
     select max(e.creado_en) as ultimo from public.eventos e where e.tipo = 'clic_whatsapp' and e.perfil_id = p.id) u
   where p.activo and p.en_turno and p.whatsapp is not null
   order by k.n, u.ultimo nulls first, p.creado_en, p.id
   limit 1;
  begin
    insert into public.eventos (tipo, pagina, utm_source, utm_medium, utm_campaign, utm_term, utm_content, perfil_id)
    values ('clic_whatsapp', p_pagina, p_utm_source, p_utm_medium, p_utm_campaign, p_utm_term, p_utm_content, v_id);
  exception when check_violation then
    get stacked diagnostics v_columna = column_name, v_restriccion = constraint_name;
    raise exception 'El evento no es válido.' using errcode = '22023', hint = coalesce(nullif(v_columna, ''), v_restriccion);
  end;
  if v_id is null then
    return null;
  end if;
  return jsonb_build_object('perfilId', v_id, 'whatsapp', v_whatsapp);
end;
$$;
