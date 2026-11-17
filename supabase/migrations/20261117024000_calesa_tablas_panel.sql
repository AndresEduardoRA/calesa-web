-- Calesa · las tablas del panel (semilla §3): perfiles, invitaciones, la agenda (config_agenda, horario_base, bloqueos),
-- solicitudes, reuniones y notas, con sus enums, índices, exclusiones y `actualizado_en`. Nacen con RLS y sin acceso para `anon` ni
-- `authenticated`: los grants y las policies van en `calesa_rls` (paso P02). Cada `create extension` va en una línea: el runner de
-- PGlite (scripts/probar-schema.mjs) las quita y pone las suyas.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;
create extension if not exists btree_gist with schema extensions;

-- Enums de §3 (X4: `ganada` en estado_solicitud).
create type public.rol_usuario as enum ('admin', 'vendedor');
create type public.estado_solicitud as enum ('nueva', 'agendada', 'realizada', 'no_asistio', 'ganada', 'descartada');
create type public.origen_solicitud as enum ('formulario', 'calculadora', 'prospeccion');
create type public.estado_reunion as enum ('confirmada', 'cancelada', 'realizada', 'no_asistio');
create type public.tiempo_respuesta as enum ('h1', 'h4', 'dia', 'sig');
create type public.volatilidad as enum ('baja', 'media', 'alta');
create type public.tipo_evento as enum ('clic_agendar', 'clic_whatsapp', 'calculadora_usada', 'detalle_calculadora',
  'formulario_enviado', 'reunion_reservada', 'reunion_cambiada', 'reunion_cancelada');
create type public.estado_correo as enum ('enviado', 'programado', 'cancelado', 'fallido');

-- Suma minutos a una hora. `timestamptz + interval` es STABLE (con días o meses depende de la zona) y una exclusión exige
-- expresiones IMMUTABLE; con sólo minutos el resultado no depende de la zona. Es la exclusión de reuniones de §3 con el mismo
-- significado (decisiones de P02).
create function public._mas_minutos(p_t timestamptz, p_min int)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select p_t + make_interval(mins => p_min)
$$;

revoke all on function public._mas_minutos(timestamptz, int) from public, anon;
grant execute on function public._mas_minutos(timestamptz, int) to authenticated, service_role;

-- `actualizado_en` de las tablas editables: se mueve aunque se edite dos veces en la misma transacción (las RPC de edición lo usan
-- como `p_actualizado_en_esperado`).
create function public._tocar_actualizado_en()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_en := greatest(clock_timestamp(), old.actualizado_en + interval '1 microsecond');
  return new;
end;
$$;

revoke all on function public._tocar_actualizado_en() from public, anon, authenticated;

-- Un registro por usuario del panel (B19, X12). El rol, `activo` y `en_turno` no se cambian directo (calesa_columnas_protegidas).
create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null check (char_length(nombre) between 2 and 80),
  email extensions.citext not null unique check (email::text ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  rol public.rol_usuario not null default 'vendedor',
  whatsapp text check (whatsapp ~ '^\+[1-9]\d{7,14}$'),
  enlace_meet text check (enlace_meet ~ '^https://(meet\.google\.com/|([a-z0-9-]+\.)*zoom\.us/)'),
  activo boolean not null default true,
  en_turno boolean not null default false,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint perfiles_en_turno_con_contacto check (not en_turno or (whatsapp is not null and enlace_meet is not null))
);

-- Sólo entra quien fue invitado (F5).
create table public.invitaciones (
  id uuid primary key default gen_random_uuid(),
  email extensions.citext not null check (email::text ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aceptada', 'revocada')),
  invitado_por uuid not null references public.perfiles (id),
  expira_en timestamptz not null default now() + interval '7 days',
  aceptada_en timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- Una sola fila (`id = 1`); los defaults son los valores iniciales de §3 (B10, B11, B12, B15, X10).
create table public.config_agenda (
  id smallint primary key default 1 check (id = 1),
  duracion_min int not null default 30 check (duracion_min between 15 and 120),
  descanso_min int not null default 15 check (descanso_min between 0 and 60),
  anticipacion_min_horas int not null default 12 check (anticipacion_min_horas between 0 and 168),
  horizonte_dias int not null default 21 check (horizonte_dias between 1 and 60),
  max_reuniones_dia int not null default 4 check (max_reuniones_dia between 1 and 12),
  cancelar_hasta_horas int not null default 2 check (cancelar_hasta_horas between 0 and 48),
  zona_horaria text not null default 'America/La_Paz' check (char_length(zona_horaria) between 1 and 64),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- El horario común (R1.2), sin solapes el mismo día. El rango usa una fecha fija: sin un tipo de rango propio, cuyas funciones
-- nacerían con EXECUTE para PUBLIC.
create table public.horario_base (
  id uuid primary key default gen_random_uuid(),
  dia_semana smallint not null check (dia_semana between 1 and 7),
  desde time not null,
  hasta time not null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint horario_base_desde_antes_de_hasta check (desde < hasta),
  constraint horario_base_sin_solapes exclude using gist (
    dia_semana with =,
    tsrange(date '2000-01-03' + desde, date '2000-01-03' + hasta) with &&
  )
);

create table public.bloqueos (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfiles (id),
  inicio timestamptz not null,
  fin timestamptz not null,
  motivo text check (char_length(motivo) <= 120),
  creado_por uuid not null references public.perfiles (id),
  creado_en timestamptz not null default now(),
  constraint bloqueos_rango_valido check (fin > inicio and fin - inicio <= interval '31 days')
);

-- Lo que llega del formulario, la calculadora o un enlace de prospección (C1). Sin FK en `ref_codigo` (lógica).
create table public.solicitudes (
  id uuid primary key default gen_random_uuid(),
  origen public.origen_solicitud not null,
  nombre text not null check (char_length(nombre) between 2 and 80),
  email extensions.citext not null check (email::text ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  importadora text check (char_length(importadora) between 2 and 120),
  pais text check (pais in ('AR', 'BO', 'CL', 'CO', 'CR', 'EC', 'SV', 'GT', 'HN', 'MX', 'NI', 'PA', 'PY', 'PE', 'PR', 'DO', 'UY',
    'VE', 'US', 'XX')),
  whatsapp text check (whatsapp ~ '^\+[1-9]\d{7,14}$'),
  autos_hoy int check (autos_hoy between 1 and 2000),
  autos_meta int check (autos_meta <= 5000 and autos_meta >= autos_hoy),
  vendedores int check (vendedores between 1 and 500),
  administracion int check (administracion between 1 and 500),
  origenes text[] not null default '{}' check (origenes <@ array['copart', 'iaai', 'manheim', 'japon', 'corea', 'china']),
  calc_margen int check (calc_margen between 100 and 30000),
  calc_consultas int check (calc_consultas between 10 and 5000),
  calc_respuesta public.tiempo_respuesta,
  consentimiento_en timestamptz not null,
  ref_codigo text check (char_length(ref_codigo) between 2 and 20),
  utm_source text check (char_length(utm_source) <= 100),
  utm_medium text check (char_length(utm_medium) <= 100),
  utm_campaign text check (char_length(utm_campaign) <= 100),
  utm_term text check (char_length(utm_term) <= 100),
  utm_content text check (char_length(utm_content) <= 100),
  pagina_origen text check (char_length(pagina_origen) <= 200),
  asignado_a uuid references public.perfiles (id),
  estado public.estado_solicitud not null default 'nueva',
  aviso_sin_reunion_en timestamptz,
  ultimo_contacto_en timestamptz not null default now(),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint solicitudes_obligatorios_fuera_de_calculadora check (
    origen = 'calculadora'
    or (importadora is not null and pais is not null and whatsapp is not null and autos_hoy is not null)
  ),
  -- R4.18: la calculadora acepta hasta 400 autos y 80 personas de administración.
  constraint solicitudes_rangos_de_calculadora check (
    origen <> 'calculadora' or (coalesce(autos_hoy, 1) <= 400 and coalesce(administracion, 1) <= 80)
  ),
  constraint solicitudes_calc_margen_solo_calculadora check (calc_margen is null or origen = 'calculadora')
);

create table public.reuniones (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references public.solicitudes (id) on delete cascade,
  anfitrion_id uuid not null references public.perfiles (id),
  inicio timestamptz not null,
  fin timestamptz not null,
  zona_visitante text not null check (char_length(zona_visitante) between 1 and 64),
  enlace_meet text not null check (enlace_meet ~ '^https://(meet\.google\.com/|([a-z0-9-]+\.)*zoom\.us/)'),
  estado public.estado_reunion not null default 'confirmada',
  -- sha256 del token de gestión: no lo lee nadie del panel (calesa_rls).
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  secuencia_ics int not null default 0,
  recordatorio_24_en timestamptz,
  recordatorio_1_en timestamptz,
  cancelada_en timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint reuniones_fin_despues_de_inicio check (fin > inicio),
  -- 15 = el descanso de B12; si el admin cambia `descanso_min`, la función de reserva valida además con el vigente.
  constraint reuniones_sin_solapes exclude using gist (
    anfitrion_id with =,
    tstzrange(inicio, public._mas_minutos(fin, 15)) with &&
  ) where (estado = 'confirmada')
);

create table public.notas (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references public.solicitudes (id) on delete cascade,
  autor_id uuid not null references public.perfiles (id),
  texto text not null check (char_length(texto) between 1 and 2000),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- Índices de §3 y los del kit (toda FK y toda columna de una policy). Los listados van por cursor `(creado_en desc, id desc)`.
create index perfiles_listado on public.perfiles (creado_en desc, id desc); -- lista de usuarios del panel
create unique index invitaciones_email_pendiente on public.invitaciones (email) where estado = 'pendiente'; -- §3: único entre pendientes
create index invitaciones_invitado_por on public.invitaciones (invitado_por); -- FK
create index bloqueos_perfil_rango on public.bloqueos using gist (perfil_id, tstzrange(inicio, fin)); -- §3; policy por perfil_id
create index bloqueos_creado_por on public.bloqueos (creado_por); -- FK
create index solicitudes_asignado on public.solicitudes (asignado_a, creado_en desc, id desc); -- policy y lista del vendedor
create index solicitudes_estado on public.solicitudes (estado, creado_en desc, id desc); -- lista filtrada por estado
create index solicitudes_listado on public.solicitudes (creado_en desc, id desc); -- lista del admin
create index solicitudes_retencion on public.solicitudes (ultimo_contacto_en); -- borrado a los 24 meses (C2)
create index solicitudes_email on public.solicitudes (email); -- búsqueda por email (C3) y juntar solicitudes
create index reuniones_anfitrion on public.reuniones (anfitrion_id, inicio); -- policy y agenda de cada persona
create index reuniones_confirmadas on public.reuniones (inicio) where estado = 'confirmada'; -- recordatorios
create index reuniones_solicitud on public.reuniones (solicitud_id); -- FK
create unique index reuniones_una_confirmada on public.reuniones (solicitud_id) where estado = 'confirmada'; -- R4.15
create index notas_solicitud on public.notas (solicitud_id, creado_en desc, id desc); -- notas de una solicitud, por cursor
create index notas_autor on public.notas (autor_id); -- FK

-- `actualizado_en` en las editables.
create trigger tocar_actualizado_en before update on public.perfiles
  for each row execute function public._tocar_actualizado_en();
create trigger tocar_actualizado_en before update on public.invitaciones
  for each row execute function public._tocar_actualizado_en();
create trigger tocar_actualizado_en before update on public.config_agenda
  for each row execute function public._tocar_actualizado_en();
create trigger tocar_actualizado_en before update on public.horario_base
  for each row execute function public._tocar_actualizado_en();
create trigger tocar_actualizado_en before update on public.solicitudes
  for each row execute function public._tocar_actualizado_en();
create trigger tocar_actualizado_en before update on public.reuniones
  for each row execute function public._tocar_actualizado_en();
create trigger tocar_actualizado_en before update on public.notas
  for each row execute function public._tocar_actualizado_en();

-- RLS encendida y nada para `anon` ni `authenticated` hasta `calesa_rls`.
alter table public.perfiles enable row level security;
alter table public.invitaciones enable row level security;
alter table public.config_agenda enable row level security;
alter table public.horario_base enable row level security;
alter table public.bloqueos enable row level security;
alter table public.solicitudes enable row level security;
alter table public.reuniones enable row level security;
alter table public.notas enable row level security;
revoke all on public.perfiles, public.invitaciones, public.config_agenda, public.horario_base, public.bloqueos,
  public.solicitudes, public.reuniones, public.notas from anon, authenticated;

-- Las filas iniciales (P5 de P02): la nube no corre el seed, y las RPC esperan la fila `id = 1`. Nunca pisan lo que guardó el admin.
insert into public.config_agenda (id) values (1) on conflict (id) do nothing;
-- B11: lunes a viernes 09:00–12:00 y 14:00–18:00 (America/La_Paz, la zona de config_agenda).
insert into public.horario_base (dia_semana, desde, hasta)
select d, t.desde, t.hasta
  from generate_series(1, 5) d,
       (values (time '09:00', time '12:00'), (time '14:00', time '18:00')) t (desde, hasta)
 where not exists (select 1 from public.horario_base);
