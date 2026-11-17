-- Juntar solicitudes repetidas (semilla §5.6 l. 513, R4.5; paso P30, C6, C14): repite la tabla de `juntarSolicitud`
-- (src/modules/solicitudes/entities/repetidas.ts) y suma las guardas de calculadora y del enlace. Corre como postgres (la RPC es de
-- `service_role`). V1 = …02, V2 = …03; LU-01 es un enlace de V2. Cada bloque deja la base como estaba.

-- @test repetidas: calculadora y después formulario con el mismo correo · una sola, se conserva el asignado, se llenan los vacíos
begin;
do $$
declare
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  r1 jsonb;
  r2 jsonb;
  v_s public.solicitudes;
  v_asignaciones bigint;
  v_a public.auditoria;
begin
  r1 := public.crear_o_juntar_solicitud(p_origen => 'calculadora', p_nombre => 'Repetida', p_email => 'Repe@Ejemplo.test',
    p_consentimiento_en => now(), p_calc_margen => 500, p_calc_consultas => 100, p_calc_respuesta => 'h4',
    p_origenes => array['copart']);
  update public.solicitudes set creado_en = now() - interval '3 days', asignado_a = v1, ultimo_contacto_en = now() - interval '3 days'
   where id = (r1 ->> 'id')::uuid;
  update public.perfiles set en_turno = false where id = v1;
  v_asignaciones := (select count(*) from public.auditoria where accion = 'asignacion');
  r2 := public.crear_o_juntar_solicitud(p_origen => 'formulario', p_nombre => 'Otro Nombre', p_email => 'REPE@ejemplo.test',
    p_consentimiento_en => now(), p_importadora => 'Imp Repe', p_pais => 'BO', p_whatsapp => '+59171000077', p_autos_hoy => 50,
    p_autos_meta => 80, p_calc_consultas => 999, p_utm_source => 'feria', p_origenes => array['iaai', 'copart', 'iaai']);
  select * into v_s from public.solicitudes where id = (r1 ->> 'id')::uuid;
  if r2 ->> 'id' <> r1 ->> 'id' or r2 -> 'juntada' <> 'true'::jsonb or r2 ->> 'origen' <> 'calculadora'
     or r2 #>> '{asignado,id}' is distinct from v1::text
     or (select count(*) from public.solicitudes where lower(email::text) = 'repe@ejemplo.test') <> 1 then
    raise exception 'no se juntó en la misma solicitud: %', r2;
  end if;
  if v_s.asignado_a is distinct from v1 or v_s.nombre <> 'Repetida' or v_s.origen <> 'calculadora' or v_s.importadora <> 'Imp Repe'
     or v_s.pais <> 'BO' or v_s.whatsapp <> '+59171000077' or v_s.autos_hoy <> 50 or v_s.autos_meta <> 80 or v_s.calc_margen <> 500
     or v_s.calc_consultas <> 100 or v_s.utm_source <> 'feria' or v_s.origenes <> array['copart', 'iaai']
     or v_s.ultimo_contacto_en <> now() then
    raise exception 'los campos no se juntaron como juntarSolicitud: %', to_jsonb(v_s);
  end if;
  select * into v_a from public.auditoria where accion = 'juntada' and registro_id = v_s.id;
  if v_a.id is null or v_a.tabla <> 'solicitudes' or v_a.actor_id is not null or v_a.antes is not null
     or v_a.despues <> '{"campos": ["autos_hoy", "autos_meta", "importadora", "origenes", "pais", "utm_source", "whatsapp"]}'::jsonb then
    raise exception 'la auditoría juntada no es la esperada: %', to_jsonb(v_a);
  end if;
  if (select count(*) from public.auditoria where accion = 'asignacion') <> v_asignaciones then
    raise exception 'juntar cambió el asignado';
  end if;
end $$;
rollback;

-- @test repetidas: bordes · 30 días justos se junta y 30 días y 1 s no; descartada no; con dos abiertas, la más reciente; agendada sí
begin;
do $$
declare
  v2 constant uuid := '00000000-0000-4000-8000-000000000003';
  r jsonb;
  v_id uuid;
  v_vieja uuid;
  v_nueva uuid;
begin
  r := public.crear_o_juntar_solicitud('formulario', 'Borde', 'borde@ejemplo.test', now(), 'Imp', 'BO', '+59171000001', 10);
  v_id := (r ->> 'id')::uuid;
  update public.solicitudes set creado_en = now() - interval '30 days' where id = v_id;
  r := public.crear_o_juntar_solicitud('formulario', 'Borde', 'borde@ejemplo.test', now(), 'Imp', 'BO', '+59171000001', 10);
  if (r ->> 'id')::uuid is distinct from v_id or r -> 'juntada' <> 'true'::jsonb then
    raise exception 'a 30 días justos no se juntó: %', r;
  end if;
  update public.solicitudes set creado_en = now() - interval '30 days 1 second' where id = v_id;
  r := public.crear_o_juntar_solicitud('formulario', 'Borde', 'borde@ejemplo.test', now(), 'Imp', 'BO', '+59171000001', 10);
  if (r ->> 'id')::uuid = v_id or r -> 'juntada' <> 'false'::jsonb then
    raise exception 'a 30 días y 1 s se juntó: %', r;
  end if;
  update public.solicitudes set estado = 'descartada' where id = (r ->> 'id')::uuid;
  r := public.crear_o_juntar_solicitud('formulario', 'Borde', 'borde@ejemplo.test', now(), 'Imp', 'BO', '+59171000001', 10);
  if r -> 'juntada' <> 'false'::jsonb then
    raise exception 'se juntó con una descartada: %', r;
  end if;
  v_vieja := pruebas.solicitud(v2);
  v_nueva := pruebas.solicitud(v2, 'agendada');
  update public.solicitudes set email = 'dos@ejemplo.test', creado_en = now() - interval '5 days' where id = v_vieja;
  update public.solicitudes set email = 'dos@ejemplo.test', creado_en = now() - interval '2 days' where id = v_nueva;
  r := public.crear_o_juntar_solicitud('formulario', 'Dos', 'dos@ejemplo.test', now(), 'Imp', 'BO', '+59171000001', 10);
  if (r ->> 'id')::uuid is distinct from v_nueva or r ->> 'estado' <> 'agendada' or r -> 'juntada' <> 'true'::jsonb then
    raise exception 'con dos abiertas no se juntó con la agendada más reciente: %', r;
  end if;
end $$;
rollback;

-- @test repetidas: guardas · margen sólo en calculadora, rangos de calculadora, el par de autos, sin cambios y el enlace ajeno
begin;
do $$
declare
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  v2 constant uuid := '00000000-0000-4000-8000-000000000003';
  r jsonb;
  v_s public.solicitudes;
begin
  r := public.crear_o_juntar_solicitud('formulario', 'Form', 'g1@ejemplo.test', now(), 'Imp', 'BO', '+59171000001', 10);
  r := public.crear_o_juntar_solicitud(p_origen => 'calculadora', p_nombre => 'Form', p_email => 'g1@ejemplo.test',
    p_consentimiento_en => now(), p_calc_margen => 500);
  if r -> 'juntada' <> 'true'::jsonb or (select calc_margen from public.solicitudes where id = (r ->> 'id')::uuid) is not null then
    raise exception 'una formulario se llenó con margen: %', r;
  end if;
  r := public.crear_o_juntar_solicitud(p_origen => 'calculadora', p_nombre => 'Calc', p_email => 'g2@ejemplo.test',
    p_consentimiento_en => now(), p_calc_margen => 500);
  r := public.crear_o_juntar_solicitud('formulario', 'Calc', 'g2@ejemplo.test', now(), 'Imp', 'BO', '+59171000001', 1500, 1600,
    p_administracion => 120);
  select * into v_s from public.solicitudes where id = (r ->> 'id')::uuid;
  if r -> 'juntada' <> 'true'::jsonb or v_s.autos_hoy is not null or v_s.autos_meta is not null or v_s.administracion is not null
     or v_s.importadora <> 'Imp' then
    raise exception 'una calculadora se llenó fuera de sus rangos: %', to_jsonb(v_s);
  end if;
  r := public.crear_o_juntar_solicitud('formulario', 'Autos', 'g3@ejemplo.test', now(), 'Imp', 'BO', '+59171000001', 100);
  r := public.crear_o_juntar_solicitud('formulario', 'Autos', 'g3@ejemplo.test', now(), 'Imp', 'BO', '+59171000001', 30, 50);
  select * into v_s from public.solicitudes where id = (r ->> 'id')::uuid;
  if v_s.autos_hoy <> 100 or v_s.autos_meta is not null
     or (select despues from public.auditoria where accion = 'juntada' and registro_id = v_s.id) <> '{"campos": []}'::jsonb then
    raise exception 'el par de autos rompió meta >= hoy o la juntada sin cambios no dio []: %', to_jsonb(v_s);
  end if;
  r := public.crear_o_juntar_solicitud('formulario', 'Ajena', 'g4@ejemplo.test', now(), 'Imp', 'BO', '+59171000001', 10);
  update public.solicitudes set asignado_a = v1 where id = (r ->> 'id')::uuid;
  r := public.crear_o_juntar_solicitud('formulario', 'Ajena', 'g4@ejemplo.test', now(), 'Imp', 'BO', '+59171000001', 10,
    p_ref_codigo => 'LU-01');
  if (select ref_codigo from public.solicitudes where id = (r ->> 'id')::uuid) is not null
     or public._limitar_a((r ->> 'id')::uuid) is not null then
    raise exception 'una repetida de V1 tomó el enlace de V2: %', r;
  end if;
  r := public.crear_o_juntar_solicitud('formulario', 'Propia', 'g5@ejemplo.test', now(), 'Imp', 'BO', '+59171000001', 10);
  update public.solicitudes set asignado_a = v2 where id = (r ->> 'id')::uuid;
  r := public.crear_o_juntar_solicitud('formulario', 'Propia', 'g5@ejemplo.test', now(), 'Imp', 'BO', '+59171000001', 10,
    p_ref_codigo => 'LU-01');
  if (select ref_codigo from public.solicitudes where id = (r ->> 'id')::uuid) is distinct from 'LU-01'
     or public._limitar_a((r ->> 'id')::uuid) is distinct from v2 then
    raise exception 'una repetida de V2 no tomó su enlace: %', r;
  end if;
end $$;
rollback;

-- @test repetidas: el check de auditoria admite juntada y sigue rechazando una acción desconocida (C14)
begin;
select pruebas.caso('juntada', 'definer:A', $$insert into public.auditoria (accion, tabla, registro_id) values ('juntada',
  'solicitudes', {S1})$$, 'filas=1');
select pruebas.caso('otra', 'definer:A', $$insert into public.auditoria (accion, tabla, registro_id) values ('otra', 'solicitudes',
  {S1})$$, 'error=23514');
do $$
begin
  if (select pg_get_constraintdef(c.oid) from pg_constraint c where c.conname = 'auditoria_accion_check')
     !~ 'estado.*asignacion.*reagenda.*cancelacion.*borrado.*rol.*activo.*config.*juntada' then
    raise exception 'auditoria_accion_check no tiene las 9 acciones';
  end if;
end $$;
rollback;
