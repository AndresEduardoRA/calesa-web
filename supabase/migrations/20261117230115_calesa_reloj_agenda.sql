-- Calesa · el reloj de la agenda pública y del límite de envíos (paso P38, C3 y C4): las funciones que leían `now()` lo leen de
-- `public._ahora()`, envuelta en `select` para que se evalúe una vez por consulta (InitPlan). Cada una es su definición vigente, sin otro
-- cambio: `create or replace` conserva dueño y grants, y la sentencia repite firma, `security definer`, `set` y volatilidad tal cual.
-- Lo vigila `supabase/tests/reloj-copias.test.ts`. Sin la tabla del reloj, `_ahora()` es `now()`: en la nube nada cambia.

-- _hora_ofrecible: la de calesa_agenda_reglas.sql, con la hora de _ahora() (2 líneas).
create or replace function public._hora_ofrecible(p_h timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((
    select p_h >= (select public._ahora()) + make_interval(hours => c.anticipacion_min_horas)
       and p_h <= (select public._ahora()) + make_interval(hours => c.horizonte_dias * 24)
       and exists (
         select 1
           from public.horario_base hb
          cross join lateral (select (p_h at time zone c.zona_horaria)::time as t) l
          where hb.dia_semana = extract(isodow from (p_h at time zone c.zona_horaria))
            and l.t >= hb.desde
            and extract(epoch from (l.t - hb.desde)) % 1800 = 0
            and extract(epoch from l.t) / 60 + c.duracion_min <= extract(epoch from hb.hasta) / 60)
      from public.config_agenda c
     where c.id = 1), false)
$$;

-- reservar_reunion: la de calesa_reservar.sql, con la hora de _ahora() (1 línea).
create or replace function public.reservar_reunion(p_solicitud_id uuid, p_token_anterior bytea, p_inicio timestamptz, p_zona_visitante text,
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
  v_vencida := p_token_anterior is not null and v_s.creado_en <= (select public._ahora()) - interval '30 days';
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

-- datos_para_horas: la de calesa_reservar.sql, con la hora de _ahora() (4 líneas).
create or replace function public.datos_para_horas(p_solicitud_id uuid, p_token_hash bytea)
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
      'puedeVolverAReservar', v_r.estado = 'cancelada' and v_s.estado = 'nueva' and v_s.creado_en > (select public._ahora()) - interval '30 days',
      'anfitrion', (select jsonb_build_object('nombre', p.nombre, 'whatsapp', p.whatsapp) from public.perfiles p
                     where p.id = v_r.anfitrion_id)));
  end if;
  v_desde := date_trunc('week', (select public._ahora()) at time zone c.zona_horaria) at time zone c.zona_horaria;
  v_hasta := (select public._ahora()) + make_interval(hours => (c.horizonte_dias + 1) * 24);
  return jsonb_build_object(
    'ahora', (select public._ahora()),
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

-- _reunion_del_token: la de calesa_cambiar_reunion.sql, con la hora de _ahora() (1 línea).
create or replace function public._reunion_del_token(p_token_hash bytea, p_esperado timestamptz)
returns public.reuniones
language plpgsql
set search_path = ''
as $$
declare
  v_solicitud uuid;
  v_r public.reuniones;
  v_tarde boolean;
begin
  if p_esperado is null then
    raise exception 'Falta la versión de la reunión.' using errcode = '22023', hint = 'p_actualizado_en_esperado';
  end if;
  select r.solicitud_id into v_solicitud from public.reuniones r where r.token_hash = p_token_hash;
  if v_solicitud is null then
    perform public._fallar('E4');
  end if;
  v_r := public._bloquear_vigente(v_solicitud, null);
  v_tarde := (select public._ahora()) > v_r.inicio - make_interval(hours => (select c.cancelar_hasta_horas from public.config_agenda c where c.id = 1));
  if v_tarde then
    perform public._fallar('E6');
  end if;
  return v_r;
end;
$$;

-- contar_envio: la de calesa_contar_envio.sql, con la hora de _ahora() (5 líneas).
create or replace function public.contar_envio(p_clave text, p_maximo integer, p_ventana_segundos integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conteo integer;
begin
  -- Argumentos inválidos: error antes de escribir (quien limita falla cerrado). La ventana va hasta un día: `limites` se guarda
  -- 2 días y la retención nunca corta una ventana viva.
  if p_clave is null or char_length(p_clave) not between 1 and 200 then
    raise exception 'La clave del límite de envíos no es válida.' using errcode = '22023', hint = 'p_clave';
  end if;
  if p_maximo is null or p_maximo < 1 then
    raise exception 'El máximo del límite de envíos tiene que ser 1 o más.' using errcode = '22023', hint = 'p_maximo';
  end if;
  if p_ventana_segundos is null or p_ventana_segundos not between 1 and 86400 then
    raise exception 'La ventana del límite de envíos va de 1 segundo a 1 día.' using errcode = '22023', hint = 'p_ventana_segundos';
  end if;

  -- Una sola sentencia atómica: dos llamadas a la vez con la misma clave se serializan en el bloqueo de la fila y cada una cuenta
  -- la de la otra. En el `set`, `l.` es la fila de antes. `(select public._ahora())` es la hora del pedido (una transacción por llamada).
  insert into public.limites as l (clave, ventana_inicio, conteo)
  values (p_clave, (select public._ahora()), 1)
  on conflict (clave) do update
    set ventana_inicio = case when (select public._ahora()) >= l.ventana_inicio + make_interval(secs => p_ventana_segundos)
                              then (select public._ahora()) else l.ventana_inicio end,
        conteo = case when (select public._ahora()) >= l.ventana_inicio + make_interval(secs => p_ventana_segundos)
                      then 1 else l.conteo + 1 end
  returning l.conteo into v_conteo;

  return v_conteo <= p_maximo;
end;
$$;
