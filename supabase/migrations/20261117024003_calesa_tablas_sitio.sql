-- Calesa · las tablas del sitio y del sistema (semilla §3): enlaces de prospección, equipo, config_calculadora, eventos, métricas,
-- latidos, auditoría, correos salientes y límites. Igual que `calesa_tablas_panel`: RLS encendida y nada para `anon` ni
-- `authenticated` hasta `calesa_rls`. Sin FK en las que tienen que sobrevivir a un borrado (eventos, auditoría, métricas por
-- persona, correos salientes).

create table public.enlaces_prospeccion (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (codigo ~ '^[A-Z0-9-]{2,20}$'),
  -- El nombre de la importadora prospecto.
  etiqueta text check (char_length(etiqueta) <= 80),
  creado_por uuid not null references public.perfiles (id),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- La sección pública «Quiénes somos» (E6). `foto_ruta` es la ruta en el bucket `equipo`.
create table public.equipo (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(nombre) between 2 and 80),
  cargo text not null check (char_length(cargo) between 2 and 80),
  frase text check (char_length(frase) <= 400),
  foto_ruta text check (char_length(foto_ruta) between 1 and 200),
  orden int not null default 0,
  visible boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- Una sola fila (`id = 1`); los defaults son los valores iniciales de la Radiografía (B4, B4.1). Se escribe sólo por RPC (P05).
create table public.config_calculadora (
  id smallint primary key default 1 check (id = 1),
  precio int not null default 18000 check (precio between 3000 and 150000),
  pct_sena int not null default 60 check (pct_sena between 0 and 100),
  sena int not null default 2000 check (sena between 0 and 30000),
  moneda_local boolean not null default true,
  pct_local int not null default 40 check (pct_local between 0 and 100),
  volatilidad public.volatilidad not null default 'media',
  sueldo int not null default 700 check (sueldo between 200 and 5000),
  tasa int not null default 15 check (tasa between 0 and 40),
  -- 4 + 8 + 10 + 30 + 7 + 4 + 8 + 5: las 8 fases de la Radiografía.
  ciclo_dias int not null default 76 check (ciclo_dias between 20 and 240),
  actualizado_por uuid references public.perfiles (id),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- Sin datos personales (X7).
create table public.eventos (
  id bigint generated always as identity primary key,
  tipo public.tipo_evento not null,
  pagina text check (char_length(pagina) <= 200),
  utm_source text check (char_length(utm_source) <= 100),
  utm_medium text check (char_length(utm_medium) <= 100),
  utm_campaign text check (char_length(utm_campaign) <= 100),
  utm_term text check (char_length(utm_term) <= 100),
  utm_content text check (char_length(utm_content) <= 100),
  -- El vendedor elegido en `clic_whatsapp`.
  perfil_id uuid,
  solicitud_id uuid,
  creado_en timestamptz not null default now()
);

-- Un día por fila, en la zona America/La_Paz. La actualizan triggers (P05).
create table public.metricas_diarias (
  dia date primary key,
  solicitudes int not null default 0,
  reuniones_reservadas int not null default 0,
  reuniones_realizadas int not null default 0,
  ganadas int not null default 0,
  clics_whatsapp int not null default 0,
  calculadoras int not null default 0,
  creado_en timestamptz not null default now()
);

-- R4.4: lo que cada persona ve de sí misma.
create table public.metricas_persona (
  dia date not null,
  perfil_id uuid not null,
  solicitudes_asignadas int not null default 0,
  reuniones_reservadas int not null default 0,
  reuniones_realizadas int not null default 0,
  ganadas int not null default 0,
  creado_en timestamptz not null default now(),
  primary key (dia, perfil_id)
);

-- R4.22: el último resultado de cada tarea programada.
create table public.latidos (
  tarea text primary key check (char_length(tarea) between 1 and 40),
  ultimo_ok timestamptz,
  ultimo_error text,
  fallos_seguidos int not null default 0,
  creado_en timestamptz not null default now()
);

-- La escriben triggers (P05). Sin datos de contacto en `antes`/`despues` de un borrado: sólo el id.
create table public.auditoria (
  id bigint generated always as identity primary key,
  -- null = visitante o sistema.
  actor_id uuid,
  accion text not null check (accion in ('estado', 'asignacion', 'reagenda', 'cancelacion', 'borrado', 'rol', 'activo', 'config')),
  tabla text not null check (char_length(tabla) between 1 and 63),
  registro_id uuid not null,
  antes jsonb,
  despues jsonb,
  creado_en timestamptz not null default now()
);

-- El registro de correos (X6). `referencia` es la clave de idempotencia (p. ej. `recordatorio24:<reunion_id>`).
create table public.correos_salientes (
  id uuid primary key default gen_random_uuid(),
  para extensions.citext not null,
  plantilla text not null check (char_length(plantilla) between 1 and 80),
  datos jsonb not null default '{}'::jsonb,
  adjunto_ics text,
  estado public.estado_correo not null,
  resend_id text,
  programado_para timestamptz,
  intentos int not null default 0,
  ultimo_error text,
  enviado_en timestamptz,
  referencia text unique,
  reunion_id uuid,
  solicitud_id uuid,
  creado_en timestamptz not null default now()
);

-- El límite de envíos: `<accion>:<sha256(ip + IP_SAL_SECRETO)>`. Sólo `service_role`.
create table public.limites (
  clave text primary key check (char_length(clave) between 1 and 200),
  ventana_inicio timestamptz not null default now(),
  conteo int not null default 0,
  creado_en timestamptz not null default now()
);

create index enlaces_prospeccion_creado_por on public.enlaces_prospeccion (creado_por, creado_en desc, id desc); -- policy y lista
create index equipo_visibles on public.equipo (orden, id) where visible; -- la sección pública (policy por `visible`)
create index config_calculadora_actualizado_por on public.config_calculadora (actualizado_por); -- FK
create index eventos_tipo on public.eventos (tipo, perfil_id, creado_en desc); -- §3: clics por vendedor
create index eventos_listado on public.eventos (creado_en desc, id desc); -- §3: listado y retención
create index metricas_persona_perfil on public.metricas_persona (perfil_id, dia desc); -- policy y métricas propias (R4.4)
create index auditoria_listado on public.auditoria (creado_en desc, id desc); -- §3
create index auditoria_registro on public.auditoria (registro_id); -- §3; policy por registro
create index correos_salientes_reunion on public.correos_salientes (reunion_id) where estado = 'programado'; -- §3
create index correos_salientes_solicitud on public.correos_salientes (solicitud_id) where estado = 'programado'; -- §3
create index correos_salientes_fallidos on public.correos_salientes (estado) where estado = 'fallido'; -- §3
create index correos_salientes_listado on public.correos_salientes (creado_en desc, id desc); -- lista del admin

create trigger tocar_actualizado_en before update on public.enlaces_prospeccion
  for each row execute function public._tocar_actualizado_en();
create trigger tocar_actualizado_en before update on public.equipo
  for each row execute function public._tocar_actualizado_en();
create trigger tocar_actualizado_en before update on public.config_calculadora
  for each row execute function public._tocar_actualizado_en();

alter table public.enlaces_prospeccion enable row level security;
alter table public.equipo enable row level security;
alter table public.config_calculadora enable row level security;
alter table public.eventos enable row level security;
alter table public.metricas_diarias enable row level security;
alter table public.metricas_persona enable row level security;
alter table public.latidos enable row level security;
alter table public.auditoria enable row level security;
alter table public.correos_salientes enable row level security;
alter table public.limites enable row level security;
revoke all on public.enlaces_prospeccion, public.equipo, public.config_calculadora, public.eventos, public.metricas_diarias,
  public.metricas_persona, public.latidos, public.auditoria, public.correos_salientes, public.limites from anon, authenticated;
revoke all on sequence public.eventos_id_seq, public.auditoria_id_seq from anon, authenticated;

-- La fila inicial (P5 de P02): la nube no corre el seed y la calculadora la lee. Nunca pisa lo que guardó el admin.
insert into public.config_calculadora (id) values (1) on conflict (id) do nothing;
