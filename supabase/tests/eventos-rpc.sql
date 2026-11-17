-- El WhatsApp del turno y los eventos de medición (semilla §5.6 l. 510 y 516, R4.9, §3 l. 254, §9 l. 938; paso P31, C11–C14):
-- `elegir_whatsapp` elige a quien menos clics tuvo esta semana y registra el clic en la misma transacción (P3a); `registrar_evento`
-- escribe los demás tipos (P4a). Las dos son del servidor público: sólo `service_role`. Las llamadas que miran la respuesta corren como
-- postgres; los grants y los errores, con `pruebas.caso`. A = …01 (admin, fuera de turno y sin WhatsApp en la semilla), V1 = …02 y
-- V2 = …03 (en turno), V3 = …04 (inactivo), S1 = …11. Cada bloque deja la base como estaba.

-- @test whatsapp: el ejemplo de §5.6 · V1 con 7 clics y V2 con 3 en la semana → V2, que queda con 4 y su clic con página y UTM (C11, C12)
begin;
do $$
declare
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  v2 constant uuid := '00000000-0000-4000-8000-000000000003';
  r jsonb;
  v_e public.eventos;
begin
  insert into public.eventos (tipo, perfil_id) select 'clic_whatsapp', v1 from generate_series(1, 7);
  insert into public.eventos (tipo, perfil_id) select 'clic_whatsapp', v2 from generate_series(1, 3);
  r := public.elegir_whatsapp('/precios', 'google', 'cpc', 'lanzamiento', 'demo', 'boton');
  if r is distinct from jsonb_build_object('perfilId', v2, 'whatsapp', '+59170000003') then
    raise exception 'no eligió a V2 con su WhatsApp: %', r;
  end if;
  if (select count(*) from (select 1 from public.eventos where tipo = 'clic_whatsapp' and perfil_id = v2 limit 10) x) <> 4 then
    raise exception 'el clic de V2 no quedó registrado';
  end if;
  select * into v_e from public.eventos where tipo = 'clic_whatsapp' and pagina is not null;
  if v_e.perfil_id is distinct from v2 or v_e.pagina <> '/precios' or v_e.utm_source <> 'google' or v_e.utm_medium <> 'cpc'
     or v_e.utm_campaign <> 'lanzamiento' or v_e.utm_term <> 'demo' or v_e.utm_content <> 'boton' or v_e.solicitud_id is not null then
    raise exception 'el clic registrado no lleva la página y las UTM: %', to_jsonb(v_e);
  end if;
end $$;
rollback;

-- @test whatsapp: la semana pasada no cuenta; empate → el último clic más antiguo, sin ninguno primero; después perfiles.creado_en (C11)
begin;
do $$
declare
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  v2 constant uuid := '00000000-0000-4000-8000-000000000003';
begin
  -- V1 con 5 clics hace más de una semana y V2 con 1 esta semana: gana V1 (0 esta semana).
  insert into public.eventos (tipo, perfil_id, creado_en) select 'clic_whatsapp', v1, now() - interval '8 days' from generate_series(1, 5);
  insert into public.eventos (tipo, perfil_id) values ('clic_whatsapp', v2);
  if public.elegir_whatsapp() ->> 'perfilId' is distinct from v1::text then
    raise exception 'contó los clics de la semana pasada';
  end if;
  -- Los dos sin clics esta semana: gana el de último clic más antiguo (V2, hace 20 días).
  delete from public.eventos where tipo = 'clic_whatsapp';
  insert into public.eventos (tipo, perfil_id, creado_en) values ('clic_whatsapp', v1, now() - interval '10 days'),
    ('clic_whatsapp', v2, now() - interval '20 days');
  if public.elegir_whatsapp() ->> 'perfilId' is distinct from v2::text then
    raise exception 'el empate no fue para el último clic más antiguo';
  end if;
  -- V2 nunca recibió un clic: va primero.
  delete from public.eventos where tipo = 'clic_whatsapp';
  insert into public.eventos (tipo, perfil_id, creado_en) values ('clic_whatsapp', v1, now() - interval '30 days');
  if public.elegir_whatsapp() ->> 'perfilId' is distinct from v2::text then
    raise exception 'quien nunca recibió un clic no fue primero';
  end if;
  -- Ninguno con clics: el perfil más antiguo (V2), aunque su id sea mayor.
  delete from public.eventos where tipo = 'clic_whatsapp';
  update public.perfiles set creado_en = now() - interval '1 day' where id = v2;
  if public.elegir_whatsapp() ->> 'perfilId' is distinct from v2::text then
    raise exception 'el empate total no fue para el perfil más antiguo';
  end if;
end $$;
rollback;

-- @test whatsapp: sin vendedor en turno → el admin en turno (R4.9); inactivo o fuera de turno no entran; nadie → null y el clic igual (C11, C12)
begin;
do $$
declare
  a constant uuid := '00000000-0000-4000-8000-000000000001';
  v3 constant uuid := '00000000-0000-4000-8000-000000000004';
  r jsonb;
begin
  update public.perfiles set en_turno = false where rol = 'vendedor';
  update public.perfiles set whatsapp = '+59170000004', enlace_meet = 'https://meet.google.com/ina-ctiv-ooo', en_turno = true
   where id = v3;
  update public.perfiles set whatsapp = '+59170000001', enlace_meet = 'https://meet.google.com/adm-inis-tra', en_turno = true
   where id = a;
  r := public.elegir_whatsapp('/');
  if r is distinct from jsonb_build_object('perfilId', a, 'whatsapp', '+59170000001') then
    raise exception 'sin vendedor activo en turno no eligió al admin: %', r;
  end if;
  update public.perfiles set en_turno = false where id = a;
  r := public.elegir_whatsapp('/nadie');
  if r is not null then
    raise exception 'sin nadie en turno devolvió %', r;
  end if;
  if not exists (select 1 from public.eventos where tipo = 'clic_whatsapp' and pagina = '/nadie' and perfil_id is null) then
    raise exception 'sin nadie no registró el clic sin persona';
  end if;
end $$;
rollback;

-- @test whatsapp: un dato que rompe un check de eventos → 22023 con la restricción y sin clic (C12)
begin;
select pruebas.caso('página larga', 'service_role', format('select public.elegir_whatsapp(%L)', repeat('x', 201)),
  'error=22023:eventos_pagina_check');
do $$
begin
  if exists (select 1 from public.eventos where tipo = 'clic_whatsapp') then
    raise exception 'el clic rechazado quedó registrado';
  end if;
end $$;
rollback;

-- @test eventos: registrar_evento inserta sin persona; clic_whatsapp, null y un check → 22023 (C13)
begin;
select pruebas.caso('agendar', 'service_role', $$select public.registrar_evento('clic_agendar', '/precios', 'google')$$, 'filas=1');
select pruebas.caso('formulario', 'service_role',
  $$select public.registrar_evento('formulario_enviado', '/contacto', p_solicitud_id => {S1})$$, 'filas=1');
select pruebas.caso('whatsapp', 'service_role', $$select public.registrar_evento('clic_whatsapp', '/')$$, 'error=22023:p_tipo');
select pruebas.caso('nulo', 'service_role', $$select public.registrar_evento(null, '/')$$, 'error=22023:p_tipo');
select pruebas.caso('utm larga', 'service_role', format('select public.registrar_evento(%L, %L, %L)', 'clic_agendar', '/', repeat('u', 101)),
  'error=22023:eventos_utm_source_check');
do $$
begin
  if not exists (select 1 from public.eventos where tipo = 'clic_agendar' and pagina = '/precios' and utm_source = 'google'
                  and perfil_id is null and solicitud_id is null) then
    raise exception 'registrar_evento no dejó el clic_agendar';
  end if;
  if not exists (select 1 from public.eventos where tipo = 'formulario_enviado' and pagina = '/contacto' and perfil_id is null
                  and solicitud_id = '00000000-0000-4000-8000-000000000011') then
    raise exception 'registrar_evento no dejó el formulario con su solicitud';
  end if;
  if exists (select 1 from public.eventos where tipo = 'clic_whatsapp' or utm_source like 'uu%') then
    raise exception 'un evento rechazado quedó registrado';
  end if;
end $$;
rollback;

-- @test eventos: las dos sólo para service_role, de definidor; elegir_whatsapp con su candado y su conteo con tope (C11, C14)
begin;
select pruebas.caso('V1 elegir', 'V1', 'select public.elegir_whatsapp()', 'error=42501');
select pruebas.caso('anon registrar', 'anon', $$select public.registrar_evento('clic_agendar')$$, 'error=42501');
do $$
declare
  f text;
begin
  foreach f in array array['public.elegir_whatsapp(text, text, text, text, text, text)',
      'public.registrar_evento(public.tipo_evento, text, text, text, text, text, text, uuid)'] loop
    if not has_function_privilege('service_role', f, 'execute') then raise exception 'service_role no puede ejecutar %', f; end if;
    if has_function_privilege('authenticated', f, 'execute') then raise exception 'authenticated puede ejecutar %', f; end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'anon (o PUBLIC) puede ejecutar %', f; end if;
    if not exists (select 1 from pg_proc p where p.oid = f::regprocedure and p.prosecdef and p.proconfig @> array['search_path=""']) then
      raise exception '% no es de definidor con search_path vacío', f;
    end if;
  end loop;
  -- Dos clics a la vez no eligen igual por el mismo conteo: el candado; y el conteo de la semana tiene tope (eventos_tipo).
  if not exists (select 1 from pg_proc p where p.oid = 'public.elegir_whatsapp(text, text, text, text, text, text)'::regprocedure
                  and p.prosrc like '%pg_advisory_xact_lock(hashtext(''calesa:whatsapp''))%' and p.prosrc ~* '\mlimit 1000\M') then
    raise exception 'elegir_whatsapp no toma el candado calesa:whatsapp o no acota su conteo';
  end if;
end $$;
rollback;
