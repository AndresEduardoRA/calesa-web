-- Las métricas que llevan los triggers (semilla §3 l. 256-258, R4.4, l. 665; paso P31, C15–C22; P6a, P7a, P8a): cada cambio suma una
-- fila de `metricas_diarias` y de `metricas_persona` en el día local de config_agenda (America/La_Paz). La semilla de pruebas ya deja
-- filas de hoy (S1, S2 y R1 cuentan al insertarse): cada prueba lee el valor antes y después y compara la diferencia. V1 = …02,
-- V2 = …03. Cada bloque deja la base como estaba, salvo el primero, que deja los ayudantes de este archivo en `pruebas`.

-- @test metricas: los ayudantes (pruebas.metrica = el valor de una columna en un día, 0 sin fila; pruebas.solicitud_del = una con su creado_en)
create or replace function pruebas.metrica(p_dia date, p_columna text, p_perfil uuid default null)
returns int
language plpgsql
stable
as $$
declare
  v int;
begin
  if p_perfil is null then
    execute format('select %I from public.metricas_diarias where dia = $1', p_columna) into v using p_dia;
  else
    execute format('select %I from public.metricas_persona where dia = $1 and perfil_id = $2', p_columna) into v using p_dia, p_perfil;
  end if;
  return coalesce(v, 0);
end;
$$;
create or replace function pruebas.solicitud_del(p_creado timestamptz, p_asignado uuid, p_estado text default 'nueva')
returns uuid
language sql
as $$
  insert into public.solicitudes (origen, nombre, email, importadora, pais, whatsapp, autos_hoy, consentimiento_en, asignado_a,
    estado, creado_en)
  values ('formulario', 'Cliente de Métricas', 'm' || replace(gen_random_uuid()::text, '-', '') || '@ejemplo.test',
    'Importadora Prueba', 'BO', '+59171000099', 10, now(), p_asignado, p_estado::public.estado_solicitud, p_creado)
  returning id
$$;
revoke all on function pruebas.metrica(date, text, uuid), pruebas.solicitud_del(timestamptz, uuid, text) from public, anon, authenticated;

-- @test metricas: una solicitud nueva suma en su día y a su asignado; sin asignado, sólo el día; a las 23:30 de La Paz es ese día (C15, C16)
begin;
do $$
declare
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  hoy constant date := (now() at time zone 'America/La_Paz')::date;
  v_d int := pruebas.metrica(hoy, 'solicitudes');
  v_p int := pruebas.metrica(hoy, 'solicitudes_asignadas', v1);
  v_17 int := pruebas.metrica('2026-11-17', 'solicitudes');
  v_18 int := pruebas.metrica('2026-11-18', 'solicitudes');
  -- Si hoy es el 17 o el 18, las dos de arriba también cuentan ahí (un `if` de plpgsql no lleva un `case`: termina en su `then`).
  v_mas17 int := case when hoy = '2026-11-17' then 2 else 0 end;
  v_mas18 int := case when hoy = '2026-11-18' then 2 else 0 end;
begin
  perform pruebas.solicitud(v1);
  if pruebas.metrica(hoy, 'solicitudes') <> v_d + 1 or pruebas.metrica(hoy, 'solicitudes_asignadas', v1) <> v_p + 1 then
    raise exception 'la solicitud de V1 no sumó en el día y a V1';
  end if;
  perform pruebas.solicitud(null);
  if pruebas.metrica(hoy, 'solicitudes') <> v_d + 2 or pruebas.metrica(hoy, 'solicitudes_asignadas', v1) <> v_p + 1 then
    raise exception 'la solicitud sin asignado no sumó sólo en el día';
  end if;
  -- 2026-11-18 03:30Z = 2026-11-17 23:30 en La Paz.
  perform pruebas.solicitud_del('2026-11-18 03:30Z', null);
  if pruebas.metrica('2026-11-17', 'solicitudes') <> v_17 + 1 + v_mas17
     or pruebas.metrica('2026-11-18', 'solicitudes') <> v_18 + v_mas18 then
    raise exception 'la solicitud de las 23:30 de La Paz no contó el 17';
  end if;
end $$;
rollback;

-- @test metricas: una reasignación resta a quien la tenía y suma a quien la recibe en el día de la solicitud; nunca bajo 0 (C15, C17)
begin;
do $$
declare
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  v2 constant uuid := '00000000-0000-4000-8000-000000000003';
  hoy constant date := (now() at time zone 'America/La_Paz')::date;
  d constant date := ((now() - interval '10 days') at time zone 'America/La_Paz')::date;
  d40 constant date := ((now() - interval '40 days') at time zone 'America/La_Paz')::date;
  v_1 int := pruebas.metrica(d, 'solicitudes_asignadas', v1);
  v_2 int := pruebas.metrica(d, 'solicitudes_asignadas', v2);
  v_h1 int := pruebas.metrica(hoy, 'solicitudes_asignadas', v1);
  v_h2 int := pruebas.metrica(hoy, 'solicitudes_asignadas', v2);
  v_s uuid := pruebas.solicitud_del(now() - interval '10 days', v1);
  v_sin uuid := pruebas.solicitud_del(now() - interval '10 days', null);
begin
  if pruebas.metrica(d, 'solicitudes_asignadas', v1) <> v_1 + 1 then
    raise exception 'la solicitud de hace 10 días no sumó a V1 ese día';
  end if;
  update public.solicitudes set asignado_a = v2 where id = v_s;
  if pruebas.metrica(d, 'solicitudes_asignadas', v1) <> v_1 or pruebas.metrica(d, 'solicitudes_asignadas', v2) <> v_2 + 1 then
    raise exception 'la reasignación no restó a V1 y sumó a V2 en el día de la solicitud';
  end if;
  update public.solicitudes set asignado_a = v2 where id = v_sin;
  if pruebas.metrica(d, 'solicitudes_asignadas', v1) <> v_1 or pruebas.metrica(d, 'solicitudes_asignadas', v2) <> v_2 + 2
     or pruebas.metrica(hoy, 'solicitudes_asignadas', v1) <> v_h1 or pruebas.metrica(hoy, 'solicitudes_asignadas', v2) <> v_h2 then
    raise exception 'asignar una sin asignado no sólo sumó a V2 en el día de la solicitud';
  end if;
  -- Sin fila de V1 ese día (la borra la prueba), perderla deja 0, no -1.
  v_s := pruebas.solicitud_del(now() - interval '40 days', v1);
  delete from public.metricas_persona where dia = d40 and perfil_id = v1;
  update public.solicitudes set asignado_a = v2 where id = v_s;
  if exists (select 1 from public.metricas_persona where dia = d40 and solicitudes_asignadas < 0) then
    raise exception 'una métrica quedó bajo 0';
  end if;
end $$;
rollback;

-- @test metricas: juntar una solicitud repetida (R4.5) no suma nada; la primera sí (C16)
begin;
do $$
declare
  hoy constant date := (now() at time zone 'America/La_Paz')::date;
  v_d int := pruebas.metrica(hoy, 'solicitudes');
  v_dia jsonb;
  v_personas jsonb;
  r jsonb;
begin
  perform public.crear_o_juntar_solicitud('formulario', 'Repetida', 'metrica@ejemplo.test', now(), 'Imp', 'BO', '+59171000001', 10);
  if pruebas.metrica(hoy, 'solicitudes') <> v_d + 1 then
    raise exception 'crear_o_juntar_solicitud no sumó la solicitud nueva';
  end if;
  v_dia := (select to_jsonb(m) from public.metricas_diarias m where dia = hoy);
  v_personas := (select jsonb_agg(to_jsonb(m) order by m.perfil_id) from public.metricas_persona m where dia = hoy);
  r := public.crear_o_juntar_solicitud('formulario', 'Repetida', 'metrica@ejemplo.test', now(), 'Imp', 'BO', '+59171000001', 20);
  if r -> 'juntada' <> 'true'::jsonb or (select to_jsonb(m) from public.metricas_diarias m where dia = hoy) <> v_dia
     or (select jsonb_agg(to_jsonb(m) order by m.perfil_id) from public.metricas_persona m where dia = hoy) <> v_personas then
    raise exception 'juntar la repetida movió las métricas: %', r;
  end if;
end $$;
rollback;

-- @test metricas: una ganada que nace así no suma; reasignarla mueve sólo solicitudes_asignadas, ganadas queda con quien la cerró (C16, C17, P7a)
begin;
do $$
declare
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  v2 constant uuid := '00000000-0000-4000-8000-000000000003';
  hoy constant date := (now() at time zone 'America/La_Paz')::date;
  v_gd int := pruebas.metrica(hoy, 'ganadas');
  v_g1 int := pruebas.metrica(hoy, 'ganadas', v1);
  v_g2 int := pruebas.metrica(hoy, 'ganadas', v2);
  v_s uuid := pruebas.solicitud(v1, 'ganada');
  v_a1 int := pruebas.metrica(hoy, 'solicitudes_asignadas', v1);
  v_a2 int := pruebas.metrica(hoy, 'solicitudes_asignadas', v2);
begin
  if pruebas.metrica(hoy, 'ganadas') <> v_gd or pruebas.metrica(hoy, 'ganadas', v1) <> v_g1 then
    raise exception 'una solicitud que nace ganada sumó ganadas';
  end if;
  update public.solicitudes set asignado_a = v2 where id = v_s;
  if pruebas.metrica(hoy, 'solicitudes_asignadas', v1) <> v_a1 - 1 or pruebas.metrica(hoy, 'solicitudes_asignadas', v2) <> v_a2 + 1
     or pruebas.metrica(hoy, 'ganadas') <> v_gd or pruebas.metrica(hoy, 'ganadas', v1) <> v_g1
     or pruebas.metrica(hoy, 'ganadas', v2) <> v_g2 then
    raise exception 'reasignar una ganada no movió sólo solicitudes_asignadas';
  end if;
end $$;
rollback;

-- @test metricas: realizada cuenta el día de la demo (del anfitrión, que no cambia después); ganada, el día en que se marca (del asignado) (C17, C19)
begin;
do $$
declare
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  hoy constant date := (now() at time zone 'America/La_Paz')::date;
  d constant date := ((now() - interval '2 days') at time zone 'America/La_Paz')::date;
  v_s uuid := pruebas.solicitud(v1, 'agendada');
  v_r uuid := pruebas.reunion(v_s, v1, now() - interval '2 days');
  v_rd int := pruebas.metrica(d, 'reuniones_realizadas');
  v_rp int := pruebas.metrica(d, 'reuniones_realizadas', v1);
  v_r2 int := pruebas.metrica(d, 'reuniones_realizadas', '00000000-0000-4000-8000-000000000003');
  v_rh int := pruebas.metrica(hoy, 'reuniones_realizadas');
  v_gd int := pruebas.metrica(hoy, 'ganadas');
  v_gp int := pruebas.metrica(hoy, 'ganadas', v1);
begin
  update public.solicitudes set estado = 'realizada' where id = v_s;
  if (select estado from public.reuniones where id = v_r) <> 'realizada' or pruebas.metrica(d, 'reuniones_realizadas') <> v_rd + 1
     or pruebas.metrica(d, 'reuniones_realizadas', v1) <> v_rp + 1 or pruebas.metrica(hoy, 'reuniones_realizadas') <> v_rh then
    raise exception 'la demo realizada no contó el día de la demo';
  end if;
  update public.solicitudes set estado = 'ganada' where id = v_s;
  if pruebas.metrica(hoy, 'ganadas') <> v_gd + 1 or pruebas.metrica(hoy, 'ganadas', v1) <> v_gp + 1 then
    raise exception 'la ganada no contó hoy en el día y para V1';
  end if;
  -- Ya realizada, un cambio de anfitrión no mueve reuniones_realizadas (P7a).
  update public.reuniones set anfitrion_id = '00000000-0000-4000-8000-000000000003' where id = v_r;
  if pruebas.metrica(d, 'reuniones_realizadas', v1) <> v_rp + 1
     or pruebas.metrica(d, 'reuniones_realizadas', '00000000-0000-4000-8000-000000000003') <> v_r2 then
    raise exception 'el cambio de anfitrión de una demo realizada movió reuniones_realizadas';
  end if;
end $$;
rollback;

-- @test metricas: una reunión nueva suma hoy (día y anfitrión); un cambio de anfitrión la mueve; cancelar no resta (C18, C19, C21)
begin;
do $$
declare
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  v2 constant uuid := '00000000-0000-4000-8000-000000000003';
  hoy constant date := (now() at time zone 'America/La_Paz')::date;
  v_s uuid := pruebas.solicitud(v1, 'agendada');
  v_d int := pruebas.metrica(hoy, 'reuniones_reservadas');
  v_1 int := pruebas.metrica(hoy, 'reuniones_reservadas', v1);
  v_2 int := pruebas.metrica(hoy, 'reuniones_reservadas', v2);
  v_r uuid := pruebas.reunion(v_s, v1, now() + interval '7 days');
begin
  if pruebas.metrica(hoy, 'reuniones_reservadas') <> v_d + 1 or pruebas.metrica(hoy, 'reuniones_reservadas', v1) <> v_1 + 1 then
    raise exception 'la reunión nueva no sumó hoy en el día y a V1';
  end if;
  update public.reuniones set anfitrion_id = v2 where id = v_r;
  if pruebas.metrica(hoy, 'reuniones_reservadas') <> v_d + 1 or pruebas.metrica(hoy, 'reuniones_reservadas', v1) <> v_1
     or pruebas.metrica(hoy, 'reuniones_reservadas', v2) <> v_2 + 1 then
    raise exception 'el cambio de anfitrión no restó a V1 y sumó a V2';
  end if;
  update public.reuniones set estado = 'cancelada', cancelada_en = now() where id = v_r;
  if pruebas.metrica(hoy, 'reuniones_reservadas') <> v_d + 1 or pruebas.metrica(hoy, 'reuniones_reservadas', v2) <> v_2 + 1 then
    raise exception 'cancelar restó';
  end if;
end $$;
rollback;

-- @test metricas: clic_whatsapp suma clics_whatsapp y calculadora_usada suma calculadoras; los demás eventos, nada (C20)
begin;
do $$
declare
  hoy constant date := (now() at time zone 'America/La_Paz')::date;
  v_c int := pruebas.metrica(hoy, 'clics_whatsapp');
  v_k int := pruebas.metrica(hoy, 'calculadoras');
  v_dia jsonb;
begin
  insert into public.eventos (tipo, perfil_id) values ('clic_whatsapp', '00000000-0000-4000-8000-000000000002');
  insert into public.eventos (tipo) values ('calculadora_usada');
  if pruebas.metrica(hoy, 'clics_whatsapp') <> v_c + 1 or pruebas.metrica(hoy, 'calculadoras') <> v_k + 1 then
    raise exception 'los eventos no sumaron clics_whatsapp y calculadoras';
  end if;
  v_dia := (select to_jsonb(m) from public.metricas_diarias m where dia = hoy);
  insert into public.eventos (tipo) values ('clic_agendar'), ('detalle_calculadora'), ('formulario_enviado'), ('reunion_reservada');
  if (select to_jsonb(m) from public.metricas_diarias m where dia = hoy) <> v_dia then
    raise exception 'un evento que no cuenta movió las métricas del día';
  end if;
end $$;
rollback;

-- @test metricas: borrar una solicitud con su demo no baja nada (C21, P8a)
begin;
do $$
declare
  hoy constant date := (now() at time zone 'America/La_Paz')::date;
  v_s uuid := pruebas.solicitud('00000000-0000-4000-8000-000000000002', 'agendada');
  v_r uuid := pruebas.reunion(v_s, '00000000-0000-4000-8000-000000000002', now() + interval '4 days');
  v_dia jsonb := (select to_jsonb(m) from public.metricas_diarias m where dia = hoy);
  v_personas jsonb := (select jsonb_agg(to_jsonb(m) order by m.perfil_id) from public.metricas_persona m where dia = hoy);
begin
  delete from public.solicitudes where id = v_s;
  if (select to_jsonb(m) from public.metricas_diarias m where dia = hoy) is distinct from v_dia
     or (select jsonb_agg(to_jsonb(m) order by m.perfil_id) from public.metricas_persona m where dia = hoy) is distinct from v_personas
     or exists (select 1 from public.reuniones where id = v_r) then
    raise exception 'borrar la solicitud movió las métricas';
  end if;
end $$;
rollback;

-- @test metricas: forma · los triggers en sus tablas y columnas; los ayudantes no los ejecuta nadie del API; los que escriben, de definidor (C22)
do $$
declare
  f text;
begin
  if not exists (select 1 from pg_trigger t where t.tgrelid = 'public.solicitudes'::regclass and not t.tgisinternal
                  and pg_get_triggerdef(t.oid) ~ 'AFTER INSERT OR UPDATE OF estado, asignado_a ON public\.solicitudes FOR EACH ROW') then
    raise exception 'falta el trigger de métricas de solicitudes';
  end if;
  if not exists (select 1 from pg_trigger t where t.tgrelid = 'public.reuniones'::regclass and not t.tgisinternal
                  and pg_get_triggerdef(t.oid) ~ 'AFTER INSERT OR UPDATE OF anfitrion_id, estado ON public\.reuniones FOR EACH ROW') then
    raise exception 'falta el trigger de métricas de reuniones';
  end if;
  if not exists (select 1 from pg_trigger t where t.tgrelid = 'public.eventos'::regclass and not t.tgisinternal
                  and pg_get_triggerdef(t.oid) ~ 'AFTER INSERT ON public\.eventos FOR EACH ROW') then
    raise exception 'falta el trigger de métricas de eventos';
  end if;
  foreach f in array array['public._dia_local(timestamptz)', 'public._sumar_diaria(date, text, integer)',
      'public._sumar_persona(date, uuid, text, integer)', 'public._metricas_solicitud()', 'public._metricas_reunion()',
      'public._metricas_evento()'] loop
    if has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') then
      raise exception 'anon o authenticated pueden ejecutar %', f;
    end if;
    if f like 'public._metricas_%' and not exists (select 1 from pg_proc p where p.oid = f::regprocedure and p.prosecdef
                                                     and p.proconfig @> array['search_path=""']) then
      raise exception '% no es de definidor con search_path vacío', f;
    end if;
  end loop;
  begin
    perform public._sumar_diaria(current_date, 'dia', 1);
    raise exception 'sumó en una columna que no es una métrica';
  exception when invalid_parameter_value then
    null;
  end;
end $$;
