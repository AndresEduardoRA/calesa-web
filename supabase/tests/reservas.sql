-- La reserva de demos en la base (semilla §5.5, §5.6, X5, X10, R4.9, R4.13, R4.20; paso P05, C1–C12): `reservar_reunion`, el reparto
-- parejo y `datos_para_horas`. Corren como postgres (la función es de definidor y sólo la ejecuta service_role: lo mismo adentro);
-- los grants, con `pruebas.caso`. `pruebas.abrir_agenda()` abre de 08:00 a 20:00 y `pruebas.hora(d, …)` cae dentro de la ventana
-- (12 h a 21 días). V1 = …02, V2 = …03, A = …01. Cada bloque deja la base como estaba.

-- @test reservas: reserva simple · anfitrión asignado, solicitud agendada, 30 min, el Meet del anfitrión y el resumen exacto
begin;
do $$
declare
  v_s uuid;
  r jsonb;
  m public.reuniones;
begin
  perform pruebas.abrir_agenda();
  v_s := pruebas.solicitud('00000000-0000-4000-8000-000000000003');
  r := public.reservar_reunion(v_s, null, pruebas.hora(3, '09:00'), 'America/Lima', pruebas.token('simple'));
  select * into m from public.reuniones where id = (r #>> '{reunion,id}')::uuid;
  if m.id is null or m.anfitrion_id <> '00000000-0000-4000-8000-000000000003' or m.fin <> m.inicio + interval '30 minutes'
     or m.enlace_meet <> 'https://meet.google.com/klm-nopq-rst' or m.token_hash <> pruebas.token('simple')
     or m.zona_visitante <> 'America/Lima' or m.estado <> 'confirmada' then
    raise exception 'la reunión no es la esperada: %', to_jsonb(m) - 'token_hash';
  end if;
  if (select estado from public.solicitudes where id = v_s) is distinct from 'agendada' then raise exception 'la solicitud no quedó agendada'; end if;
  if not (pruebas.claves(r, array['reunion', 'solicitud', 'anfitrion', 'anfitrionAnterior'])
      and pruebas.claves(r -> 'reunion', array['id', 'inicio', 'fin', 'zonaVisitante', 'enlaceMeet', 'estado', 'secuenciaIcs',
        'actualizadoEn'])
      and pruebas.claves(r -> 'solicitud', array['id', 'nombre', 'email', 'importadora', 'asignadoA'])
      and pruebas.claves(r -> 'anfitrion', array['id', 'nombre', 'email', 'whatsapp'])
      and r -> 'anfitrionAnterior' = 'null' and r #>> '{anfitrion,nombre}' = 'Luis' and r #>> '{reunion,secuenciaIcs}' = '0') then
    raise exception 'el resumen no tiene las claves y hojas esperadas: %', r;
  end if;
end $$;
rollback;

-- @test reservas: doble reserva · la misma solicitud otra vez da E3; otra a la misma hora sin otro elegible da E1
begin;
do $$
declare
  v_s uuid := pruebas.solicitud('00000000-0000-4000-8000-000000000003');
  v_h timestamptz := pruebas.hora(3, '09:00');
begin
  perform pruebas.abrir_agenda();
  perform public.reservar_reunion(v_s, null, v_h, 'America/La_Paz', pruebas.token('doble-1'));
  perform pruebas.error('la misma', 'service_role', format('select public.reservar_reunion(%L, null, %L, %L, %L)', v_s, v_h,
    'America/La_Paz', pruebas.token('doble-2')), 'P0001', 'Esta solicitud ya tiene una demo reservada.');
  insert into public.bloqueos (perfil_id, inicio, fin, creado_por) values ('00000000-0000-4000-8000-000000000002', v_h,
    v_h + interval '1 hour', '00000000-0000-4000-8000-000000000002');
  perform pruebas.error('otra', 'service_role', format('select public.reservar_reunion(%L, null, %L, %L, %L)',
    pruebas.solicitud(null), v_h, 'America/La_Paz', pruebas.token('doble-3')), 'P0001', 'Esa hora se acaba de ocupar. Elige otra.');
end $$;
rollback;

-- @test reservas: preferencia por el asignado (X5) aunque tenga más reuniones; sin asignado, el reparto parejo y la solicitud pasa a él
begin;
do $$
declare
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  v_s uuid;
begin
  perform pruebas.abrir_agenda();
  perform pruebas.reunion(pruebas.solicitud(v1, 'agendada'), v1, pruebas.hora(3, '14:00'));
  perform pruebas.reunion(pruebas.solicitud(v1, 'agendada'), v1, pruebas.hora(3, '15:00'));
  if (public.reservar_reunion(pruebas.solicitud(v1), null, pruebas.hora(3, '09:00'), 'America/La_Paz',
      pruebas.token('pref-1')) #>> '{anfitrion,id}')::uuid is distinct from v1 then
    raise exception 'el asignado libre no ganó';
  end if;
  v_s := pruebas.solicitud(null);
  if (public.reservar_reunion(v_s, null, pruebas.hora(3, '11:00'), 'America/La_Paz', pruebas.token('pref-2'))
      #>> '{anfitrion,id}')::uuid is distinct from '00000000-0000-4000-8000-000000000003' then
    raise exception 'sin asignado no ganó quien menos reuniones tiene en la semana';
  end if;
  if (select asignado_a from public.solicitudes where id = v_s) is distinct from '00000000-0000-4000-8000-000000000003' then
    raise exception 'la solicitud no pasó al anfitrión';
  end if;
end $$;
rollback;

-- @test reservas: admin de respaldo (P3) · un admin asignado no le gana a un vendedor elegible; sin vendedores, el admin
begin;
do $$
declare
  a constant uuid := '00000000-0000-4000-8000-000000000001';
  v_h timestamptz := pruebas.hora(4, '09:00');
begin
  perform pruebas.abrir_agenda();
  update public.perfiles set whatsapp = '+59170000001', enlace_meet = 'https://meet.google.com/adm-inis-tra', en_turno = true
   where id = a;
  insert into public.bloqueos (perfil_id, inicio, fin, creado_por) values ('00000000-0000-4000-8000-000000000003', v_h,
    v_h + interval '1 hour', a);
  if (public.reservar_reunion(pruebas.solicitud(a), null, v_h, 'America/La_Paz', pruebas.token('adm-1'))
      #>> '{anfitrion,id}')::uuid is distinct from '00000000-0000-4000-8000-000000000002' then
    raise exception 'el admin asignado le ganó a un vendedor elegible';
  end if;
  update public.perfiles set en_turno = false where id in ('00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000003');
  if (public.reservar_reunion(pruebas.solicitud(null), null, pruebas.hora(4, '11:00'), 'America/La_Paz', pruebas.token('adm-2'))
      #>> '{anfitrion,id}')::uuid is distinct from a then
    raise exception 'sin vendedores elegibles no quedó el admin';
  end if;
end $$;
rollback;

-- @test reservas: desempates (P4) · a igual conteo, la última reunión no cancelada más antigua; sin ninguna, primero
begin;
do $$
begin
  perform pruebas.abrir_agenda();
  -- V1 tiene R1 (2026-11-03); V2, ninguna: a igual conteo gana V2.
  if (public.reservar_reunion(pruebas.solicitud(null), null, pruebas.hora(6, '09:00'), 'America/La_Paz', pruebas.token('des-1'))
      #>> '{anfitrion,id}')::uuid is distinct from '00000000-0000-4000-8000-000000000003' then
    raise exception 'no ganó quien nunca tuvo reunión';
  end if;
end $$;
rollback;
begin;
do $$
begin
  perform pruebas.abrir_agenda();
  perform pruebas.reunion(pruebas.solicitud(null, 'agendada'), '00000000-0000-4000-8000-000000000002', pruebas.hora(5, '15:00'));
  perform pruebas.reunion(pruebas.solicitud(null, 'agendada'), '00000000-0000-4000-8000-000000000003', pruebas.hora(5, '14:00'));
  if (public.reservar_reunion(pruebas.solicitud(null), null, pruebas.hora(5, '09:00'), 'America/La_Paz', pruebas.token('des-2'))
      #>> '{anfitrion,id}')::uuid is distinct from '00000000-0000-4000-8000-000000000003' then
    raise exception 'a igual conteo no ganó la última reunión más antigua';
  end if;
end $$;
rollback;

-- @test reservas: máximo diario por persona en el día local (X10) · la 5.ª va a otro; sin otro, E1; al día siguiente, sí
begin;
do $$
declare
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  v_h timestamptz := pruebas.hora(3, '09:00');
  t text;
begin
  perform pruebas.abrir_agenda();
  -- 21:00 de La Paz ya es el día siguiente en UTC: cuenta en el día local.
  foreach t in array array['15:00', '16:00', '17:00', '21:00'] loop
    perform pruebas.reunion(pruebas.solicitud(v1, 'agendada'), v1, pruebas.hora(3, t));
  end loop;
  if (public.reservar_reunion(pruebas.solicitud(v1), null, v_h, 'America/La_Paz', pruebas.token('max-1'))
      #>> '{anfitrion,id}')::uuid is distinct from '00000000-0000-4000-8000-000000000003' then
    raise exception 'la 5.ª reunión del día no fue a otro vendedor';
  end if;
  perform pruebas.error('sin otro', 'service_role', format('select public.reservar_reunion(%L, null, %L, %L, %L)',
    pruebas.solicitud(v1), v_h, 'America/La_Paz', pruebas.token('max-2')), 'P0001', 'Esa hora se acaba de ocupar. Elige otra.');
  if (public.reservar_reunion(pruebas.solicitud(v1), null, pruebas.hora(4, '09:00'), 'America/La_Paz', pruebas.token('max-3'))
      #>> '{anfitrion,id}')::uuid is distinct from v1 then
    raise exception 'al día siguiente V1 no volvió a ser elegible';
  end if;
end $$;
rollback;

-- @test reservas: el descanso vigente (no el 15 de la exclusión) y los bloqueos quitan elegibilidad
begin;
do $$
declare
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  v2 constant uuid := '00000000-0000-4000-8000-000000000003';
begin
  perform pruebas.abrir_agenda();
  update public.config_agenda set descanso_min = 45;
  perform pruebas.reunion(pruebas.solicitud(v1, 'agendada'), v1, pruebas.hora(3, '09:00'));
  -- [09:00, 10:15) cruza [10:00, 11:15); con la exclusión de 15, [09:00, 09:45), no.
  if (public.reservar_reunion(pruebas.solicitud(v1), null, pruebas.hora(3, '10:00'), 'America/La_Paz', pruebas.token('desc-1'))
      #>> '{anfitrion,id}')::uuid is distinct from v2 then
    raise exception 'el descanso vigente no le quitó la hora a V1';
  end if;
  if (public.reservar_reunion(pruebas.solicitud(v1), null, pruebas.hora(3, '10:30'), 'America/La_Paz', pruebas.token('desc-2'))
      #>> '{anfitrion,id}')::uuid is distinct from v1 then
    raise exception 'pasado el descanso V1 no volvió a ser elegible';
  end if;
  insert into public.bloqueos (perfil_id, inicio, fin, creado_por) values (v1, pruebas.hora(3, '12:00'), pruebas.hora(3, '12:30'), v1);
  if (public.reservar_reunion(pruebas.solicitud(v1), null, pruebas.hora(3, '12:00'), 'America/La_Paz', pruebas.token('desc-3'))
      #>> '{anfitrion,id}')::uuid is distinct from v2 then
    raise exception 'el bloqueo no le quitó la hora a V1';
  end if;
end $$;
rollback;

-- @test reservas: si el primero choca con la exclusión de la tabla, gana el siguiente candidato y la solicitud pasa a él
begin;
do $$
declare
  v2 constant uuid := '00000000-0000-4000-8000-000000000003';
  v_s uuid := pruebas.solicitud(v2);
begin
  perform pruebas.abrir_agenda();
  update public.config_agenda set descanso_min = 0;
  perform pruebas.reunion(pruebas.solicitud(v2, 'agendada'), v2, pruebas.hora(3, '08:30'));
  if (public.reservar_reunion(v_s, null, pruebas.hora(3, '09:00'), 'America/La_Paz', pruebas.token('excl'))
      #>> '{anfitrion,id}')::uuid is distinct from '00000000-0000-4000-8000-000000000002' then
    raise exception 'tras la exclusión no ganó el siguiente candidato';
  end if;
  if (select asignado_a from public.solicitudes where id = v_s) is distinct from '00000000-0000-4000-8000-000000000002' then
    raise exception 'la solicitud no pasó al siguiente candidato';
  end if;
end $$;
rollback;

-- @test reservas: la hora tiene que estar en el paso de 30 min, en el horario, caber entera y respetar la anticipación y el horizonte
begin;
do $$
declare
  t record;
begin
  perform pruebas.abrir_agenda();
  for t in select * from (values (3, '09:10'), (3, '07:30'), (3, '20:00'), (22, '09:00')) x (d, h) loop
    perform pruebas.error(t.d || ' ' || t.h, 'service_role', format('select public.reservar_reunion(%L, null, %L, %L, %L)',
      pruebas.solicitud(null), pruebas.hora(t.d, t.h), 'America/La_Paz', pruebas.token(t.h)), 'P0001',
      'Esa hora se acaba de ocupar. Elige otra.');
  end loop;
  perform public.reservar_reunion(pruebas.solicitud(null), null, pruebas.hora(3, '19:30'), 'America/La_Paz', pruebas.token('borde'));
  update public.config_agenda set anticipacion_min_horas = 48;
  perform pruebas.error('anticipación', 'service_role', format('select public.reservar_reunion(%L, null, %L, %L, %L)',
    pruebas.solicitud(null), pruebas.hora(1, '09:00'), 'America/La_Paz', pruebas.token('antic')), 'P0001',
    'Esa hora se acaba de ocupar. Elige otra.');
end $$;
rollback;

-- @test reservas: prospección (R4.20) · sólo el creador del enlace; inactivo, la regla general
begin;
do $$
declare
  v2 constant uuid := '00000000-0000-4000-8000-000000000003';
  v_s uuid;
begin
  perform pruebas.abrir_agenda();
  perform pruebas.reunion(pruebas.solicitud(v2, 'agendada'), v2, pruebas.hora(3, '14:00'));
  perform pruebas.reunion(pruebas.solicitud(v2, 'agendada'), v2, pruebas.hora(3, '15:00'));
  if (public.reservar_reunion(pruebas.solicitud(null, 'nueva', 'prospeccion', 'LU-01'), null, pruebas.hora(3, '09:00'),
      'America/La_Paz', pruebas.token('pros-1')) #>> '{anfitrion,id}')::uuid is distinct from v2 then
    raise exception 'la solicitud de prospección no fue al creador del enlace';
  end if;
  update public.perfiles set activo = false where id = v2;
  v_s := pruebas.solicitud(null, 'nueva', 'prospeccion', 'LU-01');
  if public._limitar_a(v_s) is not null then raise exception '_limitar_a devuelve un creador inactivo'; end if;
  if (public.reservar_reunion(v_s, null, pruebas.hora(3, '11:00'), 'America/La_Paz', pruebas.token('pros-2'))
      #>> '{anfitrion,id}')::uuid is distinct from '00000000-0000-4000-8000-000000000002' then
    raise exception 'con el creador inactivo no se aplicó la regla general';
  end if;
end $$;
rollback;

-- @test reservas: validaciones · zona del visitante, token, una sola entrada y la solicitud que no existe o no es nueva
begin;
select pruebas.caso('zona con desfase', 'service_role', $$select public.reservar_reunion({S2}, null, now(), '+05:00',
  decode(repeat('ab', 32), 'hex'))$$, 'error=22023:zona_visitante');
select pruebas.caso('zona inexistente', 'service_role', $$select public.reservar_reunion({S2}, null, now(), 'Nada/Inexistente',
  decode(repeat('ab', 32), 'hex'))$$, 'error=22023:zona_visitante');
select pruebas.caso('token corto', 'service_role', $$select public.reservar_reunion({S2}, null, now(), 'America/La_Paz',
  decode(repeat('ab', 31), 'hex'))$$, 'error=22023:token_hash');
select pruebas.caso('dos entradas', 'service_role', $$select public.reservar_reunion({S2}, '\x00', now(), 'America/La_Paz',
  decode(repeat('ab', 32), 'hex'))$$, 'error=22023:p_solicitud_id');
select pruebas.error('no existe', 'service_role', $$select public.reservar_reunion(gen_random_uuid(), null, now(), 'America/La_Paz',
  decode(repeat('ab', 32), 'hex'))$$, 'P0001', 'Este enlace no es válido.');
select pruebas.error('no es nueva', 'service_role', $$select public.reservar_reunion({S2}, null, now(), 'America/La_Paz',
  decode(repeat('ab', 32), 'hex'))$$, 'P0001', 'Este enlace no es válido.',
  $$update public.solicitudes set estado = 'descartada' where id = {S2}$$);
rollback;
