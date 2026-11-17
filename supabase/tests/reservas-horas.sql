-- Lo que lee la página de horas y de gestión (semilla §5.5, R4.13; paso P05, C8) y quién ejecuta las funciones de reserva: la otra
-- mitad de reservas.sql, partida por el tope de 300 líneas. Corren como postgres salvo los grants (pruebas.caso). Cada bloque deja
-- la base como estaba.

-- @test reservas: datos_para_horas · claves y hojas exactas en cada nivel, sin contactos del equipo, con solicitud y con token
begin;
do $$
declare
  v2 constant uuid := '00000000-0000-4000-8000-000000000003';
  v_s uuid := pruebas.solicitud(null, 'nueva', 'prospeccion', 'LU-01');
  d jsonb;
  r jsonb;
  v_base text[] := array['ahora', 'config', 'horarioBase', 'personas', 'bloqueos', 'reuniones', 'limitarA', 'excluirReunionId',
    'asignadoA'];
begin
  perform pruebas.abrir_agenda();
  perform pruebas.reunion(pruebas.solicitud(v2, 'agendada'), v2, pruebas.hora(3, '14:00'));
  insert into public.bloqueos (perfil_id, inicio, fin, motivo, creado_por) values (v2, pruebas.hora(4, '09:00'),
    pruebas.hora(4, '10:00'), 'Médico', v2);
  d := public.datos_para_horas(v_s, null);
  if not (pruebas.claves(d, v_base)
      and pruebas.claves(d -> 'config', array['duracionMin', 'descansoMin', 'anticipacionMinHoras', 'horizonteDias',
        'maxReunionesDia', 'cancelarHastaHoras', 'zonaHoraria'])
      and pruebas.claves(d -> 'horarioBase', array['diaSemana', 'desde', 'hasta'])
      and pruebas.claves(d -> 'personas', array['id', 'rol', 'activo', 'enTurno', 'whatsapp', 'enlaceMeet', 'creadoEn',
        'ultimaReunionEn'])
      and pruebas.claves(d -> 'bloqueos', array['perfilId', 'inicio', 'fin'])
      and pruebas.claves(d -> 'reuniones', array['id', 'anfitrionId', 'inicio', 'fin', 'estado'])) then
    raise exception 'datos_para_horas no tiene las claves exactas: %', d;
  end if;
  if jsonb_path_exists(d, '$.personas[*] ? ((@.whatsapp != "•" && @.whatsapp != null) || (@.enlaceMeet != "•" && @.enlaceMeet != null))')
     or jsonb_path_exists(d, '$.personas[*] ? (@.id == "00000000-0000-4000-8000-000000000004")')
     or d -> 'excluirReunionId' is distinct from 'null' or d ->> 'limitarA' is distinct from v2::text or d -> 'asignadoA' is distinct from 'null'
     or d #>> '{horarioBase,0,desde}' is distinct from '08:00' or d #>> '{config,zonaHoraria}' is distinct from 'America/La_Paz'
     or jsonb_array_length(d -> 'bloqueos') is distinct from 1 or jsonb_array_length(d -> 'reuniones') is distinct from 1 then
    raise exception 'datos_para_horas no tiene las hojas esperadas: %', d;
  end if;
  r := public.reservar_reunion(v_s, null, pruebas.hora(3, '09:00'), 'America/La_Paz', pruebas.token('dph'));
  d := public.datos_para_horas(null, pruebas.token('dph'));
  if not (pruebas.claves(d, v_base || 'reunion'::text)
      and pruebas.claves(d -> 'reunion', array['id', 'inicio', 'fin', 'estado', 'zonaVisitante', 'enlaceMeet', 'actualizadoEn',
        'cambiableHasta', 'puedeVolverAReservar', 'anfitrion'])
      and pruebas.claves(d #> '{reunion,anfitrion}', array['nombre', 'whatsapp'])
      and d ->> 'excluirReunionId' = r #>> '{reunion,id}' and d #>> '{reunion,puedeVolverAReservar}' = 'false') then
    raise exception 'datos_para_horas con token no es el esperado: %', d;
  end if;
  perform pruebas.error('ya agendada', 'service_role', format('select public.datos_para_horas(%L, null)', v_s), 'P0001',
    'Este enlace no es válido.');
  perform pruebas.error('token inexistente', 'service_role', format('select public.datos_para_horas(null, %L)',
    pruebas.token('no-existe')), 'P0001', 'Este enlace no es válido.');
  if (d #>> '{reunion,cambiableHasta}')::timestamptz is distinct from pruebas.hora(3, '09:00') - interval '2 hours' then
    raise exception 'cambiableHasta no es el inicio menos cancelar_hasta_horas: %', d;
  end if;
  perform public.cancelar_reunion(pruebas.token('dph'), (r #>> '{reunion,actualizadoEn}')::timestamptz);
  d := public.datos_para_horas(null, pruebas.token('dph'));
  if d #>> '{reunion,estado}' is distinct from 'cancelada' or d #>> '{reunion,puedeVolverAReservar}' is distinct from 'true'
     or d -> 'excluirReunionId' is distinct from 'null' then
    raise exception 'datos_para_horas de una reunión cancelada no es el esperado: %', d;
  end if;
  perform pruebas.caso('ninguna entrada', 'service_role', 'select public.datos_para_horas(null, null)', 'error=22023:p_solicitud_id');
end $$;
rollback;

-- @test reservas: grants · reservar_reunion y datos_para_horas sólo para service_role
begin;
select pruebas.caso('anon reserva', 'anon', $$select public.reservar_reunion({S2}, null, now(), 'America/La_Paz', null)$$,
  'error=42501');
select pruebas.caso('V1 reserva', 'V1', $$select public.reservar_reunion({S2}, null, now(), 'America/La_Paz', null)$$, 'error=42501');
select pruebas.caso('A reserva', 'A', $$select public.reservar_reunion({S2}, null, now(), 'America/La_Paz', null)$$, 'error=42501');
select pruebas.caso('anon lee horas', 'anon', $$select public.datos_para_horas({S2}, null)$$, 'error=42501');
select pruebas.caso('A lee horas', 'A', $$select public.datos_para_horas({S2}, null)$$, 'error=42501');
select pruebas.caso('servidor lee horas', 'service_role', $$select public.datos_para_horas({S2}, null) ? 'personas'$$, 'verdad');
rollback;
