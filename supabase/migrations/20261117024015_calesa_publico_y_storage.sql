-- Calesa · lo que lee el visitante y el bucket de fotos del equipo (semilla §2, §4 filas 1–3 y 40–42, E6). `anon` no tiene nada en
-- `public` (lo prueba supabase/tests/privilegios-de-anon.sql): lee por dos funciones de sólo lectura en su propio esquema,
-- `publico`, expuesto en `[api] schemas` de config.toml. Exponerlo en el proyecto de la nube lo hace el paso de lanzamiento.

create schema if not exists publico;
revoke all on schema publico from public;
grant usage on schema publico to anon, authenticated, service_role;

-- La sección «Quiénes somos»: sólo las filas visibles, en su orden. Tope fijo (la sección no pagina).
create function publico.equipo_visible()
returns table (id uuid, nombre text, cargo text, frase text, foto_ruta text, orden int)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.nombre, e.cargo, e.frase, e.foto_ruta, e.orden
    from public.equipo e
   where e.visible
   order by e.orden, e.id
   limit 100
$$;

-- Los datos de la calculadora (B4, B4.1), sin quién los cambió.
create function publico.config_calculadora()
returns table (precio int, pct_sena int, sena int, moneda_local boolean, pct_local int, volatilidad public.volatilidad, sueldo int,
  tasa int, ciclo_dias int)
language sql
stable
security definer
set search_path = ''
as $$
  select c.precio, c.pct_sena, c.sena, c.moneda_local, c.pct_local, c.volatilidad, c.sueldo, c.tasa, c.ciclo_dias
    from public.config_calculadora c
   where c.id = 1
$$;

revoke all on function publico.equipo_visible(), publico.config_calculadora() from public, anon, authenticated;
grant execute on function publico.equipo_visible(), publico.config_calculadora() to anon, authenticated, service_role;

-- El bucket de las fotos del equipo: público para leer por su URL; 5 MiB; jpeg, png y webp (P6 de P02). Un dato de catálogo: va
-- aquí con `on conflict`, no en el seed.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('equipo', 'equipo', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set name = excluded.name,
      public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Sube y lista quien tiene equipo.gestionar. Sin update ni delete: la foto se sube por hash, sin upsert («ya existe» es éxito:
-- mismo hash, mismo contenido), y una huérfana la quita el recolector, nunca el panel. A storage.objects sólo se le crean policies.
create policy equipo_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'equipo' and (select public.tiene_permiso('equipo.gestionar')));
create policy equipo_ver on storage.objects for select to authenticated
  using (bucket_id = 'equipo' and (select public.tiene_permiso('equipo.gestionar')));
