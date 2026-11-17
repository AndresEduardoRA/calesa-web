-- Calesa · las reglas de la agenda en la base (semilla §5.5, §5.6, X5, X10, R4.9, R4.13, R4.20; paso P05, C1–C7). Repiten las reglas
-- puras de `src/modules/agenda/entities/` (horas.ts, elegibilidad.ts, anfitrion.ts, reparto.ts): si cambia una, cambia la otra. Son
-- internas: las llaman las RPC de reserva (de definidor, dueñas postgres) y nadie más las ejecuta. «La zona» es
-- config_agenda.zona_horaria: el día y la semana se cuentan en ella, nunca en UTC.

-- C1: un solo candado para toda la agenda. Más fuerte que uno por hora: la exclusión de la tabla no protege el máximo diario ni el
-- conteo semanal, y dos reservas a horas distintas del mismo día podrían pasar el máximo.
create function public._bloquear_agenda()
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('calesa:agenda'));
end;
$$;

-- C2: dentro de la ventana (los dos bordes), en un tramo del horario base del día local, en el paso de 30 min desde el inicio del
-- tramo (X10) y con la duración entera adentro (en minutos: `time + interval` da la vuelta a medianoche).
create function public._hora_ofrecible(p_h timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((
    select p_h >= now() + make_interval(hours => c.anticipacion_min_horas)
       and p_h <= now() + make_interval(hours => c.horizonte_dias * 24)
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

-- C3: activo, en turno (salvo `p_exigir_turno = false`, que es de P30), con WhatsApp y Meet, sin bloqueo cruzado, sin reunión
-- confirmada cruzada con el descanso vigente (la reunión ocupa hasta fin + descanso y la candidata pide el suyo) y con menos de
-- `max_reuniones_dia` confirmadas en el día local de `p_h`. `p_excluir` = la reunión que se mueve: no cuenta.
create function public._es_elegible(p_perfil uuid, p_h timestamptz, p_excluir uuid, p_exigir_turno boolean default true)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  c public.config_agenda;
  v_fin timestamptz;
  v_contacto boolean;
begin
  select * into c from public.config_agenda where id = 1;
  v_fin := p_h + make_interval(mins => c.duracion_min);
  select p.activo and (p.en_turno or not p_exigir_turno) and coalesce(p.whatsapp, '') <> '' and coalesce(p.enlace_meet, '') <> ''
    into v_contacto
    from public.perfiles p
   where p.id = p_perfil;
  if not coalesce(v_contacto, false) then
    return false;
  end if;
  -- bloqueos_perfil_rango (gist): el bloqueo no suma descanso.
  if exists (select 1 from public.bloqueos b
              where b.perfil_id = p_perfil and tstzrange(b.inicio, b.fin) && tstzrange(p_h, v_fin)) then
    return false;
  end if;
  -- reuniones_anfitrion (anfitrion_id, inicio).
  if exists (select 1 from public.reuniones r
              where r.anfitrion_id = p_perfil and r.estado = 'confirmada' and r.id is distinct from p_excluir
                and r.inicio < v_fin + make_interval(mins => c.descanso_min)
                and r.fin + make_interval(mins => c.descanso_min) > p_h) then
    return false;
  end if;
  -- reuniones_anfitrion: las del día local, contadas con tope (max_reuniones_dia); ±2 días acota el índice.
  return (select count(*) from (
            select 1 from public.reuniones r
             where r.anfitrion_id = p_perfil and r.estado = 'confirmada' and r.id is distinct from p_excluir
               and r.inicio >= p_h - interval '2 days' and r.inicio < p_h + interval '2 days'
               and (r.inicio at time zone c.zona_horaria)::date = (p_h at time zone c.zona_horaria)::date
             limit c.max_reuniones_dia) x) < c.max_reuniones_dia;
end;
$$;

-- C4: con `p_limitar_a` de un perfil activo (reagendar desde el panel, enlace de prospección), sólo esa persona si es elegible; si
-- no, los vendedores elegibles y, sólo si no hay ninguno, los admins (R1.2, R4.9). El equipo es corto: se recorre entero.
create function public._candidatos_reunion(p_h timestamptz, p_limitar_a uuid, p_excluir uuid, p_exigir_turno boolean default true)
returns uuid[]
language plpgsql
stable
set search_path = ''
as $$
declare
  v_candidatos uuid[];
begin
  if exists (select 1 from public.perfiles p where p.id = p_limitar_a and p.activo) then
    return case when public._es_elegible(p_limitar_a, p_h, p_excluir, p_exigir_turno) then array[p_limitar_a] else '{}'::uuid[] end;
  end if;
  v_candidatos := array(select p.id from public.perfiles p
                         where p.rol = 'vendedor' and p.activo and public._es_elegible(p.id, p_h, p_excluir, p_exigir_turno)
                         order by p.id);
  if cardinality(v_candidatos) = 0 then
    v_candidatos := array(select p.id from public.perfiles p
                           where p.rol = 'admin' and p.activo and public._es_elegible(p.id, p_h, p_excluir, p_exigir_turno)
                           order by p.id);
  end if;
  return v_candidatos;
end;
$$;

-- C5: el orden en que se intenta (el primero gana; los demás son el respaldo si choca con la exclusión). Primero el asignado si está
-- entre los candidatos (X5); después, menos reuniones confirmadas en la semana ISO local de `p_h`; empate: la última reunión no
-- cancelada más antigua, sin ninguna primero; empate: `creado_en`; empate: id menor.
create function public._orden_reunion(p_h timestamptz, p_candidatos uuid[], p_asignado uuid, p_excluir uuid)
returns uuid[]
language sql
stable
set search_path = ''
as $$
  select coalesce(array_agg(p.id order by coalesce(p.id = p_asignado, false) desc, s.conteo, u.ultima nulls first, p.creado_en,
           p.id), '{}')
    from public.config_agenda c
   cross join lateral (select date_trunc('week', p_h at time zone c.zona_horaria) as lunes) w
    join public.perfiles p on p.id = any (p_candidatos)
   cross join lateral (
     -- reuniones_anfitrion: las confirmadas de la semana, con tope (12 por día × 7 < 100).
     select count(*) as conteo from (
       select 1 from public.reuniones r
        where r.anfitrion_id = p.id and r.estado = 'confirmada' and r.id is distinct from p_excluir
          and r.inicio >= (w.lunes at time zone c.zona_horaria)
          and r.inicio < ((w.lunes + interval '7 days') at time zone c.zona_horaria)
        limit 100) x) s
   cross join lateral (
     -- reuniones_anfitrion: el inicio de su última reunión no cancelada (puede estar en el futuro).
     select max(r.inicio) as ultima from public.reuniones r where r.anfitrion_id = p.id and r.estado <> 'cancelada') u
   where c.id = 1
$$;

-- C6: una solicitud de prospección va sólo al creador del enlace, si está activo (R2.2, R4.20); si no, null (la regla general).
create function public._limitar_a(p_solicitud uuid)
returns uuid
language sql
stable
set search_path = ''
as $$
  select e.creado_por
    from public.solicitudes s
    join public.enlaces_prospeccion e on e.codigo = s.ref_codigo
    join public.perfiles p on p.id = e.creado_por and p.activo
   where s.id = p_solicitud and s.origen = 'prospeccion'
$$;

-- C7: la zona del visitante es cualquier zona IANA que Postgres conozca (R4.13); un desfase suelto no.
create function public._validar_zona(p_zona text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_valida boolean;
begin
  v_valida := coalesce(char_length(p_zona) between 1 and 64
    and (p_zona ~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+)+$' or p_zona = 'UTC'), false);
  if v_valida then
    begin
      perform now() at time zone p_zona;
    exception when others then
      v_valida := false;
    end;
  end if;
  if not v_valida then
    raise exception 'La zona horaria no es válida.' using errcode = '22023', hint = 'zona_visitante';
  end if;
end;
$$;

revoke all on function public._bloquear_agenda(), public._hora_ofrecible(timestamptz),
  public._es_elegible(uuid, timestamptz, uuid, boolean), public._candidatos_reunion(timestamptz, uuid, uuid, boolean),
  public._orden_reunion(timestamptz, uuid[], uuid, uuid), public._limitar_a(uuid), public._validar_zona(text)
  from public, anon, authenticated;
