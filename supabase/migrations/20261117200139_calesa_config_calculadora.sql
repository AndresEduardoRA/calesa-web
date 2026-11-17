-- Calesa · los datos de la calculadora y la auditoría de las configuraciones (semilla §2 l. 82, §3 l. 262, §4 filas 2, 3, 28 y 38;
-- paso P31, C7–C10). `guardar_config_calculadora` es la única escritura de `config_calculadora` (una fórmula: sólo por RPC, migraciones.md),
-- desde `/panel/calculadora` (P21): sólo `authenticated`, con la clave `calculadora.configurar`, que nace aquí (P1a). Todo cambio de
-- `config_calculadora` o `config_agenda` deja una fila `config` con lo que cambió (P10a).

-- C7, C8: los 9 datos y la versión, todos obligatorios; sin la clave, E11; otra versión, E18. Un dato que rompe un check de la tabla
-- es 22023 con la restricción en `hint`, como `crear_o_juntar_solicitud` (en un check_violation la columna viene vacía).
create function public.guardar_config_calculadora(p_precio int, p_pct_sena int, p_sena int, p_moneda_local boolean, p_pct_local int,
  p_volatilidad public.volatilidad, p_sueldo int, p_tasa int, p_ciclo_dias int, p_actualizado_en_esperado timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_falta text;
  v_c public.config_calculadora;
  v_columna text;
  v_restriccion text;
begin
  v_falta := case
    when p_precio is null then 'p_precio'
    when p_pct_sena is null then 'p_pct_sena'
    when p_sena is null then 'p_sena'
    when p_moneda_local is null then 'p_moneda_local'
    when p_pct_local is null then 'p_pct_local'
    when p_volatilidad is null then 'p_volatilidad'
    when p_sueldo is null then 'p_sueldo'
    when p_tasa is null then 'p_tasa'
    when p_ciclo_dias is null then 'p_ciclo_dias'
    when p_actualizado_en_esperado is null then 'p_actualizado_en_esperado'
  end;
  if v_falta is not null then
    raise exception 'Faltan datos de la calculadora.' using errcode = '22023', hint = v_falta;
  end if;
  if not (select public.tiene_permiso('calculadora.configurar')) then
    perform public._fallar('E11');
  end if;
  select * into v_c from public.config_calculadora c where c.id = 1 for update;
  if v_c.id is null or v_c.actualizado_en <> p_actualizado_en_esperado then
    perform public._fallar('E18');
  end if;
  begin
    update public.config_calculadora
       set precio = p_precio, pct_sena = p_pct_sena, sena = p_sena, moneda_local = p_moneda_local, pct_local = p_pct_local,
           volatilidad = p_volatilidad, sueldo = p_sueldo, tasa = p_tasa, ciclo_dias = p_ciclo_dias,
           actualizado_por = (select auth.uid())
     where id = 1
    returning * into v_c;
  exception when check_violation then
    get stacked diagnostics v_columna = column_name, v_restriccion = constraint_name;
    raise exception 'Los datos de la calculadora no son válidos.' using errcode = '22023',
      hint = coalesce(nullif(v_columna, ''), v_restriccion);
  end;
  return jsonb_build_object('precio', v_c.precio, 'pctSena', v_c.pct_sena, 'sena', v_c.sena, 'monedaLocal', v_c.moneda_local,
    'pctLocal', v_c.pct_local, 'volatilidad', v_c.volatilidad, 'sueldo', v_c.sueldo, 'tasa', v_c.tasa, 'cicloDias', v_c.ciclo_dias,
    'actualizadoEn', v_c.actualizado_en);
end;
$$;

-- C10 (P10a): una fila `config` por cambio, con sólo las columnas que cambiaron (sin la versión, la creación ni quién). Las
-- configuraciones son de una fila (`id smallint = 1`) y `auditoria.registro_id` es un uuid obligatorio: va el uuid nulo y `tabla`
-- dice cuál. De definidor: `auditoria` no tiene grant de escritura.
create function public._auditar_config()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes jsonb;
  v_despues jsonb;
begin
  select jsonb_object_agg(o.key, o.value), jsonb_object_agg(o.key, n.value)
    into v_antes, v_despues
    from jsonb_each(to_jsonb(old) - array['actualizado_en', 'creado_en', 'actualizado_por']) o
    join jsonb_each(to_jsonb(new)) n on n.key = o.key
   where o.value is distinct from n.value;
  if v_antes is not null then
    insert into public.auditoria (actor_id, accion, tabla, registro_id, antes, despues)
    values ((select auth.uid()), 'config', tg_table_name, '00000000-0000-0000-0000-000000000000', v_antes, v_despues);
  end if;
  return null;
end;
$$;

create trigger auditar after update on public.config_calculadora
  for each row execute function public._auditar_config();
create trigger auditar after update on public.config_agenda
  for each row execute function public._auditar_config();

-- C9: la del panel, sólo `authenticated`; el trigger, nadie del API.
revoke all on function public._auditar_config() from public, anon, authenticated;
revoke all on function public.guardar_config_calculadora(int, int, int, boolean, int, public.volatilidad, int, int, int, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.guardar_config_calculadora(int, int, int, boolean, int, public.volatilidad, int, int, int, timestamptz)
  to authenticated;

-- La clave nace con su punto de aplicación (§2 l. 82: sólo el admin, todas).
insert into public.permisos (clave, descripcion) values
  ('calculadora.configurar', 'Cambiar los datos de la calculadora.')
on conflict (clave) do update set descripcion = excluded.descripcion;
insert into public.permisos_rol (rol, clave, alcance) values ('admin', 'calculadora.configurar', 'todos')
on conflict (rol, clave) do update set alcance = excluded.alcance;
