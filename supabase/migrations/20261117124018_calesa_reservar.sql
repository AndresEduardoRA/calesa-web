-- Calesa · reservar una demo (semilla §5.6, B13, B17, X5, X6, R4.8, R4.15, R4.16; paso P05, C8–C12): lo que lee la página de horas
-- (`datos_para_horas`) y la reserva (`reservar_reunion`). Las dos son sólo de `service_role` (§4 l. 360): el servidor ya verificó el
-- token o el HMAC. Devuelven lo que el correo necesita (B17); el correo lo manda la app (P11), no la base (X6).

-- C9: lo que devuelven reservar, cambiar y cancelar: lo que piden las plantillas sin que el servidor lea tablas.
create function public._resumen_reunion(p_reunion uuid, p_anfitrion_anterior uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'reunion', jsonb_build_object('id', r.id, 'inicio', r.inicio, 'fin', r.fin, 'zonaVisitante', r.zona_visitante,
      'enlaceMeet', r.enlace_meet, 'estado', r.estado, 'secuenciaIcs', r.secuencia_ics, 'actualizadoEn', r.actualizado_en),
    'solicitud', jsonb_build_object('id', s.id, 'nombre', s.nombre, 'email', s.email::text, 'importadora', s.importadora,
      'asignadoA', s.asignado_a),
    'anfitrion', jsonb_build_object('id', p.id, 'nombre', p.nombre, 'email', p.email::text, 'whatsapp', p.whatsapp),
    'anfitrionAnterior', (select jsonb_build_object('id', a.id, 'nombre', a.nombre, 'email', a.email::text)
                            from public.perfiles a where a.id = p_anfitrion_anterior))
    from public.reuniones r
    join public.solicitudes s on s.id = r.solicitud_id
    join public.perfiles p on p.id = r.anfitrion_id
   where r.id = p_reunion
$$;

-- C10 y C11: intenta en el orden de C5; si uno choca con la exclusión de la tabla (el descanso de 15), el siguiente. La solicitud pasa
-- a `agendada` y al anfitrión: la máquina de estados valida y audita (§5.6 l. 511, R4.8).
create function public._intentar_reserva(p_solicitud uuid, p_orden uuid[], p_inicio timestamptz, p_zona text, p_token bytea)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_anfitrion uuid;
  v_id uuid;
  v_restriccion text;
begin
  foreach v_anfitrion in array p_orden loop
    begin
      insert into public.reuniones (solicitud_id, anfitrion_id, inicio, fin, zona_visitante, enlace_meet, token_hash)
      select p_solicitud, p.id, p_inicio, p_inicio + make_interval(mins => c.duracion_min), p_zona, p.enlace_meet, p_token
        from public.perfiles p, public.config_agenda c
       where p.id = v_anfitrion and c.id = 1
      returning id into v_id;
      update public.solicitudes set estado = 'agendada', asignado_a = v_anfitrion where id = p_solicitud;
      return v_id;
    exception
      when exclusion_violation then
        null;
      when unique_violation then
        get stacked diagnostics v_restriccion = constraint_name;
        if v_restriccion = 'reuniones_una_confirmada' then
          perform public._fallar('E3');
        end if;
        raise;
    end;
  end loop;
  perform public._fallar('E1');
  return null;
end;
$$;

-- C10 y C12: con `p_solicitud_id` (la solicitud nueva) o con `p_token_anterior` (volver a reservar tras cancelar, R4.16: la reunión
-- nueva lleva el token nuevo y la cancelada queda cancelada).
create function public.reservar_reunion(p_solicitud_id uuid, p_token_anterior bytea, p_inicio timestamptz, p_zona_visitante text,
  p_token_hash bytea)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_solicitud uuid := p_solicitud_id;
  v_s public.solicitudes;
  v_vencida boolean;
  v_orden uuid[];
  v_reunion uuid;
begin
  if (p_solicitud_id is null) = (p_token_anterior is null) then
    raise exception 'Falta la solicitud o el enlace.' using errcode = '22023', hint = 'p_solicitud_id';
  end if;
  if p_token_hash is null or octet_length(p_token_hash) <> 32 then
    raise exception 'El token de gestión no es válido.' using errcode = '22023', hint = 'token_hash';
  end if;
  perform public._validar_zona(p_zona_visitante);
  perform public._bloquear_agenda();
  if p_token_anterior is not null then
    select r.solicitud_id into v_solicitud from public.reuniones r where r.token_hash = p_token_anterior;
  end if;
  select * into v_s from public.solicitudes s where s.id = v_solicitud for update;
  if not found then
    perform public._fallar('E4');
  end if;
  if v_s.estado = 'agendada' then
    perform public._fallar('E3');
  end if;
  if v_s.estado <> 'nueva' then
    perform public._fallar('E4');
  end if;
  v_vencida := p_token_anterior is not null and v_s.creado_en <= now() - interval '30 days';
  if v_vencida then
    perform public._fallar('E5');
  end if;
  if p_inicio is null or not public._hora_ofrecible(p_inicio) then
    perform public._fallar('E1');
  end if;
  v_orden := public._orden_reunion(p_inicio, public._candidatos_reunion(p_inicio, public._limitar_a(v_s.id), null), v_s.asignado_a,
    null);
  -- En dos sentencias: `_resumen_reunion` es STABLE y no vería la reunión insertada en la misma sentencia.
  v_reunion := public._intentar_reserva(v_s.id, v_orden, p_inicio, p_zona_visitante, p_token_hash);
  return public._resumen_reunion(v_reunion, null);
end;
$$;

-- C8: lo que la app necesita para calcular las horas (la forma de `esquemaEntradaAgenda`, src/modules/agenda/entities/config.ts).
-- Los contactos del equipo no salen: `whatsapp` y `enlaceMeet` dicen sólo si los tiene ('•' o null). Con token, la solicitud manda
-- (P2) y suma `reunion`: la confirmada vigente o, si no hay, la del token; sin plazo, para que la página diga que venció. No es
-- STABLE: los errores salen por `_fallar`, que es volátil.
create function public.datos_para_horas(p_solicitud_id uuid, p_token_hash bytea)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.config_agenda;
  v_s public.solicitudes;
  v_tok public.reuniones;
  v_vig public.reuniones;
  v_r public.reuniones;
  v_reunion jsonb := '{}'::jsonb;
  v_desde timestamptz;
  v_hasta timestamptz;
begin
  if (p_solicitud_id is null) = (p_token_hash is null) then
    raise exception 'Falta la solicitud o el enlace.' using errcode = '22023', hint = 'p_solicitud_id';
  end if;
  select * into c from public.config_agenda where id = 1;
  if p_token_hash is not null then
    select * into v_tok from public.reuniones r where r.token_hash = p_token_hash;
    select * into v_s from public.solicitudes s where s.id = v_tok.solicitud_id;
  else
    select * into v_s from public.solicitudes s where s.id = p_solicitud_id and s.estado = 'nueva';
  end if;
  if v_s.id is null then
    perform public._fallar('E4');
  end if;
  -- reuniones_una_confirmada
  select * into v_vig from public.reuniones r where r.solicitud_id = v_s.id and r.estado = 'confirmada';
  if p_token_hash is not null then
    if v_vig.id is null then v_r := v_tok; else v_r := v_vig; end if;
    v_reunion := jsonb_build_object('reunion', jsonb_build_object('id', v_r.id, 'inicio', v_r.inicio, 'fin', v_r.fin,
      'estado', v_r.estado, 'zonaVisitante', v_r.zona_visitante, 'enlaceMeet', v_r.enlace_meet, 'actualizadoEn', v_r.actualizado_en,
      'cambiableHasta', v_r.inicio - make_interval(hours => c.cancelar_hasta_horas),
      'puedeVolverAReservar', v_r.estado = 'cancelada' and v_s.estado = 'nueva' and v_s.creado_en > now() - interval '30 days',
      'anfitrion', (select jsonb_build_object('nombre', p.nombre, 'whatsapp', p.whatsapp) from public.perfiles p
                     where p.id = v_r.anfitrion_id)));
  end if;
  v_desde := date_trunc('week', now() at time zone c.zona_horaria) at time zone c.zona_horaria;
  v_hasta := now() + make_interval(hours => (c.horizonte_dias + 1) * 24);
  return jsonb_build_object(
    'ahora', now(),
    'config', jsonb_build_object('duracionMin', c.duracion_min, 'descansoMin', c.descanso_min,
      'anticipacionMinHoras', c.anticipacion_min_horas, 'horizonteDias', c.horizonte_dias, 'maxReunionesDia', c.max_reuniones_dia,
      'cancelarHastaHoras', c.cancelar_hasta_horas, 'zonaHoraria', c.zona_horaria),
    'horarioBase', coalesce((select jsonb_agg(jsonb_build_object('diaSemana', h.dia_semana, 'desde', to_char(h.desde, 'HH24:MI'),
        'hasta', to_char(h.hasta, 'HH24:MI')) order by h.dia_semana, h.desde) from public.horario_base h), '[]'),
    'personas', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'rol', p.rol, 'activo', p.activo, 'enTurno', p.en_turno,
        'whatsapp', case when coalesce(p.whatsapp, '') <> '' then '•' end,
        'enlaceMeet', case when coalesce(p.enlace_meet, '') <> '' then '•' end,
        'creadoEn', p.creado_en, 'ultimaReunionEn', u.ultima) order by p.creado_en, p.id)
      from public.perfiles p
      -- reuniones_anfitrion: el inicio de su última reunión no cancelada.
      cross join lateral (select max(r.inicio) as ultima from public.reuniones r
                           where r.anfitrion_id = p.id and r.estado <> 'cancelada') u
     where p.activo), '[]'),
    -- bloqueos_perfil_rango (gist)
    'bloqueos', coalesce((select jsonb_agg(jsonb_build_object('perfilId', b.perfil_id, 'inicio', b.inicio, 'fin', b.fin)
        order by b.inicio) from public.bloqueos b where tstzrange(b.inicio, b.fin) && tstzrange(v_desde, v_hasta)), '[]'),
    -- reuniones_confirmadas (inicio) where confirmada
    'reuniones', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'anfitrionId', r.anfitrion_id, 'inicio', r.inicio,
        'fin', r.fin, 'estado', r.estado) order by r.inicio)
      from public.reuniones r
     where r.estado = 'confirmada' and r.inicio >= v_desde - interval '1 day' and r.inicio < v_hasta and r.fin > v_desde), '[]'),
    'limitarA', public._limitar_a(v_s.id),
    'excluirReunionId', v_vig.id,
    'asignadoA', v_s.asignado_a
  ) || v_reunion;
end;
$$;

revoke all on function public._resumen_reunion(uuid, uuid), public._intentar_reserva(uuid, uuid[], timestamptz, text, bytea)
  from public, anon, authenticated;
revoke all on function public.reservar_reunion(uuid, bytea, timestamptz, text, bytea), public.datos_para_horas(uuid, bytea)
  from public, anon, authenticated;
grant execute on function public.reservar_reunion(uuid, bytea, timestamptz, text, bytea), public.datos_para_horas(uuid, bytea)
  to service_role;
