-- El panel, los triggers, la retención y los defaults leen la hora de `public._ahora()` (paso P38, P2.1): con el reloj fijado en
-- F = lun 2 nov 2026 08:00 La Paz (12:00Z), lo que pasa entre F y hoy es futuro para la base. Cada caso da otro resultado con `now()`.
-- Cada bloque fija el reloj y lo suelta con su rollback. A = …01, V1 = …02, V2 = …03.

-- @test reloj · panel: aceptar_invitacion acepta la que vence mañana desde la hora fijada y marca aceptada_en con ella
begin;
insert into pruebas.reloj (ahora) values ('2026-11-02 12:00Z');
do $$
declare
  f constant timestamptz := '2026-11-02 12:00Z';
  u constant uuid := '00000000-0000-4000-8000-000000000071';
  r jsonb;
begin
  insert into auth.users (id, email) values (u, 'reloj@ejemplo.test');
  insert into public.invitaciones (email, invitado_por, nombre, expira_en)
  values ('reloj@ejemplo.test', '00000000-0000-4000-8000-000000000001', 'Persona del Reloj', f + interval '1 day');
  perform set_config('request.jwt.claim.sub', u::text, true);
  r := public.aceptar_invitacion();
  perform set_config('request.jwt.claim.sub', '', true);
  if (r ->> 'nueva')::boolean is distinct from true then
    raise exception 'la invitación que vence mañana (desde la hora fijada) no se aceptó: %', r;
  end if;
  if (select i.aceptada_en from public.invitaciones i where i.email = 'reloj@ejemplo.test') is distinct from f then
    raise exception 'aceptada_en no es la hora fijada';
  end if;
end $$;
rollback;

-- @test reloj · panel: retencion_diaria mide los 24 meses, los 90 días y los 2 días desde la hora fijada
begin;
insert into pruebas.reloj (ahora) values ('2026-11-02 12:00Z');
do $$
declare
  v_queda uuid := pruebas.solicitud('00000000-0000-4000-8000-000000000002');
  v_se_va uuid := pruebas.solicitud('00000000-0000-4000-8000-000000000002');
begin
  update public.solicitudes set ultimo_contacto_en = '2024-11-10 12:00Z' where id = v_queda;
  update public.solicitudes set ultimo_contacto_en = '2024-11-01 12:00Z' where id = v_se_va;
  insert into public.eventos (tipo, pagina, creado_en) values ('clic_agendar', '/reloj-queda', '2024-11-10 12:00Z');
  insert into public.correos_salientes (para, plantilla, estado, creado_en)
  values ('reloj@ejemplo.test', 'confirmacion', 'enviado', '2026-08-10 12:00Z');
  insert into public.limites (clave, ventana_inicio, conteo) values ('reloj:queda', '2026-11-01 12:00Z', 1);
  perform public.retencion_diaria();
  if not exists (select 1 from public.solicitudes s where s.id = v_queda) then
    raise exception 'una solicitud con contacto a menos de 24 meses de la hora fijada se borró';
  end if;
  if exists (select 1 from public.solicitudes s where s.id = v_se_va) then
    raise exception 'una solicitud con contacto a más de 24 meses de la hora fijada no se borró';
  end if;
  if not exists (select 1 from public.eventos e where e.pagina = '/reloj-queda') then
    raise exception 'un evento a menos de 24 meses de la hora fijada se borró';
  end if;
  if not exists (select 1 from public.correos_salientes c where c.para = 'reloj@ejemplo.test') then
    raise exception 'un correo a menos de 90 días de la hora fijada se borró';
  end if;
  if not exists (select 1 from public.limites l where l.clave = 'reloj:queda') then
    raise exception 'un límite a menos de 2 días de la hora fijada se borró';
  end if;
end $$;
rollback;

-- @test reloj · panel: actualizar_meet cambia el enlace de la demo de mañana (desde la hora fijada)
begin;
insert into pruebas.reloj (ahora) values ('2026-11-02 12:00Z');
do $$
declare
  f constant timestamptz := '2026-11-02 12:00Z';
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  v_r uuid := pruebas.reunion(pruebas.solicitud('00000000-0000-4000-8000-000000000002', 'agendada'), v1, f + interval '1 day');
begin
  perform pruebas.caso('V1 cambia su Meet', 'V1', format(
    $q$select jsonb_array_length(public.actualizar_meet('https://meet.google.com/rel-ojfi-jox', %L) -> 'reuniones') >= 1$q$,
    (select p.actualizado_en from public.perfiles p where p.id = v1)), 'verdad');
  if (select r.enlace_meet from public.reuniones r where r.id = v_r) is distinct from 'https://meet.google.com/rel-ojfi-jox'
     or (select r.secuencia_ics from public.reuniones r where r.id = v_r) <> 1 then
    raise exception 'la demo de mañana (desde la hora fijada) no cambió de enlace';
  end if;
end $$;
rollback;

-- @test reloj · panel: cambiar_en_turno pasa a otro la demo de mañana (desde la hora fijada) al sacar a alguien de turno
begin;
insert into pruebas.reloj (ahora) values ('2026-11-02 12:00Z');
do $$
declare
  f constant timestamptz := '2026-11-02 12:00Z';
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  v_r uuid;
begin
  perform pruebas.abrir_agenda();
  -- Mar 3 nov, 10:00 La Paz.
  v_r := pruebas.reunion(pruebas.solicitud(v1, 'agendada'), v1, f + interval '1 day 2 hours');
  perform pruebas.caso('A saca de turno a V1', 'A', format('select public.cambiar_en_turno(%L, false, %L) is not null', v1,
    (select p.actualizado_en from public.perfiles p where p.id = v1)), 'verdad');
  if (select r.anfitrion_id from public.reuniones r where r.id = v_r) is distinct from '00000000-0000-4000-8000-000000000003' then
    raise exception 'la demo de mañana (desde la hora fijada) no pasó a V2';
  end if;
end $$;
rollback;

-- @test reloj · panel: los triggers de estado miden el inicio, el último contacto y la cancelación con la hora fijada
begin;
insert into pruebas.reloj (ahora) values ('2026-11-02 12:00Z');
do $$
declare
  f constant timestamptz := '2026-11-02 12:00Z';
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  v2 constant uuid := '00000000-0000-4000-8000-000000000003';
  v_pronto uuid := pruebas.solicitud('00000000-0000-4000-8000-000000000002', 'agendada');
  v_empezada uuid := pruebas.solicitud('00000000-0000-4000-8000-000000000003', 'agendada');
  v_cancela uuid := pruebas.solicitud('00000000-0000-4000-8000-000000000003', 'agendada');
  v_rc uuid;
begin
  perform pruebas.reunion(v_pronto, v1, f + interval '1 hour');
  perform pruebas.reunion(v_empezada, v2, f - interval '1 hour');
  v_rc := pruebas.reunion(v_cancela, v2, f + interval '5 days');
  perform pruebas.error('realizada antes del inicio', 'definer:A', format('update public.solicitudes set estado = %L where id = %L',
    'realizada', v_pronto), 'P0001', 'Ese cambio de estado no está permitido.');
  update public.solicitudes set estado = 'realizada' where id = v_empezada;
  if (select s.ultimo_contacto_en from public.solicitudes s where s.id = v_empezada) is distinct from f then
    raise exception 'el cambio de estado no puso el último contacto en la hora fijada';
  end if;
  update public.solicitudes set estado = 'nueva' where id = v_cancela;
  if (select r.cancelada_en from public.reuniones r where r.id = v_rc) is distinct from f then
    raise exception 'la reunión cancelada por el cambio de estado no tiene cancelada_en en la hora fijada';
  end if;
end $$;
rollback;

-- @test reloj · panel: una ganada suma en el día de la hora fijada (para el día y para su asignado)
begin;
insert into pruebas.reloj (ahora) values ('2026-11-02 12:00Z');
do $$
declare
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  v_s uuid := pruebas.solicitud('00000000-0000-4000-8000-000000000002', 'realizada');
  v_antes int := coalesce((select m.ganadas from public.metricas_diarias m where m.dia = '2026-11-02'), 0);
  v_antes_v1 int := coalesce((select m.ganadas from public.metricas_persona m where m.dia = '2026-11-02' and m.perfil_id = v1), 0);
begin
  update public.solicitudes set estado = 'ganada' where id = v_s;
  if (select m.ganadas from public.metricas_diarias m where m.dia = '2026-11-02') is distinct from v_antes + 1
     or (select m.ganadas from public.metricas_persona m where m.dia = '2026-11-02' and m.perfil_id = v1) is distinct from v_antes_v1 + 1 then
    raise exception 'la ganada no sumó en el día de la hora fijada';
  end if;
end $$;
rollback;

-- @test reloj · panel: el vendedor anota el contacto hasta un minuto después de la hora fijada, no más
begin;
insert into pruebas.reloj (ahora) values ('2026-11-02 12:00Z');
do $$
declare
  f constant timestamptz := '2026-11-02 12:00Z';
  v_s uuid := pruebas.solicitud('00000000-0000-4000-8000-000000000002');
begin
  update public.solicitudes set ultimo_contacto_en = f - interval '1 day' where id = v_s;
  perform pruebas.caso('V1 anota el contacto en la hora fijada', 'V1', format(
    'update public.solicitudes set ultimo_contacto_en = %L where id = %L', f + interval '30 seconds', v_s), 'filas=1');
  perform pruebas.caso('V1 no lo pone 2 min después de la hora fijada', 'V1', format(
    'update public.solicitudes set ultimo_contacto_en = %L where id = %L', f + interval '2 minutes', v_s),
    'error=42501:ultimo_contacto_en');
end $$;
rollback;

-- @test reloj · panel: los defaults de public toman la hora fijada (solicitudes, notas de V1, invitaciones de A) y las versiones, la real
begin;
insert into pruebas.reloj (ahora) values ('2026-11-02 12:00Z');
do $$
declare
  f constant timestamptz := '2026-11-02 12:00Z';
  v_s uuid := pruebas.solicitud('00000000-0000-4000-8000-000000000002');
begin
  if (select s.creado_en from public.solicitudes s where s.id = v_s) is distinct from f
     or (select s.ultimo_contacto_en from public.solicitudes s where s.id = v_s) is distinct from f then
    raise exception 'la solicitud nueva no nació en la hora fijada';
  end if;
  if (select s.actualizado_en from public.solicitudes s where s.id = v_s) is distinct from now() then
    raise exception 'la versión de la solicitud dejó la hora real';
  end if;
  perform pruebas.caso('V1 anota', 'V1', format(
    $q$insert into public.notas (solicitud_id, autor_id, texto) values (%L, {V1}, 'Nota del reloj')$q$, v_s), 'filas=1');
  if (select n.creado_en from public.notas n where n.texto = 'Nota del reloj') is distinct from f then
    raise exception 'la nota de V1 no nació en la hora fijada';
  end if;
  perform pruebas.caso('A invita', 'A',
    $q$insert into public.invitaciones (email, invitado_por, nombre) values ('reloj-invitada@ejemplo.test', {A}, 'Invitada')$q$,
    'filas=1');
  if (select i.expira_en from public.invitaciones i where i.email = 'reloj-invitada@ejemplo.test') is distinct from f + interval '7 days'
     or (select i.creado_en from public.invitaciones i where i.email = 'reloj-invitada@ejemplo.test') is distinct from f then
    raise exception 'la invitación de A no vence a los 7 días de la hora fijada';
  end if;
end $$;
rollback;
