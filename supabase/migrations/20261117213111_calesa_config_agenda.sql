-- Calesa · las reglas y el horario común de la agenda (semilla §3 l. 284, §5.5, B10–B12, §4 fila 27 y matriz l. 104; paso P34,
-- C10–C13). `guardar_config_agenda` y `guardar_horario_base` son las únicas escrituras de `config_agenda` y `horario_base`, desde
-- `/panel/disponibilidad` (P15): sólo `authenticated`, con `agenda.configurar`. Toman el candado de la agenda, porque la reserva lee
-- las reglas y el horario bajo él. Las reuniones ya reservadas no cambian (P11a). La zona horaria no se cambia (P8a).

-- C11: las 6 reglas y la versión, todas obligatorias; sin la clave, E11; otra versión, E21. Una regla fuera de rango es 22023 con la
-- restricción en `hint`. La fila `config` la escribe `_auditar_config` (P31) con sólo lo cambiado.
create function public.guardar_config_agenda(p_duracion_min int, p_descanso_min int, p_anticipacion_min_horas int,
  p_horizonte_dias int, p_max_reuniones_dia int, p_cancelar_hasta_horas int, p_actualizado_en_esperado timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_falta text;
  v_c public.config_agenda;
  v_restriccion text;
begin
  v_falta := case
    when p_duracion_min is null then 'p_duracion_min'
    when p_descanso_min is null then 'p_descanso_min'
    when p_anticipacion_min_horas is null then 'p_anticipacion_min_horas'
    when p_horizonte_dias is null then 'p_horizonte_dias'
    when p_max_reuniones_dia is null then 'p_max_reuniones_dia'
    when p_cancelar_hasta_horas is null then 'p_cancelar_hasta_horas'
    when p_actualizado_en_esperado is null then 'p_actualizado_en_esperado'
  end;
  if v_falta is not null then
    raise exception 'Faltan reglas de la agenda.' using errcode = '22023', hint = v_falta;
  end if;
  if not (select public.tiene_permiso('agenda.configurar')) then
    perform public._fallar('E11');
  end if;
  perform public._bloquear_agenda();
  select * into v_c from public.config_agenda c where c.id = 1 for update;
  if v_c.id is null or v_c.actualizado_en <> p_actualizado_en_esperado then
    perform public._fallar('E21');
  end if;
  begin
    update public.config_agenda
       set duracion_min = p_duracion_min, descanso_min = p_descanso_min, anticipacion_min_horas = p_anticipacion_min_horas,
           horizonte_dias = p_horizonte_dias, max_reuniones_dia = p_max_reuniones_dia, cancelar_hasta_horas = p_cancelar_hasta_horas
     where id = 1
    returning * into v_c;
  exception when check_violation then
    get stacked diagnostics v_restriccion = constraint_name;
    raise exception 'Las reglas de la agenda no son válidas.' using errcode = '22023', hint = v_restriccion;
  end;
  return jsonb_build_object('duracionMin', v_c.duracion_min, 'descansoMin', v_c.descanso_min,
    'anticipacionMinHoras', v_c.anticipacion_min_horas, 'horizonteDias', v_c.horizonte_dias, 'maxReunionesDia', v_c.max_reuniones_dia,
    'cancelarHastaHoras', v_c.cancelar_hasta_horas, 'zonaHoraria', v_c.zona_horaria, 'actualizadoEn', v_c.actualizado_en);
end;
$$;

-- C12, C13: reemplaza el horario entero, de 1 a 35 tramos (P12a: nunca vacío). La versión es la mayor `creado_en` de sus filas (P9a),
-- propia del horario: cada guardado reescribe las filas con una hora que siempre avanza. Si la tabla quedó vacía por fuera de esta RPC,
-- no hay versión que comparar. El mismo conjunto, en cualquier orden, no escribe ni audita. Un cambio deja una fila `config` con los
-- tramos de antes y de después (P10a), con el uuid nulo como `registro_id`, como `_auditar_config`.
create function public.guardar_horario_base(p_tramos jsonb, p_actualizado_en_esperado timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t jsonb;
  v_hora constant text := '^([01]\d|2[0-3]):[0-5]\d$';
  v_ver timestamptz;
  v_creado timestamptz;
  v_antes jsonb;
  v_despues jsonb;
  v_restriccion text;
begin
  if jsonb_typeof(p_tramos) is distinct from 'array' then
    raise exception 'El horario no es válido.' using errcode = '22023', hint = 'p_tramos';
  end if;
  if jsonb_array_length(p_tramos) not between 1 and 35 then
    raise exception 'El horario necesita de 1 a 35 tramos.' using errcode = '22023', hint = 'p_tramos';
  end if;
  for v_t in select e.value from jsonb_array_elements(p_tramos) e loop
    if jsonb_typeof(v_t) is distinct from 'object' then
      raise exception 'El horario no es válido.' using errcode = '22023', hint = 'p_tramos';
    end if;
    if (select array_agg(k collate "C" order by k collate "C") from jsonb_object_keys(v_t) k)
         is distinct from array['desde', 'diaSemana', 'hasta']
       or jsonb_typeof(v_t -> 'diaSemana') is distinct from 'number' or (v_t ->> 'diaSemana') !~ '^[1-7]$'
       or jsonb_typeof(v_t -> 'desde') is distinct from 'string' or (v_t ->> 'desde') !~ v_hora
       or jsonb_typeof(v_t -> 'hasta') is distinct from 'string' or (v_t ->> 'hasta') !~ v_hora then
      raise exception 'El horario no es válido.' using errcode = '22023', hint = 'p_tramos';
    end if;
  end loop;
  if p_actualizado_en_esperado is null then
    raise exception 'Falta la versión del horario.' using errcode = '22023', hint = 'p_actualizado_en_esperado';
  end if;
  if not (select public.tiene_permiso('agenda.configurar')) then
    perform public._fallar('E11');
  end if;
  perform public._bloquear_agenda();
  v_ver := (select max(h.creado_en) from public.horario_base h);
  if v_ver is not null and v_ver <> p_actualizado_en_esperado then
    perform public._fallar('E22');
  end if;
  v_antes := (select coalesce(jsonb_agg(jsonb_build_object('diaSemana', h.dia_semana, 'desde', to_char(h.desde, 'HH24:MI'),
                 'hasta', to_char(h.hasta, 'HH24:MI')) order by h.dia_semana, h.desde, h.hasta), '[]'::jsonb)
                from public.horario_base h);
  v_despues := (select jsonb_agg(jsonb_build_object('diaSemana', (e.value ->> 'diaSemana')::int, 'desde', e.value ->> 'desde',
                   'hasta', e.value ->> 'hasta') order by (e.value ->> 'diaSemana')::int, e.value ->> 'desde', e.value ->> 'hasta')
                  from jsonb_array_elements(p_tramos) e);
  if v_despues = v_antes then
    return jsonb_build_object('tramos', v_antes, 'actualizadoEn', v_ver);
  end if;
  v_creado := greatest(clock_timestamp(), coalesce(v_ver, '-infinity'::timestamptz) + interval '1 microsecond');
  delete from public.horario_base;
  begin
    insert into public.horario_base (dia_semana, desde, hasta, creado_en)
    select (e.value ->> 'diaSemana')::smallint, (e.value ->> 'desde')::time, (e.value ->> 'hasta')::time, v_creado
      from jsonb_array_elements(p_tramos) e;
  exception when check_violation or exclusion_violation then
    get stacked diagnostics v_restriccion = constraint_name;
    raise exception 'El horario no es válido.' using errcode = '22023', hint = v_restriccion;
  end;
  insert into public.auditoria (actor_id, accion, tabla, registro_id, antes, despues)
  values ((select auth.uid()), 'config', 'horario_base', '00000000-0000-0000-0000-000000000000', jsonb_build_object('tramos', v_antes),
    jsonb_build_object('tramos', v_despues));
  return jsonb_build_object('tramos', v_despues, 'actualizadoEn', v_creado);
end;
$$;

-- C10: las dos del panel, sólo `authenticated` (sin sesión no hay a quién atribuir el cambio). Las tablas siguen sin grant de escritura.
revoke all on function public.guardar_config_agenda(int, int, int, int, int, int, timestamptz),
  public.guardar_horario_base(jsonb, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.guardar_config_agenda(int, int, int, int, int, int, timestamptz),
  public.guardar_horario_base(jsonb, timestamptz)
  to authenticated;
