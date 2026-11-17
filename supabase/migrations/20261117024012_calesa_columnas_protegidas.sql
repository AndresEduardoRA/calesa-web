-- Calesa · columnas protegidas (semilla §2, §3 › «sólo por RPC», R4.7). Un trigger `before update` por tabla rechaza, cuando quien
-- actualiza es `authenticated` o `anon`, el cambio de una columna que no está permitida, con `42501` y la columna en el `hint`. Una
-- RPC (`security definer`, dueño postgres) o `service_role` pasan. Aparte, en perfiles, nadie se desactiva a sí mismo, tampoco por
-- RPC (§2: el admin «no puede desactivarse a sí mismo»).

-- La primera columna (por nombre) que cambió y no está permitida, sin contar `actualizado_en`; null si ninguna. La llaman los
-- triggers, que son de invocador: por eso `authenticated` la ejecuta.
create function public._columna_cambiada(p_antes jsonb, p_despues jsonb, p_permitidas text[])
returns text
language sql
immutable
set search_path = ''
as $$
  select min(d.key)
    from jsonb_each(p_despues) d
   where d.key <> 'actualizado_en'
     and d.key <> all (p_permitidas)
     and (p_antes -> d.key) is distinct from d.value
$$;

revoke all on function public._columna_cambiada(jsonb, jsonb, text[]) from public, anon;
grant execute on function public._columna_cambiada(jsonb, jsonb, text[]) to authenticated, service_role;

-- solicitudes: directo, `ultimo_contacto_en`; los datos de contacto, con solicitudes.editar_contacto. Estado y asignado_a, por RPC.
create function public._proteger_solicitudes()
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
     and (new.ultimo_contacto_en < old.ultimo_contacto_en or new.ultimo_contacto_en > now() + interval '1 minute') then
    raise exception 'El último contacto no puede ir hacia atrás ni al futuro.' using errcode = '42501', hint = 'ultimo_contacto_en';
  end if;
  return new;
end;
$$;

-- perfiles: directo, nombre, WhatsApp y enlace de Meet de la fila propia. Rol, activo y en_turno, por RPC; y nadie se desactiva a
-- sí mismo, ni siquiera desde una RPC.
create function public._proteger_perfiles()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_columna text;
begin
  if old.id = (select auth.uid()) and old.activo and not new.activo then
    raise exception 'Nadie puede desactivarse a sí mismo.' using errcode = '42501', hint = 'activo';
  end if;
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  v_columna := public._columna_cambiada(to_jsonb(old), to_jsonb(new), array['nombre', 'whatsapp', 'enlace_meet']);
  if v_columna is not null then
    raise exception 'Este dato no se cambia desde aquí.' using errcode = '42501', hint = v_columna;
  end if;
  return new;
end;
$$;

-- reuniones: nada directo (R4.7: el estado cambia por la solicitud o por las funciones de reserva).
create function public._proteger_reuniones()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_columna text;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  v_columna := public._columna_cambiada(to_jsonb(old), to_jsonb(new), '{}'::text[]);
  if v_columna is not null then
    raise exception 'Este dato no se cambia desde aquí.' using errcode = '42501', hint = v_columna;
  end if;
  return new;
end;
$$;

revoke all on function public._proteger_solicitudes(), public._proteger_perfiles(), public._proteger_reuniones()
  from public, anon, authenticated;

create trigger proteger_columnas before update on public.solicitudes
  for each row execute function public._proteger_solicitudes();
create trigger proteger_columnas before update on public.perfiles
  for each row execute function public._proteger_perfiles();
create trigger proteger_columnas before update on public.reuniones
  for each row execute function public._proteger_reuniones();
