-- La máquina de estados de la solicitud (semilla §5.7, R4.7), `cambiar_estado_solicitud` y la auditoría de solicitudes y reuniones
-- (paso P05, C16–C19). Usa la semilla de pruebas: S1 de V1 `agendada` con R1 confirmada el 2026-11-03 (ya empezó); S2 de V2
-- `nueva`. Los errores de la tabla E se comparan con su texto exacto (`pruebas.error`). Cada bloque deja la base como estaba.

-- @test estados: el ayudante pruebas.error cae con otro mensaje y con un SQL que no falla
do $$
declare
  v_cayo boolean;
begin
  begin
    perform pruebas.error('otro mensaje', 'service_role', 'select 1 / 0', '22012', 'no es este');
    v_cayo := false;
  exception when others then
    v_cayo := true;
  end;
  if not v_cayo then raise exception 'pruebas.error no cae con un mensaje distinto del real'; end if;
  begin
    perform pruebas.error('sin error', 'service_role', 'select 1', '22012', 'division by zero');
    v_cayo := false;
  exception when others then
    v_cayo := true;
  end;
  if not v_cayo then raise exception 'pruebas.error no cae con un SQL que no falla'; end if;
  perform pruebas.error('el real', 'service_role', 'select 1 / 0', '22012', 'division by zero');
end $$;

-- @test estados: fila 9 permitida · V1 pasa S1 de agendada a realizada por RPC y R1 queda realizada
begin;
select pruebas.caso('9 por RPC', 'V1', $$select public.cambiar_estado_solicitud({S1}, 'realizada',
  (select actualizado_en from public.solicitudes where id = {S1})) ->> 'estado' = 'realizada'$$, 'verdad');
do $$
begin
  if (select estado from public.reuniones where id = '00000000-0000-4000-8000-000000000021') is distinct from 'realizada' then
    raise exception 'R1 no quedó realizada';
  end if;
end $$;
rollback;

-- @test estados: las 9 transiciones de §5.7 pasan y las prohibidas dan E2, también por service_role directo
begin;
do $$
declare
  t record;
  v_s uuid;
  v_i int := 0;
begin
  for t in select * from (values ('nueva', 'agendada', 'futura'), ('agendada', 'nueva', 'futura'),
      ('agendada', 'realizada', 'empezada'), ('agendada', 'no_asistio', 'empezada'), ('realizada', 'ganada', null),
      ('realizada', 'descartada', null), ('nueva', 'descartada', null), ('no_asistio', 'descartada', null),
      ('descartada', 'nueva', null)) x (desde, hacia, reunion) loop
    v_i := v_i + 1;
    v_s := pruebas.solicitud('00000000-0000-4000-8000-000000000003', t.desde);
    if t.reunion is not null then
      perform pruebas.reunion(v_s, '00000000-0000-4000-8000-000000000003', case t.reunion
        when 'futura' then now() + interval '3 days' + v_i * interval '1 hour' else now() - v_i * interval '1 hour' end);
    end if;
    perform pruebas.caso(t.desde || ' → ' || t.hacia, 'service_role',
      format('update public.solicitudes set estado = %L where id = %L', t.hacia, v_s), 'filas=1');
  end loop;
  for t in select * from (values ('agendada', 'descartada', 'futura'), ('nueva', 'ganada', null), ('realizada', 'nueva', null),
      ('ganada', 'nueva', null), ('nueva', 'agendada', null)) x (desde, hacia, reunion) loop
    v_i := v_i + 1;
    v_s := pruebas.solicitud('00000000-0000-4000-8000-000000000003', t.desde);
    if t.reunion is not null then
      perform pruebas.reunion(v_s, '00000000-0000-4000-8000-000000000003', now() + interval '3 days' + v_i * interval '1 hour');
    end if;
    perform pruebas.error(t.desde || ' → ' || t.hacia, 'service_role',
      format('update public.solicitudes set estado = %L where id = %L', t.hacia, v_s), 'P0001',
      'Ese cambio de estado no está permitido.');
  end loop;
end $$;
rollback;

-- @test estados: antes del inicio de la reunión no se marca no_asistio
begin;
select pruebas.error('antes del inicio', 'V1', $$select public.cambiar_estado_solicitud({S1}, 'no_asistio',
  (select actualizado_en from public.solicitudes where id = {S1}))$$, 'P0001', 'Ese cambio de estado no está permitido.',
  $$update public.reuniones set inicio = now() + interval '1 day', fin = now() + interval '1 day 30 minutes' where id = {R1}$$);
rollback;

-- @test estados: descartada → nueva sólo la hace el admin; el panel no hace las del servidor
begin;
update public.solicitudes set estado = 'descartada' where id = '00000000-0000-4000-8000-000000000012';
select pruebas.error('vendedor reabre', 'V2', $$select public.cambiar_estado_solicitud({S2}, 'nueva',
  (select actualizado_en from public.solicitudes where id = {S2}))$$, 'P0001', 'Ese cambio de estado no está permitido.');
select pruebas.caso('admin reabre', 'A', $$select public.cambiar_estado_solicitud({S2}, 'nueva',
  (select actualizado_en from public.solicitudes where id = {S2})) ->> 'estado' = 'nueva'$$, 'verdad');
select pruebas.error('panel cancela', 'A', $$select public.cambiar_estado_solicitud({S1}, 'nueva',
  (select actualizado_en from public.solicitudes where id = {S1}))$$, 'P0001', 'Ese cambio de estado no está permitido.');
rollback;

-- @test estados: ajena, inactivo, sin versión y conflicto
begin;
select pruebas.error('ajena', 'V1', $$select public.cambiar_estado_solicitud({S2}, 'descartada', now())$$, '42501',
  'Esta solicitud no está asignada a ti.');
select pruebas.error('inactivo', 'V3', $$select public.cambiar_estado_solicitud({S1}, 'realizada', now())$$, '42501',
  'Esta solicitud no está asignada a ti.');
select pruebas.error('no existe', 'A', $$select public.cambiar_estado_solicitud(gen_random_uuid(), 'realizada', now())$$, '42501',
  'Esta solicitud no está asignada a ti.');
select pruebas.caso('sin versión', 'V1', $$select public.cambiar_estado_solicitud({S1}, 'realizada', null)$$,
  'error=22023:p_actualizado_en_esperado');
select pruebas.error('conflicto', 'V1', $$select public.cambiar_estado_solicitud({S1}, 'realizada', '2000-01-01Z')$$, 'PT409',
  'Esta demo o solicitud cambió mientras la mirabas. Recarga para ver lo último.');
rollback;

-- @test estados: el cambio mueve ultimo_contacto_en y agendada → nueva (servidor) cancela R1
begin;
update public.solicitudes set ultimo_contacto_en = '2026-01-01Z' where id = '00000000-0000-4000-8000-000000000011';
update public.solicitudes set estado = 'nueva' where id = '00000000-0000-4000-8000-000000000011';
do $$
begin
  if (select ultimo_contacto_en from public.solicitudes where id = '00000000-0000-4000-8000-000000000011') is distinct from now() then
    raise exception 'ultimo_contacto_en no pasó a now()';
  end if;
  if (select row(estado, cancelada_en)::text from public.reuniones where id = '00000000-0000-4000-8000-000000000021')
     is distinct from row('cancelada'::public.estado_reunion, now())::text then
    raise exception 'R1 no quedó cancelada con cancelada_en = now()';
  end if;
end $$;
rollback;

-- @test estados: la auditoría de estado, asignación, reagenda y cancelación, con su actor y sin datos de contacto
begin;
select pruebas.caso('V1 cambia', 'V1', $$select public.cambiar_estado_solicitud({S1}, 'realizada',
  (select actualizado_en from public.solicitudes where id = {S1})) is not null$$, 'verdad');
select pruebas.caso('servidor cambia', 'service_role',
  $$update public.solicitudes set estado = 'descartada' where id = {S2}$$, 'filas=1');
update public.solicitudes set asignado_a = '00000000-0000-4000-8000-000000000002'
 where id = '00000000-0000-4000-8000-000000000012';
update public.reuniones set inicio = inicio + interval '1 hour', fin = fin + interval '1 hour'
 where id = '00000000-0000-4000-8000-000000000021';
update public.reuniones set estado = 'cancelada' where id = '00000000-0000-4000-8000-000000000021';
do $$
declare
  v_s1 constant uuid := '00000000-0000-4000-8000-000000000011';
  v_s2 constant uuid := '00000000-0000-4000-8000-000000000012';
  v_r1 constant uuid := '00000000-0000-4000-8000-000000000021';
  a record;
begin
  select * into a from public.auditoria where accion = 'estado' and registro_id = v_s1 and creado_en = now();
  if a is null or a.actor_id is distinct from '00000000-0000-4000-8000-000000000002'::uuid or a.tabla is distinct from 'solicitudes'
     or a.antes is distinct from '{"estado": "agendada"}' or a.despues is distinct from '{"estado": "realizada"}' then
    raise exception 'la auditoría del cambio de V1 no es la esperada: %', to_jsonb(a);
  end if;
  select * into a from public.auditoria where accion = 'estado' and registro_id = v_s2 and creado_en = now();
  if a is null or a.actor_id is not null or a.despues is distinct from '{"estado": "descartada"}' then
    raise exception 'la auditoría del cambio del servidor no es la esperada: %', to_jsonb(a);
  end if;
  select * into a from public.auditoria where accion = 'asignacion' and registro_id = v_s2;
  if a is null or a.antes is distinct from '{"asignado_a": "00000000-0000-4000-8000-000000000003"}'
     or a.despues is distinct from '{"asignado_a": "00000000-0000-4000-8000-000000000002"}' then
    raise exception 'la auditoría de asignación no es la esperada: %', to_jsonb(a);
  end if;
  select * into a from public.auditoria where accion = 'reagenda' and registro_id = v_r1;
  if a is null or a.tabla is distinct from 'reuniones'
     or (select array_agg(k order by k) from jsonb_object_keys(a.despues) k) is distinct from array['anfitrion_id', 'fin', 'inicio']
     or (select array_agg(k order by k) from jsonb_object_keys(a.antes) k) is distinct from array['anfitrion_id', 'fin', 'inicio']
     or a.despues ->> 'inicio' is null then
    raise exception 'la auditoría de reagenda no es la esperada: %', to_jsonb(a);
  end if;
  select * into a from public.auditoria where accion = 'cancelacion' and registro_id = v_r1;
  if a is null or a.antes is distinct from '{"estado": "realizada"}' or a.despues is distinct from '{"estado": "cancelada"}' then
    raise exception 'la auditoría de cancelación no es la esperada: %', to_jsonb(a);
  end if;
  if (select count(*) from (select 1 from public.auditoria where creado_en = now() limit 10) x) <> 5 then
    raise exception 'la auditoría no tiene exactamente 5 filas nuevas';
  end if;
end $$;
rollback;

-- @test estados: quién ejecuta cambiar_estado_solicitud y las funciones de trigger
do $$
declare
  f text;
begin
  f := 'public.cambiar_estado_solicitud(uuid, public.estado_solicitud, timestamptz)';
  if not has_function_privilege('authenticated', f, 'execute') then raise exception 'authenticated no ejecuta %', f; end if;
  if has_function_privilege('anon', f, 'execute') or has_function_privilege('service_role', f, 'execute') then
    raise exception 'anon o service_role ejecutan %', f;
  end if;
  if not (select p.prosecdef and p.proconfig @> array['search_path=""'] from pg_proc p where p.oid = f::regprocedure) then
    raise exception '% no es de definidor con search_path vacío', f;
  end if;
  foreach f in array array['public._validar_estado_solicitud()', 'public._efecto_en_reunion()', 'public._auditar_solicitud()',
      'public._auditar_reunion()', 'public._fallar(text)',
      'public._transicion(public.estado_solicitud, public.estado_solicitud)'] loop
    if has_function_privilege('authenticated', f, 'execute') or has_function_privilege('anon', f, 'execute') then
      raise exception 'authenticated o anon ejecutan %', f;
    end if;
  end loop;
end $$;
