-- Calesa · el reloj del panel y de sus triggers (paso P38, C3 y C4): las funciones que leían `now()` lo leen de `public._ahora()`,
-- envuelta en `select` para que se evalúe una vez por consulta (InitPlan). Cada una es su definición vigente, sin otro cambio:
-- `create or replace` conserva dueño y grants, y la sentencia repite firma, `security definer`, `set` y volatilidad tal cual. Lo vigila
-- `supabase/tests/reloj-copias.test.ts`. `_proteger_solicitudes` es de invocador y corre como authenticated: por eso `_ahora()` la
-- ejecuta authenticated. `_repartir_reuniones` es la de tres argumentos (la de dos es una envoltura sin hora).

-- _proteger_solicitudes: la de calesa_columnas_protegidas.sql, con la hora de _ahora() (1 línea).
create or replace function public._proteger_solicitudes()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_permitidas text[] := array['ultimo_contacto_en'];
  v_puede_editar_contacto boolean;
  v_columna text;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  v_puede_editar_contacto := (select public.tiene_permiso('solicitudes.editar_contacto'));
  if v_puede_editar_contacto then
    v_permitidas := v_permitidas || array['nombre', 'email', 'importadora', 'pais', 'whatsapp'];
  end if;
  v_columna := public._columna_cambiada(to_jsonb(old), to_jsonb(new), v_permitidas);
  if v_columna is not null then
    raise exception 'Este dato no se cambia desde aquí.' using errcode = '42501', hint = v_columna;
  end if;
  -- La retención (C2) borra a los 24 meses de `ultimo_contacto_en`: directo sólo avanza (atrasarlo sería borrar, que el vendedor no
  -- puede) y nunca al futuro (sería esquivar la retención). Un minuto de margen por la hora del servidor de la app. Sólo si cambia:
  -- un valor futuro que dejó una RPC no bloquea editar otra columna.
  if new.ultimo_contacto_en is distinct from old.ultimo_contacto_en
     and (new.ultimo_contacto_en < old.ultimo_contacto_en or new.ultimo_contacto_en > (select public._ahora()) + interval '1 minute') then
    raise exception 'El último contacto no puede ir hacia atrás ni al futuro.' using errcode = '42501', hint = 'ultimo_contacto_en';
  end if;
  return new;
end;
$$;

-- _validar_estado_solicitud: la de calesa_estados.sql, con la hora de _ahora() (2 líneas).
create or replace function public._validar_estado_solicitud()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_regla record;
  v_inicio timestamptz;
  v_hay_reunion boolean;
  v_falta_reunion boolean;
begin
  if new.estado = old.estado then
    return new;
  end if;
  select * into v_regla from public._transicion(old.estado, new.estado);
  if not found then
    perform public._fallar('E2');
  end if;
  -- reuniones_una_confirmada (solicitud_id) where confirmada
  select r.inicio into v_inicio from public.reuniones r where r.solicitud_id = new.id and r.estado = 'confirmada';
  v_hay_reunion := found;
  v_falta_reunion := (new.estado = 'agendada' or v_regla.solo_despues_del_inicio) and not v_hay_reunion;
  if v_falta_reunion or (v_regla.solo_despues_del_inicio and (select public._ahora()) < v_inicio) then
    perform public._fallar('E2');
  end if;
  new.ultimo_contacto_en := (select public._ahora());
  return new;
end;
$$;

-- _efecto_en_reunion: la de calesa_estados.sql, con la hora de _ahora() (1 línea).
create or replace function public._efecto_en_reunion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_efecto public.estado_reunion;
begin
  select t.efecto into v_efecto from public._transicion(old.estado, new.estado) t;
  if v_efecto in ('cancelada', 'realizada', 'no_asistio') then
    update public.reuniones
       set estado = v_efecto,
           cancelada_en = case when v_efecto = 'cancelada' then (select public._ahora()) else cancelada_en end
     where solicitud_id = new.id and estado = 'confirmada';
  end if;
  return null;
end;
$$;

-- actualizar_meet: la de calesa_personas.sql, con la hora de _ahora() (1 línea).
create or replace function public.actualizar_meet(p_enlace_meet text, p_actualizado_en_esperado timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_yo uuid := (select auth.uid());
  v_p public.perfiles;
  v_ids uuid[];
begin
  if p_enlace_meet is null or p_enlace_meet !~ '^https://(meet\.google\.com/|([a-z0-9-]+\.)*zoom\.us/)' then
    raise exception 'El enlace de Meet no es válido.' using errcode = '22023', hint = 'p_enlace_meet';
  end if;
  if p_actualizado_en_esperado is null then
    raise exception 'Falta la versión de tu perfil.' using errcode = '22023', hint = 'p_actualizado_en_esperado';
  end if;
  if not (select public.es_usuario_activo()) then
    perform public._fallar('E11');
  end if;
  perform public._bloquear_agenda();
  select * into v_p from public.perfiles p where p.id = v_yo for no key update;
  if v_p.actualizado_en <> p_actualizado_en_esperado then
    perform public._fallar('E19');
  end if;
  if v_p.enlace_meet is not distinct from p_enlace_meet then
    return jsonb_build_object('perfil', jsonb_build_object('id', v_p.id, 'enlaceMeet', v_p.enlace_meet,
      'actualizadoEn', v_p.actualizado_en), 'reuniones', '[]'::jsonb);
  end if;
  update public.perfiles set enlace_meet = p_enlace_meet where id = v_yo returning * into v_p;
  -- reuniones_anfitrion (anfitrion_id, inicio)
  with cambiadas as (
    update public.reuniones r
       set enlace_meet = p_enlace_meet, secuencia_ics = r.secuencia_ics + 1
     where r.anfitrion_id = v_yo and r.estado = 'confirmada' and r.inicio > (select public._ahora())
    returning r.id, r.inicio
  )
  select array_agg(c.id order by c.inicio, c.id) into v_ids from cambiadas c;
  -- El resumen va en otra sentencia: la del `update` no ve sus propios cambios.
  return jsonb_build_object('perfil', jsonb_build_object('id', v_p.id, 'enlaceMeet', v_p.enlace_meet,
      'actualizadoEn', v_p.actualizado_en),
    'reuniones', coalesce((select jsonb_agg(public._resumen_reunion(f.id, null) order by f.i)
                             from unnest(v_ids) with ordinality f (id, i)), '[]'::jsonb));
end;
$$;

-- _repartir_reuniones: la de calesa_turno.sql, con la hora de _ahora() (3 líneas).
create or replace function public._repartir_reuniones(p_perfil uuid, p_respaldo uuid, p_pausa boolean)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_r public.reuniones;
  v_futuras uuid[] := '{}'::uuid[];
begin
  -- reuniones_anfitrion (anfitrion_id, inicio): en pausa, sólo desde ahora.
  for v_id in select r.id from public.reuniones r
               where r.anfitrion_id = p_perfil and r.estado = 'confirmada'
                 and r.inicio > case when p_pausa then (select public._ahora()) else '-infinity'::timestamptz end
               order by r.inicio, r.id
  loop
    perform 1 from public.solicitudes s where s.id = (select r.solicitud_id from public.reuniones r where r.id = v_id) for update;
    select * into v_r from public.reuniones r
     where r.id = v_id and r.estado = 'confirmada' and r.anfitrion_id = p_perfil for update;
    continue when v_r.id is null;
    if p_pausa then
      continue when v_r.inicio <= (select public._ahora()) or public._limitar_a(v_r.solicitud_id) = p_perfil;
      if public._pasar_reunion(v_r, public._orden_reunion(v_r.inicio,
           public._candidatos_reunion(v_r.inicio, public._limitar_a(v_r.solicitud_id), v_r.id), null, v_r.id)) is null then
        perform public._fallar('E20');
      end if;
      v_futuras := v_futuras || v_r.id;
    elsif v_r.inicio > (select public._ahora()) then
      if public._pasar_reunion(v_r, public._orden_reunion(v_r.inicio,
           public._candidatos_reunion(v_r.inicio, public._limitar_a(v_r.solicitud_id), v_r.id), null, v_r.id)) is null then
        if not public._es_elegible(p_respaldo, v_r.inicio, v_r.id, false) then
          perform public._fallar('E14');
        end if;
        if public._pasar_reunion(v_r, array[p_respaldo]) is null then
          perform public._fallar('E14');
        end if;
      end if;
      v_futuras := v_futuras || v_r.id;
    else
      begin
        update public.reuniones set anfitrion_id = p_respaldo where id = v_r.id;
      exception when exclusion_violation then
        perform public._fallar('E14');
      end;
      update public.solicitudes set asignado_a = p_respaldo where id = v_r.solicitud_id;
    end if;
  end loop;
  return coalesce((select jsonb_agg(public._resumen_reunion(f.id, p_perfil) order by f.i)
                     from unnest(v_futuras) with ordinality f (id, i)), '[]'::jsonb);
end;
$$;

-- aceptar_invitacion: la de calesa_acceso.sql, con la hora de _ahora() (2 líneas).
create or replace function public.aceptar_invitacion()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_yo uuid := (select auth.uid());
  v_email text;
  v_p public.perfiles;
  v_i public.invitaciones;
begin
  if v_yo is null then
    perform public._fallar('E23');
  end if;
  select * into v_p from public.perfiles p where p.id = v_yo;
  if v_p.id is not null then
    return jsonb_build_object('perfil', public._perfil_json(v_p), 'nueva', false);
  end if;
  select u.email into v_email from auth.users u where u.id = v_yo;
  -- invitaciones_email_pendiente (email) where estado = 'pendiente'
  select * into v_i from public.invitaciones i
   where i.estado = 'pendiente' and i.email operator(extensions.=) v_email::extensions.citext
     for update;
  select * into v_p from public.perfiles p where p.id = v_yo;
  if v_p.id is not null then
    return jsonb_build_object('perfil', public._perfil_json(v_p), 'nueva', false);
  end if;
  if v_i.id is null or v_i.expira_en <= (select public._ahora()) then
    perform public._fallar('E23');
  end if;
  begin
    insert into public.perfiles (id, nombre, email, rol, activo, en_turno)
    values (v_yo, v_i.nombre, v_i.email, 'vendedor', true, false)
    returning * into v_p;
  exception when unique_violation then
    perform public._fallar('E23');
  end;
  update public.invitaciones set estado = 'aceptada', aceptada_en = (select public._ahora()) where id = v_i.id;
  return jsonb_build_object('perfil', public._perfil_json(v_p), 'nueva', true);
end;
$$;
