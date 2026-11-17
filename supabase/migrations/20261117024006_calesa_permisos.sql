-- Calesa · el catálogo de permisos (semilla §2, X17) y sus funciones. Cada clave tiene su punto de aplicación en este paso (una
-- policy o el trigger de columnas protegidas); las de las RPC de P05 (solicitudes.reasignar, solicitudes.borrar,
-- reuniones.cambiar, calculadora.configurar) entran con esas RPC. `notas.gestionar` es nueva: §2 deja al admin editar y borrar
-- notas y no tenía clave (decisiones de P02).

create table public.permisos (
  clave text primary key check (clave ~ '^[a-z_]+\.[a-z_]+$'),
  descripcion text not null check (char_length(descripcion) between 10 and 200),
  creado_en timestamptz not null default now()
);

-- «propio» = las filas con `asignado_a`, `anfitrion_id`, `perfil_id` o `creado_por` igual a quien pregunta; «todos» = sin acotar.
create table public.permisos_rol (
  rol public.rol_usuario not null,
  clave text not null references public.permisos (clave) on delete cascade,
  alcance text not null check (alcance in ('propio', 'todos')),
  creado_en timestamptz not null default now(),
  primary key (rol, clave)
);

create index permisos_rol_clave on public.permisos_rol (clave); -- FK

alter table public.permisos enable row level security;
alter table public.permisos_rol enable row level security;
revoke all on public.permisos, public.permisos_rol from anon, authenticated;
grant select on public.permisos, public.permisos_rol to authenticated;
create policy permisos_ver on public.permisos for select to authenticated using (true);
create policy permisos_rol_ver on public.permisos_rol for select to authenticated using (true);

insert into public.permisos (clave, descripcion) values
  ('solicitudes.ver', 'Ver las solicitudes y sus notas.'),
  ('solicitudes.estado', 'Registrar el último contacto con una solicitud.'),
  ('solicitudes.editar_contacto', 'Corregir los datos de contacto de una solicitud.'),
  ('notas.crear', 'Escribir notas en una solicitud.'),
  ('notas.gestionar', 'Editar y borrar las notas de cualquiera.'),
  ('reuniones.ver', 'Ver las reuniones.'),
  ('bloqueos.gestionar', 'Crear y borrar bloqueos de la agenda.'),
  ('prospeccion.gestionar', 'Crear, ver y desactivar enlaces de prospección.'),
  ('metricas.ver', 'Ver las métricas por persona y, con alcance todos, las del equipo.'),
  ('auditoria.ver', 'Ver el historial de cambios.'),
  ('agenda.configurar', 'Ver y configurar el horario común y las reglas de la agenda.'),
  ('equipo.gestionar', 'Editar la sección «Quiénes somos» y subir sus fotos.'),
  ('usuarios.gestionar', 'Ver a las personas del panel e invitarlas.'),
  ('actividad.ver', 'Ver los correos salientes y las tareas programadas.')
on conflict (clave) do update set descripcion = excluded.descripcion;

insert into public.permisos_rol (rol, clave, alcance)
select 'vendedor'::public.rol_usuario, c, 'propio'
  from unnest(array['solicitudes.ver', 'solicitudes.estado', 'notas.crear', 'reuniones.ver', 'bloqueos.gestionar',
    'prospeccion.gestionar', 'metricas.ver', 'auditoria.ver']) c
union all
select 'admin'::public.rol_usuario, clave, 'todos' from public.permisos
on conflict (rol, clave) do update set alcance = excluded.alcance;

-- La clave sin acotar: el usuario existe, está activo y su rol la tiene con alcance «todos». Un «propio» se acota por fila con
-- ids_con_alcance. Las funciones de permisos son `security definer` porque leen perfiles y permisos_rol saltando su RLS (la
-- policy de perfiles se llamaría a sí misma).
create function public.tiene_permiso(p_clave text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.perfiles p
      join public.permisos_rol pr on pr.rol = p.rol
     where p.id = (select auth.uid()) and p.activo and pr.clave = p_clave and pr.alcance = 'todos'
  )
$$;

-- Los dueños que quien pregunta puede tocar con esa clave: él mismo si está activo y su rol la tiene (con cualquier alcance); si
-- no, ninguno. Nunca null ni más de un id: la policy lo usa como `col = any ((select …)::uuid[])` (InitPlan).
create function public.ids_con_alcance(p_clave text)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1
        from public.perfiles p
        join public.permisos_rol pr on pr.rol = p.rol
       where p.id = (select auth.uid()) and p.activo and pr.clave = p_clave
    ) then array[(select auth.uid())]
    else '{}'::uuid[]
  end
$$;

create function public.es_usuario_activo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.perfiles p where p.id = (select auth.uid()) and p.activo)
$$;

create function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.perfiles p where p.id = (select auth.uid()) and p.activo and p.rol = 'admin')
$$;

-- El `puede_*(id)` de las tablas hijas de solicitudes (notas, auditoría): la clave sin acotar, o la solicitud es de quien pregunta.
create function public.puede_en_solicitud(p_solicitud uuid, p_clave text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.tiene_permiso(p_clave)
      or exists (
        select 1 from public.solicitudes s
         where s.id = p_solicitud and s.asignado_a = any (public.ids_con_alcance(p_clave))
      )
$$;

-- Lo que la UI y las actions necesitan para `puede(permisos, clave, alcance)`: sin el rol (la UI no pregunta por rol). Sin sesión
-- o inactivo: `{"activo": false, "permisos": []}`.
create function public.mis_permisos()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'activo', coalesce((select p.activo from public.perfiles p where p.id = (select auth.uid())), false),
    'permisos', coalesce((
      select jsonb_agg(jsonb_build_object('clave', pr.clave, 'alcance', pr.alcance) order by pr.clave collate "C")
        from public.perfiles p
        join public.permisos_rol pr on pr.rol = p.rol
       where p.id = (select auth.uid()) and p.activo
    ), '[]'::jsonb)
  )
$$;

revoke all on function public.tiene_permiso(text), public.ids_con_alcance(text), public.es_usuario_activo(), public.es_admin(),
  public.puede_en_solicitud(uuid, text), public.mis_permisos() from public, anon;
grant execute on function public.tiene_permiso(text), public.ids_con_alcance(text), public.es_usuario_activo(), public.es_admin(),
  public.puede_en_solicitud(uuid, text), public.mis_permisos() to authenticated, service_role;
