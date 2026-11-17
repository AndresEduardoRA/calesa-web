-- Calesa · las métricas que llevan los triggers (semilla §3 l. 256-258, R4.4, l. 665; paso P31, C15–C22; P6a, P7a, P8a). Cada cambio
-- suma en una fila de `metricas_diarias` (y de `metricas_persona` si tiene persona) del día local de config_agenda: el embudo de
-- `/panel` lee ≤ 31 filas por mes y nunca cuenta. Las métricas cuentan lo que pasó: nada resta al borrar ni al cancelar, y empiezan en
-- esta migración (sin relleno). Orden de filas en cada trigger: primero la diaria, después las de persona por `perfil_id`, así dos
-- transacciones no toman las mismas filas en orden inverso (docs/pasos/P31/decisiones.md).

-- C15: el día local (la zona de la agenda, la misma del reparto y de las horas).
create function public._dia_local(p_t timestamptz)
returns date
language sql
stable
set search_path = ''
as $$
  select (p_t at time zone coalesce((select c.zona_horaria from public.config_agenda c where c.id = 1), 'America/La_Paz'))::date
$$;

-- C15: suma atómica (`insert … on conflict`), nunca bajo 0; la columna sale de una lista cerrada.
create function public._sumar_diaria(p_dia date, p_columna text, p_n int)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_columna is null or p_columna not in ('solicitudes', 'reuniones_reservadas', 'reuniones_realizadas', 'ganadas',
       'clics_whatsapp', 'calculadoras') then
    raise exception 'Esa métrica no existe.' using errcode = '22023', hint = 'p_columna';
  end if;
  execute format('insert into public.metricas_diarias as m (dia, %1$I) values ($1, greatest($2, 0))
                  on conflict (dia) do update set %1$I = greatest(m.%1$I + $2, 0)', p_columna)
    using p_dia, p_n;
end;
$$;

create function public._sumar_persona(p_dia date, p_perfil uuid, p_columna text, p_n int)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_columna is null or p_columna not in ('solicitudes_asignadas', 'reuniones_reservadas', 'reuniones_realizadas', 'ganadas') then
    raise exception 'Esa métrica no existe.' using errcode = '22023', hint = 'p_columna';
  end if;
  execute format('insert into public.metricas_persona as m (dia, perfil_id, %1$I) values ($1, $2, greatest($3, 0))
                  on conflict (dia, perfil_id) do update set %1$I = greatest(m.%1$I + $3, 0)', p_columna)
    using p_dia, p_perfil, p_n;
end;
$$;

-- C16, C17 (P7a): una solicitud nueva cuenta en su día (y a su asignado); juntar una repetida no cambia estado ni asignado y no suma.
-- Un traspaso resta a quien la tenía y suma a quien la recibe en el día de la solicitud (ningún día queda negativo y el mes suma lo
-- que hoy tiene cada uno). A `ganada`, hoy, en el día y para el asignado de ese momento; reasignar una ganada no mueve `ganadas`.
create function public._metricas_solicitud()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dia date;
  v_hoy date;
  v_ganada boolean;
  v_x record;
begin
  if tg_op = 'INSERT' then
    v_dia := public._dia_local(new.creado_en);
    perform public._sumar_diaria(v_dia, 'solicitudes', 1);
    if new.asignado_a is not null then
      perform public._sumar_persona(v_dia, new.asignado_a, 'solicitudes_asignadas', 1);
    end if;
    return null;
  end if;
  v_ganada := new.estado = 'ganada' and old.estado is distinct from 'ganada';
  if v_ganada then
    v_hoy := public._dia_local(now());
    perform public._sumar_diaria(v_hoy, 'ganadas', 1);
  end if;
  if new.asignado_a is distinct from old.asignado_a then
    v_dia := public._dia_local(new.creado_en);
    for v_x in select t.perfil, t.n from (values (old.asignado_a, -1), (new.asignado_a, 1)) t (perfil, n)
                where t.perfil is not null order by t.perfil loop
      perform public._sumar_persona(v_dia, v_x.perfil, 'solicitudes_asignadas', v_x.n);
    end loop;
  end if;
  if v_ganada and new.asignado_a is not null then
    perform public._sumar_persona(v_hoy, new.asignado_a, 'ganadas', 1);
  end if;
  return null;
end;
$$;

-- C18, C19 (P6a, P7a): una reunión confirmada cuenta en el día en que se reserva (y al anfitrión); otra fila (volver a reservar) vuelve
-- a sumar. Un cambio de anfitrión mueve la reservada en el día de la reunión. A `realizada`, en el día de la demo y para el anfitrión
-- de ese momento; ya realizada, un cambio de anfitrión no mueve `reuniones_realizadas`.
create function public._metricas_reunion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dia date;
  v_demo date;
  v_realizada boolean;
  v_x record;
begin
  if tg_op = 'INSERT' then
    if new.estado = 'confirmada' then
      v_dia := public._dia_local(new.creado_en);
      perform public._sumar_diaria(v_dia, 'reuniones_reservadas', 1);
      perform public._sumar_persona(v_dia, new.anfitrion_id, 'reuniones_reservadas', 1);
    end if;
    return null;
  end if;
  v_realizada := new.estado = 'realizada' and old.estado is distinct from 'realizada';
  if v_realizada then
    v_demo := public._dia_local(new.inicio);
    perform public._sumar_diaria(v_demo, 'reuniones_realizadas', 1);
  end if;
  if new.anfitrion_id is distinct from old.anfitrion_id then
    v_dia := public._dia_local(new.creado_en);
    for v_x in select t.perfil, t.n from (values (old.anfitrion_id, -1), (new.anfitrion_id, 1)) t (perfil, n)
                order by t.perfil loop
      perform public._sumar_persona(v_dia, v_x.perfil, 'reuniones_reservadas', v_x.n);
    end loop;
  end if;
  if v_realizada then
    perform public._sumar_persona(v_demo, new.anfitrion_id, 'reuniones_realizadas', 1);
  end if;
  return null;
end;
$$;

-- C20: los clics de WhatsApp y las calculadoras usadas; `detalle_calculadora` es una solicitud (ya cuenta allí) y los demás no cuentan.
create function public._metricas_evento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.tipo = 'clic_whatsapp' then
    perform public._sumar_diaria(public._dia_local(new.creado_en), 'clics_whatsapp', 1);
  elsif new.tipo = 'calculadora_usada' then
    perform public._sumar_diaria(public._dia_local(new.creado_en), 'calculadoras', 1);
  end if;
  return null;
end;
$$;

-- C21: sin triggers de delete (P8a).
create trigger metricas after insert or update of estado, asignado_a on public.solicitudes
  for each row execute function public._metricas_solicitud();
create trigger metricas after insert or update of anfitrion_id, estado on public.reuniones
  for each row execute function public._metricas_reunion();
create trigger metricas after insert on public.eventos
  for each row execute function public._metricas_evento();

-- C22: nadie del API los ejecuta; los triggers son de definidor (las métricas no tienen grant de escritura) y llaman a los ayudantes
-- como su dueño.
revoke all on function public._dia_local(timestamptz), public._sumar_diaria(date, text, int), public._sumar_persona(date, uuid, text, int),
  public._metricas_solicitud(), public._metricas_reunion(), public._metricas_evento()
  from public, anon, authenticated;
