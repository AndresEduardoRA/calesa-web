-- Comprueba la restauración en la base temporal (comprobar.sh, X13): están las tablas de P02 y hay solicitudes. Sólo nombra tablas,
-- nunca un valor, y no cuenta filas. La lista va una tabla por línea, con la forma `    'perfiles',` (la última sin coma): autoprueba.sh
-- la compara con los `create table public.*` de las migraciones de P02.
do $$
declare
  faltan text;
begin
  select string_agg(tabla, ', ' order by tabla) into faltan
  from unnest(array[
    'auditoria',
    'bloqueos',
    'config_agenda',
    'config_calculadora',
    'correos_salientes',
    'enlaces_prospeccion',
    'equipo',
    'eventos',
    'horario_base',
    'invitaciones',
    'latidos',
    'limites',
    'metricas_diarias',
    'metricas_persona',
    'notas',
    'perfiles',
    'permisos',
    'permisos_rol',
    'reuniones',
    'solicitudes'
  ]) as tabla
  where to_regclass('public.' || quote_ident(tabla)) is null;

  if faltan is not null then
    raise exception 'Faltan tablas de P02 en la restauración: %.', faltan;
  end if;
  if not exists (select from public.solicitudes) then
    raise exception 'La restauración no trae solicitudes.';
  end if;
  raise notice 'La restauración tiene las tablas de P02 y solicitudes.';
end
$$;
