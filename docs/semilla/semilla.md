---
esquema: semilla/v1
nombre: Calesa · web de marketing
slug: calesa-web
descripcion: Web de marketing de Calesa con calculadora, agenda propia de demos por turnos y panel interno para el equipo de ventas
carriles_max: 3
version: 7
tamano: mediano
tipo: sitio de marketing con agenda propia y panel interno
plataforma: web (celular primero, escritorio igual de cuidado)
arquitectura: monolito modular del kit de semilla-a-repo (Next.js App Router, src/modules + src/shared) con Supabase (Postgres + Auth + Storage), desplegado en Vercel Pro (un solo cron diario; correos programados en Resend)
stack:
  verificado_el: 2026-10-31 (package.json del kit y npm registry)
  base: el kit de semilla-a-repo fija las versiones de su package.json (Next 16.4.3, React 19.3, TypeScript 6, Tailwind 4, Zod 4, @supabase/ssr 0.12, next-safe-action 8, next-themes, nuqs, sonner, shadcn, Vitest 4, Playwright 1.64)
  node: "24 (.nvmrc del kit)"
  pnpm: "11.11.0 (packageManager del kit)"
  agregados:
    resend: "6.37.0"
    react-email: "6.11.6"
    "@react-email/components": "1.0.12"
    ics: "3.12.1"
    "@marsidev/react-turnstile": "1.6.3"
    "@vercel/analytics": "2.0.1"
  ya_en_el_kit: [date-fns, date-fns-tz, lucide-react, tw-animate-css]
servicios: [Vercel Pro, Supabase (gratis), Resend (gratis), Cloudflare Turnstile (gratis), Vercel Web Analytics, GitHub Actions (respaldos)]
compuertas_rojas:
  - guardas del piloto (modelo, effort, carpeta)
  - migraciones y cambios de esquema
  - políticas RLS, roles y acceso al panel
  - datos personales (formulario, retención, borrado)
  - fórmulas y textos con cifras de dinero (calculadora, gráfica, precios)
  - textos con datos del cliente real
  - textos legales (privacidad, términos, pie legal)
  - código compartido (base, layout, tokens, seguridad)
  - despliegue a producción y DNS
  - pasar el tope de cuota
agentes: [claude]
tope_cuota: {ventana_5h_pct: 40, semanal_pct: 20}
piloto_auto_min: 5
generada_con: {modelo: Opus 5.5, effort: high, confirmado_por: dueño}
---

# Calesa · web de marketing — semilla v7

## 1. Visión y alcance

**Qué es.** La web pública de Calesa en `calesa.app`: explica a dueños de importadoras de autos de Hispanoamérica qué resuelve Calesa, les muestra cuánto dinero se les escapa hoy, y los lleva a **agendar una demo de 30 minutos** con un vendedor de Calesa, en una agenda propia al estilo Calendly. Incluye un panel privado en `calesa.app/panel` para el dueño (admin) y sus vendedores. (A0.1, A1, A0.4)

**Para quién.**
- Visitante: dueño o socio de una importadora que compra en Copart, IAAI, Manheim, Japón, Corea o China y vende por redes y WhatsApp. Llega desde videos (TikTok, Reels, Shorts, LinkedIn) o desde un enlace de prospección. (A4, A5)
- Admin: Andrés Eduardo Rosas Alpiri, fundador. Único admin. (A6, X12)
- Vendedor: personas invitadas por el admin que atienden las demos. (B19, R1.4)

**Cómo se mide el éxito.** 15 solicitudes al mes → 10 reuniones al mes → al menos 2 ventas en los primeros 3 meses. El panel muestra ese embudo por mes. (A3, X4)

**Primera versión (v1).**
1. Inicio de una página larga con 10 secciones (B2), y páginas aparte: `/planes`, `/agendar`, `/privacidad`, `/terminos`. (B1)
2. Calculadora «Lo que se te escapa al mes» de 5 datos. (B4, B4.3)
3. Formulario de demo con gráfica «Crecer sin contratar». (B8)
4. Agenda propia: horas libres del equipo, reparto parejo entre vendedores, enlace de Meet fijo por vendedor, correo de confirmación con .ics, recordatorios 24 h y 1 h, cambiar o cancelar hasta 2 h antes. (B10–B16, R1.2, B13)
5. Botón de WhatsApp que abre el WhatsApp del vendedor de turno. (D3, R3.1)
6. Panel: solicitudes y reuniones con estados, notas e historial; embudo del equipo (admin) y propio (vendedor, R4.4); horario común; bloqueos por persona; equipo editable; datos de la calculadora; enlaces de prospección; usuarios por invitación. (B18, B4.1, A4, E6, R2.4)
7. Medición propia de eventos y UTM. (F8, X7)

**Fuera de alcance de la v1.** Integración con Google Calendar (Meet único por reunión, ocultar horas ocupadas, verificación de Google) → v2 (R2.5). Blog, otros idiomas, testimonios inventados, contadores de cupos no reales, enlace a la app de Calesa (A0.5, B20). Recordatorios por WhatsApp (B16). Exportar a CSV desde el panel (B18). Gestor de contenido: los textos viven en el repositorio (F3).

## 2. Roles y permisos

Roles fijos: `visitante` (sin sesión), `vendedor`, `admin`. Un usuario con `activo = false` no puede hacer nada en el panel. (B19, F5, R1.4, X12)

En código, los permisos siguen el patrón del kit (X17): un catálogo de claves con alcance, `puede(permisos, clave, alcance)` en la UI y en la action, y la base que vuelve a verificar. Catálogo (`permisos_rol`):

| Clave | Vendedor | Admin |
|---|---|---|
| `solicitudes.ver`, `solicitudes.estado`, `notas.crear` | propio | todos |
| `solicitudes.reasignar`, `solicitudes.borrar`, `solicitudes.editar_contacto` | — | todos |
| `reuniones.ver`, `reuniones.cambiar` | propio | todos |
| `bloqueos.gestionar` | propio | todos |
| `prospeccion.gestionar` | propio | todos |
| `metricas.ver` | propio | todos |
| `auditoria.ver` | propio (de sus solicitudes) | todos |
| `agenda.configurar`, `calculadora.configurar`, `equipo.gestionar`, `usuarios.gestionar`, `actividad.ver` | — | todos |

«propio» = filas con `asignado_a`, `anfitrion_id`, `perfil_id` o `creado_por` igual a quien pregunta.

| Recurso | Acción | Visitante | Vendedor | Admin |
|---|---|---|---|---|
| Páginas públicas, calculadora | ver / usar | sí | sí | sí |
| Solicitud | crear | sí (por el servidor, con Turnstile y límite) | no | no |
| Solicitud | ver | no | solo `asignado_a = él` | todas |
| Solicitud | cambiar estado, `ultimo_contacto_en` | no | solo las suyas | todas |
| Solicitud | reasignar, editar datos de contacto | no | no | sí |
| Solicitud | borrar (pedido de privacidad) | no | no | sí |
| Nota | crear | no | en sus solicitudes | en todas |
| Nota | ver | no | de sus solicitudes | todas |
| Nota | editar / borrar | no | no | sí |
| Reunión | reservar | sí (con token de su solicitud o de su reunión) | no | no |
| Reunión | cambiar / cancelar | sí, con su enlace, hasta 2 h antes | las suyas, sin límite de 2 h; al cambiar sigue de anfitrión y solo ve sus horas libres (R4.1) | todas |
| Reunión | ver | no | solo `anfitrion_id = él` | todas |
| Reunión | marcar realizada / no asistió | no | las suyas, cambiando el estado de la solicitud (§5.7, R4.7) | todas |
| Perfil propio | editar nombre, WhatsApp, enlace de Meet | — | sí | sí |
| Perfil | cambiar rol, activo, en turno | no | no | sí (no puede desactivarse a sí mismo) |
| Bloqueos | crear / borrar | no | solo los suyos | de cualquiera |
| Horario común y reglas de agenda | editar | no | no | sí |
| Datos de la calculadora | ver | sí (los usa la calculadora) | sí | sí |
| Datos de la calculadora | editar | no | no | sí |
| Equipo (sección pública) | ver visibles | sí | sí | sí |
| Equipo | crear / editar / borrar / subir foto | no | no | sí |
| Enlace de prospección | crear / desactivar | no | los suyos | todos |
| Enlace de prospección | ver | no | los suyos | todos |
| Invitaciones | crear / revocar | no | no | sí |
| Historial (auditoría) | ver | no | de sus solicitudes (R4.4) | todo |
| Métricas por persona | ver | no | las suyas (R4.4) | todas |
| Eventos y métricas del equipo | ver | no | no | sí |
| Eventos de clic | registrar | sí (por el servidor, con límite) | sí | sí |
| Correos salientes | ver | no | no | sí |

## 3. Datos

Base: Postgres de Supabase, proyecto **nuevo** solo para la web; uno de pruebas y uno de producción (F2, F9). Todas las horas en `timestamptz` (UTC); el horario de la agenda se define en `America/La_Paz`. Identificadores `uuid` con `gen_random_uuid()`. Toda tabla tiene `creado_en timestamptz not null default now()`; las editables tienen `actualizado_en` con trigger.

Extensiones: `pgcrypto`, `citext`, `btree_gist`.

### Tipos enumerados

- `rol_usuario`: `admin`, `vendedor`
- `estado_solicitud`: `nueva`, `agendada`, `realizada`, `no_asistio`, `ganada`, `descartada` (X4)
- `origen_solicitud`: `formulario`, `calculadora`, `prospeccion`
- `estado_reunion`: `confirmada`, `cancelada`, `realizada`, `no_asistio`
- `tiempo_respuesta`: `h1` (menos de 1 hora), `h4` (1 a 4 horas), `dia` (el mismo día), `sig` (al día siguiente o más)
- `volatilidad`: `baja`, `media`, `alta`
- `tipo_evento`: `clic_agendar`, `clic_whatsapp`, `calculadora_usada`, `detalle_calculadora`, `formulario_enviado`, `reunion_reservada`, `reunion_cambiada`, `reunion_cancelada`
- `estado_correo`: `enviado`, `programado`, `cancelado`, `fallido`

### Tablas

**perfiles** — un registro por usuario del panel; `id` = `auth.users.id`.
| Campo | Tipo | Regla |
|---|---|---|
| id | uuid PK, FK auth.users on delete cascade | |
| nombre | text not null | 2–80 caracteres |
| email | citext not null unique | email válido |
| rol | rol_usuario not null default `vendedor` | solo el admin lo cambia (trigger) |
| whatsapp | text null | E.164: `^\+[1-9]\d{7,14}$` |
| enlace_meet | text null | URL `https://meet.google.com/…` o `https://…zoom.us/…` |
| activo | boolean not null default true | |
| en_turno | boolean not null default false | solo `true` si `whatsapp` y `enlace_meet` no son nulos (check) |
| actualizado_en | timestamptz | |

**invitaciones**
| Campo | Tipo | Regla |
|---|---|---|
| id | uuid PK | |
| email | citext not null | único entre invitaciones `pendiente` |
| estado | text not null check in (`pendiente`,`aceptada`,`revocada`) | |
| invitado_por | uuid FK perfiles not null | |
| expira_en | timestamptz not null | creado_en + 7 días |
| aceptada_en | timestamptz null | |

**config_agenda** — una sola fila (`id = 1`, check).
| Campo | Tipo | Valor inicial |
|---|---|---|
| duracion_min | int 15–120 | 30 (B10) |
| descanso_min | int 0–60 | 15 (B12) |
| anticipacion_min_horas | int 0–168 | 12 (B12) |
| horizonte_dias | int 1–60 | 21 (B12) |
| max_reuniones_dia | int 1–12 | 4 por persona (X10) |
| cancelar_hasta_horas | int 0–48 | 2 (B15) |
| zona_horaria | text | `America/La_Paz` (B11) |

**horario_base** — horario común (R1.2).
| Campo | Tipo | Regla |
|---|---|---|
| id | uuid PK | |
| dia_semana | smallint 1–7 (1 = lunes, ISO) | |
| desde | time | `desde < hasta` |
| hasta | time | sin solapes en el mismo día (exclusión) |
Inicial: lunes a viernes 09:00–12:00 y 14:00–18:00 (B11).

**bloqueos**
| Campo | Tipo | Regla |
|---|---|---|
| id | uuid PK | |
| perfil_id | uuid FK perfiles not null | |
| inicio, fin | timestamptz not null | `fin > inicio`, máximo 31 días |
| motivo | text null | ≤ 120 caracteres |
| creado_por | uuid FK perfiles not null | |

**solicitudes**
| Campo | Tipo | Regla |
|---|---|---|
| id | uuid PK | |
| origen | origen_solicitud not null | |
| nombre | text not null | 2–80 |
| email | citext not null | email válido |
| importadora | text null | 2–120; obligatorio si origen ≠ `calculadora` |
| pais | text null | código de la lista de §6.6; obligatorio si origen ≠ `calculadora` |
| whatsapp | text null | E.164; obligatorio si origen ≠ `calculadora` |
| autos_hoy | int null | 1–2000 (1–400 si origen `calculadora`, R4.18); obligatorio si origen ≠ `calculadora` |
| autos_meta | int null | `autos_meta >= autos_hoy`, ≤ 5000 (B8.1) |
| vendedores | int null | 1–500 |
| administracion | int null | 1–500 (1–80 si origen `calculadora`) |
| origenes | text[] not null default `{}` | subconjunto de `copart, iaai, manheim, japon, corea, china` |
| calc_margen | int null | 100–30000 (solo origen `calculadora`) |
| calc_consultas | int null | 10–5000 |
| calc_respuesta | tiempo_respuesta null | |
| consentimiento_en | timestamptz not null | se guarda la hora en que marcó la casilla (C4) |
| ref_codigo | text null | FK lógica a enlaces_prospeccion.codigo |
| utm_source, utm_medium, utm_campaign, utm_term, utm_content | text null | ≤ 100 cada uno |
| pagina_origen | text null | ruta, ≤ 200 |
| asignado_a | uuid FK perfiles null | null solo si no hay nadie activo; el admin la ve igual |
| estado | estado_solicitud not null default `nueva` | |
| aviso_sin_reunion_en | timestamptz null | X5 |
| ultimo_contacto_en | timestamptz not null default now() | base de la retención (C2) |
| actualizado_en | timestamptz | |

**reuniones**
| Campo | Tipo | Regla |
|---|---|---|
| id | uuid PK | |
| solicitud_id | uuid FK solicitudes on delete cascade not null | |
| anfitrion_id | uuid FK perfiles not null | |
| inicio, fin | timestamptz not null | `fin = inicio + duracion_min` al reservar |
| zona_visitante | text not null | zona IANA de la lista de §6.6 |
| enlace_meet | text not null | copia del enlace del anfitrión al reservar |
| estado | estado_reunion not null default `confirmada` | |
| token_hash | bytea not null unique | sha256 del token de gestión (32 bytes aleatorios) |
| secuencia_ics | int not null default 0 | +1 en cada cambio |
| recordatorio_24_en, recordatorio_1_en | timestamptz null | |
| cancelada_en | timestamptz null | |
| actualizado_en | timestamptz | |
Restricción de exclusión: `exclude using gist (anfitrion_id with =, tstzrange(inicio, fin + make_interval(mins => 15)) with &&) where (estado = 'confirmada')`. El 15 es el descanso (B12); si el admin cambia `descanso_min`, la migración no cambia: la función de reserva valida además con el valor vigente. Índice único parcial `reuniones(solicitud_id) where estado = 'confirmada'` (una reunión confirmada por solicitud, R4.15). Invariante: en toda reunión confirmada `anfitrion_id = solicitudes.asignado_a` (R4.8).

**notas**: `id`, `solicitud_id` FK on delete cascade, `autor_id` FK perfiles, `texto` text 1–2000.

**enlaces_prospeccion**: `id`, `codigo` text unique `^[A-Z0-9-]{2,20}$`, `etiqueta` text ≤ 80 (nombre de la importadora prospecto), `creado_por` FK perfiles, `activo` bool default true.

**equipo** (sección pública «Quiénes somos»): `id`, `nombre` 2–80, `cargo` 2–80, `frase` text ≤ 400 null, `foto_ruta` text null (ruta en el bucket `equipo`), `orden` int, `visible` bool default true, `actualizado_en`. Fila inicial: Andrés Eduardo Rosas Alpiri · «Desarrollador y fundador de Calesa» · frase de A6 · orden 1.

**config_calculadora** — una sola fila (`id = 1`). Valores iniciales de la Radiografía (B4, B4.1):
| Campo | Tipo y rango | Inicial |
|---|---|---|
| precio | int 3000–150000 (US$) | 18000 |
| pct_sena | int 0–100 | 60 |
| sena | int 0–30000 (US$) | 2000 |
| moneda_local | boolean | true |
| pct_local | int 0–100 | 40 |
| volatilidad | volatilidad | `media` |
| sueldo | int 200–5000 (US$/persona/mes) | 700 |
| tasa | int 0–40 (% anual) | 15 |
| ciclo_dias | int 20–240 | 76 (suma de las 8 fases de la Radiografía: 4+8+10+30+7+4+8+5) |
| actualizado_por | uuid FK perfiles null | |

**eventos** (sin datos personales; X7): `id` bigint identity, `tipo` tipo_evento, `pagina` text ≤ 200, `utm_source`…`utm_content`, `perfil_id` uuid null (vendedor elegido en `clic_whatsapp`), `solicitud_id` uuid null, `creado_en`.

**metricas_diarias**: `dia` date PK (zona `America/La_Paz`), `solicitudes`, `reuniones_reservadas`, `reuniones_realizadas`, `ganadas`, `clics_whatsapp`, `calculadoras` (int, default 0). La actualizan triggers de solicitudes, reuniones y eventos.

**metricas_persona** (R4.4): PK `(dia, perfil_id)`, `solicitudes_asignadas`, `reuniones_reservadas`, `reuniones_realizadas`, `ganadas` (int, default 0). Triggers de solicitudes y reuniones; una reasignación resta a quien la tenía y suma a quien la recibe.

**latidos** (R4.22): `tarea` text PK (`diario`), `ultimo_ok` timestamptz, `ultimo_error` text null, `fallos_seguidos` int default 0.

**auditoria**: `id` bigint identity, `actor_id` uuid null (null = visitante o sistema), `accion` text (`estado`, `asignacion`, `reagenda`, `cancelacion`, `borrado`, `rol`, `activo`, `config`), `tabla` text, `registro_id` uuid, `antes` jsonb, `despues` jsonb, `creado_en`. Sin datos de contacto en `antes`/`despues` del borrado: solo el id.

**correos_salientes** (registro de correos, X6): `id`, `para` citext, `plantilla` text, `datos` jsonb, `adjunto_ics` text null, `estado` estado_correo, `resend_id` text null (para cancelar o reprogramar), `programado_para` timestamptz null, `intentos` int default 0, `ultimo_error` text null, `enviado_en` timestamptz null, `referencia` text unique null (idempotencia: p. ej. `recordatorio24:<reunion_id>`), `reunion_id` uuid null, `solicitud_id` uuid null.

**limites** (límite de envíos): `clave` text PK (`<accion>:<sha256(ip + IP_SAL_SECRETO)>`), `ventana_inicio` timestamptz, `conteo` int.

### Índices

- solicitudes: `(asignado_a, creado_en desc, id desc)`, `(estado, creado_en desc, id desc)`, `(creado_en desc, id desc)`, `(ultimo_contacto_en)`, `(email)`.
- reuniones: `(anfitrion_id, inicio)`, `(inicio) where estado = 'confirmada'`, `(solicitud_id)`.
- notas: `(solicitud_id, creado_en desc)`.
- bloqueos: gist `(perfil_id, tstzrange(inicio, fin))`.
- eventos: `(tipo, perfil_id, creado_en desc)`, `(creado_en desc, id desc)`.
- auditoria: `(creado_en desc, id desc)`, `(registro_id)`.
- correos_salientes: `(reunion_id) where estado = 'programado'`, `(solicitud_id) where estado = 'programado'`, `(estado) where estado = 'fallido'`.

### Quién lee y escribe cada tabla

| Tabla | Lee | Escribe |
|---|---|---|
| perfiles | admin todo; vendedor su fila | admin; vendedor su fila (nombre, whatsapp, enlace_meet) |
| invitaciones | admin | servidor (acción del admin) |
| config_agenda, horario_base | servidor; admin | admin |
| bloqueos | admin; vendedor los suyos; servidor | admin; vendedor los suyos |
| solicitudes | admin; vendedor las asignadas | servidor (crear); vendedor estado de las suyas; admin |
| reuniones | admin; vendedor las suyas; servidor | servidor (funciones `reservar_reunion`, `cambiar_reunion`, `cancelar_reunion`); vendedor estado de las suyas |
| notas | admin; vendedor de sus solicitudes | admin; vendedor en sus solicitudes |
| enlaces_prospeccion | admin; vendedor los suyos; servidor | admin; vendedor los suyos |
| equipo | todos (`visible = true`); admin todo | admin |
| config_calculadora | todos | admin |
| auditoria | admin; vendedor las filas de sus solicitudes | triggers |
| metricas_persona | admin; vendedor sus filas | triggers |
| eventos, metricas_diarias, correos_salientes, limites, latidos | admin (excepto limites); servidor | servidor y triggers |

«Servidor» = un route handler público, el webhook o el cron, que valida con Zod (y Turnstile, límite, token o secreto) y usa el cliente admin del kit **solo para llamar la RPC que le toca**; nunca lee tablas del negocio. El panel escribe con Server Actions (`actionClient`) bajo RLS. Lo que cambia estado, dueño, dinero o fórmulas va solo por RPC `security definer` con `set search_path = ''`; las de edición llevan `p_actualizado_en_esperado` y responden `PT409` ante un conflicto (reglas `datos.md` y `migraciones.md` del kit). Tablas que se escriben solo por RPC: solicitudes (estado, asignado_a), reuniones, perfiles (rol, activo, en_turno), config_calculadora, config_agenda, horario_base, eventos, metricas_*, latidos, limites, correos_salientes. Fotos del equipo: subidas por hash; una foto reemplazada se borra solo cuando queda huérfana (recolector del kit). Catálogo de permisos: tablas `permisos` (clave, descripción) y `permisos_rol` (rol, clave, alcance) con funciones `tiene_permiso(clave)` e `ids_con_alcance(clave)`, cargadas en su migración con `insert … on conflict`.

### Retención y borrado

- Solicitudes con `ultimo_contacto_en` de hace más de 24 meses se borran solas (tarea diaria, con sus reuniones y notas en cascada); queda solo una fila en `auditoria` con el id (C2, R3.4).
- Borrado a pedido: la persona escribe a `privacidad@getcalesa.com`; el admin busca por email en el panel y borra (C3). El borrado cancela en Resend los correos programados para ese correo, los elimina de `correos_salientes` y vacía `datos` de los ya enviados (R4.17).
- `eventos` se conservan 24 meses; `correos_salientes` enviados, 90 días; `limites`, 2 días.

## 4. Seguridad

### Matriz RLS (cada fila es un caso de prueba en `supabase/tests/rls-calesa.sql`, que corre `pnpm db:probar`)

Datos de ejemplo de la semilla de pruebas: admin `A` (andres@ejemplo.test), vendedor `V1` (carla@ejemplo.test), vendedor `V2` (luis@ejemplo.test), vendedor inactivo `V3`; solicitud `S1` asignada a V1, `S2` asignada a V2; reunión `R1` de S1 con anfitrión V1; equipo `E1` visible, `E2` oculto.

| # | Rol | Tabla | Acción | Resultado | Ejemplo |
|---|---|---|---|---|---|
| 1 | anon | equipo | select | permitido solo visibles | ve E1, no E2 |
| 2 | anon | config_calculadora | select | permitido | lee precio 18000 |
| 3 | anon | config_calculadora | update | denegado | precio = 1 → 0 filas |
| 4 | anon | solicitudes | insert | denegado | error de política |
| 5 | anon | solicitudes | select | denegado | 0 filas |
| 6 | anon | perfiles | select | denegado | 0 filas |
| 7 | anon | reuniones | select | denegado | 0 filas |
| 8 | V1 | solicitudes | select | solo asignadas | ve S1, no S2 |
| 9 | V1 | solicitudes | update estado de S1 | permitido | `realizada` |
| 10 | V1 | solicitudes | update estado de S2 | denegado | 0 filas |
| 11 | V1 | solicitudes | update asignado_a de S1 | denegado | trigger lanza error |
| 12 | V1 | solicitudes | update email de S1 | denegado | trigger lanza error |
| 13 | V1 | solicitudes | delete S1 | denegado | 0 filas |
| 14 | V1 | notas | insert en S1 | permitido | |
| 15 | V1 | notas | insert en S2 | denegado | error de política |
| 16 | V1 | notas | select de S2 | denegado | 0 filas |
| 17 | V1 | reuniones | select | solo propias | ve R1 |
| 18 | V2 | reuniones | select R1 | denegado | 0 filas |
| 19 | V1 | reuniones | update estado de R1 directo | denegado | trigger: el estado cambia solo vía la solicitud o las funciones (R4.7) |
| 20 | V1 | reuniones | update inicio de R1 | denegado | trigger (solo por función) |
| 21 | V1 | bloqueos | insert propio | permitido | |
| 22 | V1 | bloqueos | insert para V2 | denegado | |
| 23 | V1 | perfiles | update su whatsapp | permitido | `+59170000001` |
| 24 | V1 | perfiles | update su rol a admin | denegado | trigger |
| 25 | V1 | perfiles | update en_turno propio | denegado | trigger (solo admin) |
| 26 | V1 | perfiles | select V2 | denegado | 0 filas |
| 27 | V1 | horario_base | update | denegado | 0 filas |
| 28 | V1 | config_calculadora | update | denegado | 0 filas |
| 29 | V1 | equipo | update E1 | denegado | 0 filas |
| 30 | V1 | enlaces_prospeccion | insert propio | permitido | `GT-02` |
| 31 | V1 | enlaces_prospeccion | select de V2 | denegado | 0 filas |
| 32 | V1 | invitaciones, eventos, metricas_diarias, correos_salientes, latidos | select | denegado | 0 filas |
| 33 | V3 (inactivo) | solicitudes | select | denegado | 0 filas aunque tenga asignadas |
| 34 | A | solicitudes | select | permitido todas | S1 y S2 |
| 35 | A | solicitudes | update asignado_a | permitido | S1 → V2 |
| 36 | A | solicitudes | delete | permitido | |
| 37 | A | perfiles | update activo propio a false | denegado | trigger |
| 38 | A | config_calculadora | update | permitido | precio 20000 |
| 39 | A | equipo | insert/update/delete | permitido | |
| 40 | anon | storage `equipo` | upload | denegado | |
| 41 | A | storage `equipo` | upload | permitido | jpg 1 MB |
| 42 | V1 | storage `equipo` | upload | denegado | |
| 43 | V1 | auditoria | select de S1 | permitido | ve el cambio de estado de S1 |
| 44 | V1 | auditoria | select de S2 | denegado | 0 filas |
| 45 | V1 | metricas_persona | select propias | permitido | |
| 46 | V1 | metricas_persona | select de V2 | denegado | 0 filas |
| 47 | service_role | reuniones | segunda reunión confirmada para S1 | denegado | índice único (R4.15) |

Funciones auxiliares (`security definer`, `search_path = ''`): `public.es_admin()`, `public.es_usuario_activo()`. Las funciones `reservar_reunion`, `cambiar_reunion`, `cancelar_reunion`, `asignar_solicitud`, `crear_o_juntar_solicitud`, `reasignar_solicitud`, `desactivar_usuario`, `actualizar_meet` y `elegir_whatsapp` solo las puede ejecutar `service_role` (revoke de `public`, `anon`, `authenticated`).

### Datos personales y dónde viven

- Nombre, email, WhatsApp, importadora, país, cifras del negocio: tabla `solicitudes` (Supabase, proyecto de producción). Copias en `correos_salientes.datos` hasta 90 días y en Resend (correos programados, hasta su envío).
- Nombre, email, WhatsApp de usuarios del panel: `perfiles` y `auth.users`.
- Fotos del equipo: bucket público `equipo` (es contenido publicado a propósito).
- IP: nunca se guarda en claro; solo `sha256(ip + IP_SAL_SECRETO)` en `limites`, 2 días.
- Vercel Web Analytics: sin cookies, sin datos personales (C6).

### Secretos (solo nombres; nunca en el repositorio)

| Variable | Entornos | Dónde se usa |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | pruebas, producción | navegador y servidor |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | pruebas, producción | navegador (sesión del panel) |
| SUPABASE_SECRET_KEY | pruebas, producción | solo servidor |
| RESEND_API_KEY | pruebas, producción | solo servidor |
| NEXT_PUBLIC_TURNSTILE_SITE_KEY | pruebas, producción | navegador |
| TURNSTILE_SECRET_KEY | pruebas, producción | solo servidor |
| CRON_SECRET | pruebas, producción | servidor; Vercel Cron lo envía como `Authorization: Bearer` |
| RESEND_WEBHOOK_SECRET | pruebas, producción | solo servidor (firma del webhook, R5.3) |
| RESPALDO_DB_URL | secreto de GitHub Actions | cadena de conexión de solo lectura para `pg_dump` (X13) |
| RESPALDO_CLAVE | secreto de GitHub Actions | clave de cifrado `age` del respaldo |
| TOKEN_FIRMA_SECRETO | pruebas, producción | servidor (HMAC de tokens de solicitud) |
| IP_SAL_SECRETO | pruebas, producción | servidor |
| NEXT_PUBLIC_SITIO_URL | todos | `https://calesa.app` en producción |
| EMAIL_PROVEEDOR | todos | `resend` en pruebas y producción; `mailpit` en local (variable del kit) |
| EMAIL_REMITENTE | todos | `hola@getcalesa.com` (variable del kit) |
| EMAIL_REMITENTE_NOMBRE | todos | `Calesa` (variable del kit) |
| EMAIL_AVISOS | todos | `equipo@getcalesa.com` |
| EMAIL_PRIVACIDAD | todos | `privacidad@getcalesa.com` |
| ADMIN_EMAIL | pruebas, producción | `alpiryk@gmail.com`: cuenta del admin (X14) |
| LEGAL_APROBADO | producción | «si» solo cuando el abogado aprobó los textos legales (P10, P19) |

Todas se declaran en `src/shared/config/esquemas.ts` y `.env.example` del kit; `pnpm env:check` dice cuál falta sin imprimir valores.

### Modelo de amenazas

| Quién | Cómo | Qué lo impide |
|---|---|---|
| Bot de spam | Envía miles de formularios | Turnstile en formulario y detalle de calculadora; límite 5 envíos/h por IP en cada acción; `limites` en la base (C7) |
| Competidor | Reserva todas las horas | Reservar exige el token firmado de una solicitud recién creada (válido 2 h, un uso por solicitud); máx. 1 reunión confirmada por solicitud; 10 reservas/h por IP |
| Visitante curioso | Adivina el enlace de gestión de otra reunión | Token de 32 bytes aleatorios, en la base solo su sha256; respuesta igual para token inexistente |
| Vendedor | Ve leads de otros o se cambia el rol | RLS (filas 8–33) y triggers de columnas |
| Ex vendedor | Sigue entrando | `activo = false` bloquea todo por RLS; el admin además cierra sus sesiones (`auth.admin.signOut`) |
| Alguien con un enlace mágico viejo | Lo reusa | Enlaces de Supabase de un solo uso, expiran en 1 h; `shouldCreateUser: false` (solo correos invitados) |
| Atacante de inyección | Manda HTML en nombre o notas | Zod limita largo y caracteres de control; React escapa; los correos usan React Email (escapa) |
| Llamada falsa al cron | Dispara envíos | `/api/cron/*` exige `Authorization: Bearer CRON_SECRET`; comparación de tiempo constante |
| Fuga de clave secreta | Lee toda la base | Solo en variables de servidor de Vercel; nunca `NEXT_PUBLIC_`; revisión en CI busca `SUPABASE_SECRET_KEY` en código de cliente |

Cabeceras: CSP con `default-src 'self'`, permitidos `challenges.cloudflare.com` (Turnstile), `*.supabase.co`, `va.vercel-scripts.com`, Google Fonts; `frame-ancestors 'none'`; `Referrer-Policy: strict-origin-when-cross-origin`; `X-Content-Type-Options: nosniff`. `/panel` y `/reunion/*` con `noindex`.

## 5. Reglas de negocio y fórmulas

Todas las fórmulas viven en `entities/` de su módulo (`calculadora`, `planes`, `agenda`, `solicitudes`) como funciones puras de TypeScript, sin acceso a red ni a la base, con su test al lado que usa exactamente los ejemplos de esta sección. Moneda: dólares (US$). Redondeo de lo que se muestra: al entero más cercano, mitad hacia arriba, solo al final; los cálculos internos usan números sin redondear (X3).

### 5.1 Formato

- Montos con `formato.ts` del kit (regla: ningún número sin `formato.ts`), extendido en P01 con el formato de Calesa: `formatoUSD(n)` → `"US$ " + entero redondeado con punto de miles`. Ejemplos: `formatoUSD(4451.87)` = `US$ 4.452`; `formatoUSD(126000)` = `US$ 126.000`; `formatoUSD(1234.5)` = `US$ 1.235`; `formatoUSD(0)` = `US$ 0`.
- `formatoRango(a, b)` → `US$ 4.452 – US$ 8.935` (guion largo con espacios).
- Fechas con `fechas.ts` del kit: `3 nov 2026`; con hora: `mar 3 nov 2026, 10:00`; siempre se indica la zona si no es la del visitante («hora de Bolivia»).
- Cifras con `font-variant-numeric: tabular-nums`, alineadas a la derecha en tablas.

### 5.2 Calculadora «Lo que se te escapa al mes» (B4, B4.1, B4.3)

**Entradas del visitante** (Zod): `autos` 1–400; `margen` 100–30000; `consultas` 10–5000 y `consultas ≥ autos`; `respuesta` ∈ {h1, h4, dia, sig}; `administracion` 1–80.
**Datos del panel** (`config_calculadora`): `precio, pct_sena, sena, moneda_local, pct_local, volatilidad, sueldo, tasa, ciclo_dias`.
**Supuestos fijos en código** (`src/modules/calculadora/entities/supuestos.ts`), cada uno `[mínimo, máximo]`, índice `i = 0` escenario mínimo, `i = 1` máximo:
`caida = [0,08, 0,15]`; `dias_coord = [2, 4]`; `no_ajusta = 0,5`; `olvido_frec = [0,08, 0,15]`; `olvido_monto = [150, 200]`; `preguntas = [1, 1,5]` por semana; `min_mensaje = 5`; `pct_cotiza = 0,4`; `min_cotiza = [12, 20]`; `h_papeles = [3, 6]` por semana por persona; `atraso = [4, 8]` días; `semanas_mes = 4,33`; `horas_mes = 176`.
Probabilidad de contestar después de 1 hora `s`: h1 = 0,15; h4 = 0,5; dia = 0,7; sig = 0,9. Volatilidad `[mín, máx]`: baja = [0,002, 0,005]; media = [0,005, 0,01]; alta = [0,01, 0,03].

Para cada escenario `i`:
1. `c = autos / consultas`; `cf = c / (1 − s·caida[i])`; **ventas** = `consultas · cf · caida[i] · s · margen`.
2. `costo = max(0, precio − margen)`; `dia_auto = costo · (tasa/100) / 365`; **días** = `autos · dias_coord[i] · dia_auto`.
3. **cambio** = `moneda_local ? autos · precio · (pct_local/100) · volatilidad[i] · no_ajusta : 0`.
4. **olvidos** = `autos · olvido_frec[i] · olvido_monto[i]`.
5. **saldos** = `autos · (pct_sena/100) · max(0, precio − sena) · (atraso[i]/365) · (tasa/100)`.
6. `camino = autos · ciclo_dias / 30`; `compradores = camino · pct_sena/100`; `h_msj = compradores · preguntas[i] · 4,33 · 5 / 60`; `h_cot = consultas · 0,4 · min_cotiza[i] / 60`; `h_pap = administracion · h_papeles[i] · 4,33`; `horas = h_msj + h_cot + h_pap`; **tiempo** = `horas · sueldo / 176`.
7. **total[i]** = ventas + días + cambio + olvidos + saldos + tiempo.

Se muestra: titular «Se te escapan cada mes, como mínimo» = `formatoUSD(total[0])`; rango `formatoRango(total[0], total[1])`; horas `round(horas[0])` a `round(horas[1])`; desglose por fila; etiqueta «Estimación»; «Cómo se calculó» desplegable con las fórmulas en palabras y los datos del panel usados.

**Ejemplo 1** (prueba `calculadora.test.ts`) — datos iniciales del panel; entradas `autos 25, margen 1800, consultas 300, respuesta dia, administracion 3`:
| Fila | Mínimo | Máximo |
|---|---|---|
| Ventas por contestar tarde | 2.669 | 5.279 |
| Días perdidos coordinando | 333 | 666 |
| Diferencia de tipo de cambio | 450 | 900 |
| Costos que no se cobraron | 300 | 750 |
| Saldos cobrados tarde | 395 | 789 |
| Horas del equipo | 305 | 551 |
| **Total** | **US$ 4.452** | **US$ 8.935** |
Horas a mano: 77 a 139. (Valores sin redondear del total: 4451,87 y 8935,01.)

**Ejemplo 2** — `autos 10, margen 1200, consultas 150, respuesta h1, administracion 2` → total `US$ 915 – US$ 1.847` (914,51 y 1846,92); ventas 146–276; días 138–276; cambio 180–360; olvidos 120–300; saldos 158–316; tiempo 173–319; horas 43–80.

**Ejemplo 3** — igual al 1 con `moneda_local = false` en el panel → cambio 0–0; total `US$ 4.002 – US$ 8.035`.

**Validaciones**: `consultas < autos` → «Las consultas no pueden ser menos que los autos vendidos.» Cualquier dato fuera de rango → mensaje bajo el campo con el rango permitido.

### 5.3 Gráfica «Crecer sin contratar» (B8, B8.1)

Entradas del formulario: `autos_hoy`, `autos_meta` (≥ autos_hoy), `vendedores`, `administracion`. Capacidad extra por persona con Calesa: operación `[0,30, 0,60]`, ventas `[0,10, 0,20]`. `techo(x) = ceil(x − 1e-9)`.
- `k = autos_meta / autos_hoy`
- `sin = techo(vendedores·k) + techo(administracion·k)`
- `con[i] = max(vendedores, techo(vendedores·k / (1 + cap_ventas[i]))) + max(administracion, techo(administracion·k / (1 + cap_op[i])))`
- Barras: «Sin sistema: `sin` personas» y «Con Calesa: `con[1]` a `con[0]` personas». Si `con[0] = con[1]`, un solo número. Texto: «Para pasar de `autos_hoy` a `autos_meta` autos al mes, con tu forma de trabajar actual necesitarías `sin − (vendedores + administracion)` personas más.» Etiqueta «Cálculo aproximado».
- Si `autos_meta = autos_hoy`: sin gráfica; texto «Con la misma cantidad de autos no necesitas contratar. Calesa te devuelve horas para vender más.»

| Caso | hoy → meta | vend / adm | sin | con | Prueba |
|---|---|---|---|---|---|
| A | 25 → 50 | 3 / 3 | 12 | 9 a 11 | `escala.test.ts` |
| B | 30 → 100 | 4 / 4 | 28 | 21 a 24 | |
| C | 10 → 15 | 2 / 1 | 5 | 4 a 5 | |
| D | 40 → 40 | 5 / 4 | — | — | muestra el texto de «misma cantidad» |
| E | 20 → 10 | 3 / 3 | — | — | error «La meta debe ser igual o mayor a lo que vendes hoy.» |

### 5.4 Precios (A0.3, B6, R1.1, X11)

Constantes en `src/modules/planes/entities/precios.ts` (única fuente; las tarjetas y la tabla las leen):
| Plan | Autos/mes | Cuota mensual | Anual (12 por 10) | Ahorro anual | Implementación única | Funcionando en |
|---|---|---|---|---|---|---|
| Vitrina | hasta 20 | 490 | 4.900 | 980 | 4.500 | 2 semanas |
| Operación (recomendado) | hasta 60 | 1.290 | 12.900 | 2.580 | 12.000 | 3–4 semanas |
| Completo | hasta 150 | 2.900 | 29.000 | 5.800 | 25.000 | 4–6 semanas |
| Grupo | más de 150 | desde 5.500 | desde 55.000 | desde 11.000 | desde 60.000 | 8–12 semanas |
Reglas: `anual = cuota · 10`; `ahorro = cuota · 12 − anual`. Pruebas: Vitrina anual 4.900 y ahorro 980; Completo anual 29.000 y ahorro 5.800; Grupo lleva «desde» en los cuatro montos.
Tarjetas: cuota mensual al frente («US$ 1.290 /mes»); con el selector en «Anual»: «US$ 12.900 /año · ahorras US$ 2.580»; debajo, «+ implementación única de US$ 12.000». Tabla completa en `/planes` con mensual, anual, ahorro, implementación y todo lo que incluye (§6.3). Pie de tabla: «Montos en US$, sin impuestos. Aceptamos bolivianos al tipo de cambio oficial del día.» y «También puedes comprar la licencia, pagar la implementación en hitos o sumar extras: te lo detallamos en la propuesta.» La regla de exceso de autos de «Planes Calesa» no aparece en ninguna página de la web (X11).

### 5.5 Horas disponibles de la agenda (B10–B12, R1.2, X10)

Una hora candidata `h` (inicio) se ofrece si existe al menos una persona elegible. Inicios cada 30 min dentro de cada tramo de `horario_base`, en `America/La_Paz`, con `h + duracion ≤ hasta`.
Persona elegible para `h`: `activo` y `en_turno` y con `whatsapp` y `enlace_meet`; sin bloqueo que se cruce con `[h, h + duracion)`; sin reunión confirmada cuyo rango `[inicio, fin + descanso)` se cruce con `[h, h + duracion + descanso)`; menos de `max_reuniones_dia` reuniones confirmadas ese día (día de La Paz).
Global: `h ≥ ahora + anticipacion_min_horas` y `h ≤ ahora + horizonte_dias`.
Candidatos: los vendedores elegibles; si no hay ninguno, el admin si es elegible (R1.2). El admin es elegible con las mismas condiciones, incluida `en_turno = true`, que él mismo activa cuando carga su enlace de Meet y quiere ser respaldo (R4.9). Al reagendar desde el panel, el único candidato es el anfitrión actual (R4.1); al reagendar desde `/reunion/<token>` una solicitud de prospección, sigue limitada al creador del enlace (R4.20). Con enlace de prospección: solo el creador del enlace si está activo; si no está activo, la regla general (R2.2).

**Ejemplo** (prueba `horas.test.ts`), configuración inicial, `ahora = lun 2 nov 2026 08:00` La Paz:
- Primera hora ofrecida: `mar 3 nov 09:00` (lunes 20:00 en adelante no tiene horario).
- Inicios de un día completo: 09:00, 09:30, 10:00, 10:30, 11:00, 11:30, 14:00, 14:30, 15:00, 15:30, 16:00, 16:30, 17:00, 17:30 (14).
- Última hora ofrecida: `lun 23 nov 08:00` no existe en horario → la última es `vie 20 nov 17:30`.
- Si V1 tiene reunión `mar 3 nov 09:00–09:30`: V1 no es elegible para 09:00 ni 09:30 (descanso hasta 09:45), sí para 10:00; tampoco para 08:30 (no hay horario).
- Si V1 tiene reunión a las 10:00: V1 no es elegible a las 09:30 (`[09:30, 10:15)` se cruza con `[10:00, 10:45)`).
- Si V1 ya tiene 4 reuniones el 3 nov: no es elegible ese día.
- Visitante en `America/Bogota` (UTC−5): la hora 09:00 de La Paz se le muestra como 08:00.
- Visitante en `America/Santiago` (cambio de horario el 4 abr 2027 a las 00:00): las 09:00 de La Paz del vie 2 abr 2027 se le muestran como 10:00, y las del lun 5 abr 2027 como 09:00 (prueba con `ahora = lun 29 mar 2027 08:00`).
- Visitante en `Europe/Madrid` (zona fuera de §6.6, R4.13): se acepta y se muestra convertida.

### 5.6 Reparto parejo (R1.2, R2.1, R3.1, X5)

- **Reunión**: si la solicitud ya tiene `asignado_a` y esa persona es elegible para `h`, gana ella (X5). Si no, entre los elegibles gana quien tiene menos reuniones confirmadas en la semana ISO de `h` (lunes a domingo, La Paz); empate → la persona cuya última reunión asignada es más antigua (o nunca tuvo); empate → `perfiles.creado_en` más antiguo. Ejemplo: elegibles V1 (2 reuniones esa semana) y V2 (1) → V2. Ejemplo: V1 y V2 con 1; V1 recibió la última hace 2 días y V2 hace 5 → V2.
- Si el anfitrión elegido ≠ `asignado_a`, la solicitud pasa al anfitrión (auditoría `asignacion`).
- **Solicitud nueva** (formulario o calculadora): entre vendedores activos y en turno, quien tiene menos solicitudes asignadas en la semana ISO actual; mismos desempates; si no hay ninguno, el admin si está en turno (R4.9); si tampoco, queda sin asignar y solo la ve el admin. Prospección: el creador del enlace si está activo; con enlace inactivo o inexistente, `?ref` se ignora (R4.19).
- **Solicitud repetida** (R4.5): si el correo tiene una solicitud `nueva` o `agendada` creada en los últimos 30 días, `crear_o_juntar_solicitud` completa los campos vacíos de esa misma y suma los nuevos datos, conserva `asignado_a`, no encola aviso de solicitud y escribe `auditoria` con acción `juntada`. Ejemplo: detalle de calculadora el 2 nov y formulario el 5 nov con el mismo correo → una sola solicitud, con origen original `calculadora`.
- **Reasignar** (R4.2): si la solicitud tiene reunión confirmada, la reunión pasa al nuevo vendedor solo si es elegible a esa hora (sin contar `en_turno`); si no, se rechaza con «Esa persona no está libre a esa hora. Reagenda primero.» El visitante recibe `reunion-cambiada` con el nuevo anfitrión y su Meet.
- **Desactivar** (R3.3, R4.3): sus reuniones futuras pasan con reparto parejo; si nadie es elegible, al admin aunque no esté en turno (si el admin no tiene enlace de Meet, el panel no permite desactivar: «Carga tu enlace de Meet antes de desactivar a esta persona.»).
- **WhatsApp público**: entre vendedores activos, en turno y con WhatsApp, quien tiene menos eventos `clic_whatsapp` esa semana; mismos desempates; si no hay ninguno, el admin si está en turno y tiene WhatsApp (R4.9); si nadie está disponible, redirige a `/agendar?aviso=sin-whatsapp` (R4.10). Ejemplo: V1 con 7 clics y V2 con 3 → V2.
- La reserva corre en la función `reservar_reunion` dentro de una transacción con `pg_advisory_xact_lock(hashtext(h::text))`; si la restricción de exclusión falla, prueba con el siguiente candidato; si no queda ninguno, responde «Esa hora se acaba de ocupar. Elige otra.»

### 5.7 Estados de la solicitud y de la reunión

| Desde | Hacia | Quién | Efecto |
|---|---|---|---|
| (nada) | nueva | servidor al crear | asigna (§5.6) |
| nueva | agendada | servidor al reservar | reunión `confirmada` |
| agendada | nueva | servidor al cancelar la reunión | reunión `cancelada` |
| agendada | realizada / no_asistio | vendedor o admin, solo después del inicio de la reunión | la reunión pasa al mismo estado |
| realizada | ganada / descartada | vendedor o admin | |
| nueva / no_asistio | descartada | vendedor o admin | |
| descartada | nueva | admin | |
Cualquier otro cambio se rechaza con «Ese cambio de estado no está permitido.» Cada cambio actualiza `ultimo_contacto_en` y escribe en `auditoria`. La máquina de estados vive en un trigger `before update` de `solicitudes` que valida la transición y actualiza la reunión confirmada en la misma transacción; `reuniones.estado` no se actualiza directamente (R4.7). Cancelar una reunión (visitante, vendedor o admin) deja la solicitud en `nueva`.

### 5.8 Tokens, plazos y recordatorios

- Token de solicitud: `base64url(HMAC-SHA256(TOKEN_FIRMA_SECRETO, solicitud_id + "." + exp))`, `exp = creado + 2 h`. Sirve para reservar una vez. Ejemplo: solicitud creada 10:00 → reservar a las 11:59 sí; a las 12:01 «El enlace venció. Vuelve a llenar el formulario.»
- Gestión de reunión: `/reunion/<token>` (32 bytes aleatorios). Cambiar o cancelar hasta `inicio − cancelar_hasta_horas`. Ejemplo: reunión 3 nov 10:00 → hasta 08:00 sí; 08:01 muestra «Ya no se puede cambiar en línea. Escríbenos por WhatsApp.» con el WhatsApp del anfitrión.
- Al cambiar: se mantiene el anfitrión si está libre en la nueva hora; si no, reparto parejo (R2.3). `secuencia_ics + 1`.
- Tras cancelar: `/reunion/<token>` muestra «Elegir otra hora» y permite reservar de nuevo con el mismo token mientras la solicitud esté en `nueva` y no hayan pasado 30 días desde su creación (R4.16).
- Cambio de enlace de Meet (R4.21): `actualizar_meet` cambia `enlace_meet` en las reuniones futuras confirmadas de esa persona y encola `meet-cambiado` a cada visitante.
- Recordatorios (X6): al reservar se programan en Resend con `scheduledAt`. 24 h: solo si la reunión se reservó antes de `inicio − 24 h`. Ejemplo: reservada lun 08:00 para mar 10:00 → programado para lun 10:00; reservada lun 22:00 para mar 10:00 (12 h) → no se programa. 1 h: siempre, para `inicio − 1 h`, al visitante y al anfitrión. Al cambiar la reunión se cancelan los programados y se programan los nuevos; al cancelarla, se cancelan. La agenda abre 21 días y Resend permite programar hasta 30 días, así que todo cabe.
- Aviso «solicitud sin reunión» (X5): al crear la solicitud (origen formulario o prospección) se programa en Resend para `creado + 15 min`; si reserva antes, se cancela. Las de origen calculadora se avisan al crearse.
- Retención: tarea diaria a las 03:00 La Paz (único cron), borra de solicitudes con `ultimo_contacto_en < ahora − 24 meses`.

## 6. Experiencia

Es el contenido de `docs/UX.md`. Tono: español neutro latinoamericano, de tú; frases cortas; primero el dato; mayúscula solo al inicio; sin emojis; Calesa habla como empresa («Calesa te avisa»), nunca en nombre de un asesor (D6, E2, guía de voz del sistema de diseño).

### 6.1 Recorridos

1. **Dueño desde un video (celular)** (D1.1): entra a `/` → lee portada y problemas → «Quiero verlo con mis autos» → `/agendar` paso 1 (formulario + gráfica) → «Elegir día y hora» → paso 2 (calendario en su zona) → elige hora → «Confirmar reunión» → paso 3 «Tu demo está confirmada» con fecha, anfitrión y botón «Agregar a mi calendario» (.ics) → correo de confirmación.
2. **Dueño curioso** (D1.2): `/#calculadora` → llena 5 datos → ve rango → «Agendar demo» → `/agendar?autos=25&adm=3` con esos datos ya cargados; o «Te mando el detalle por correo» → nombre + email + casilla → recibe el detalle.
3. **Prefiere hablar** (D1.3): toca WhatsApp → `/api/whatsapp?p=<pagina>` → abre `wa.me/<numero del vendedor de turno>?text=Hola, vengo de calesa.app y quiero ver una demo con mis autos.`
4. **Agendado cambia o cancela** (D1.4): abre el enlace del correo → `/reunion/<token>` → «Cambiar hora» (mismo calendario) o «Cancelar reunión» (confirma) → correo con el cambio; después de cancelar puede «Elegir otra hora» (R4.16).
5. **Prospecto** (A4): recibe `calesa.app/agendar?ref=GT-02` por WhatsApp → mismo flujo; solo ve horas del vendedor que creó el enlace.
6. **Vendedor** (D1.5): recibe correo «Nueva demo: Importadora X, mar 3 nov 10:00» → entra a `/entrar` con su correo → enlace mágico → `/panel` ve su próxima reunión → después de la reunión marca «Realizada» y escribe una nota.
7. **Admin invita** (B19, R4.14): `/panel/usuarios` → «Invitar vendedor» → nombre y email → la persona recibe «Te invitaron al panel de Calesa» → entra → `/panel/perfil?bienvenida=1` pide WhatsApp y enlace de Meet → el admin la pone «En turno».

### 6.2 Inicio `/` — secciones y textos clave (B2)

Navegación fija: logo integrado · «El sistema» · «Planes» · «Preguntas» · botón «Agendar demo». En celular: menú en hoja inferior. Enlaces internos con desplazamiento suave y transición de vista entre páginas (B1.1).

1. **Portada.** Rótulo `PARA DUEÑOS DE IMPORTADORAS`. Título (display, expandido): «Vende más autos sin perder el control.» (B3). Subtítulo: «El sistema a medida para importadoras que compran en Copart, IAAI, Manheim, Japón, Corea o China y venden por redes y WhatsApp. Ventas, cotizaciones, logística y plata en un solo lugar.» Botones: «Quiero verlo con mis autos» (principal) y «Escribir por WhatsApp». Medio: video del dueño de 12 s en bucle, sin sonido, 4:5 (`public/media/portada.mp4` + `.webm`, ≤ 3 MB) con póster de la maqueta del cotizador; si el archivo no existe se muestra la maqueta animada (E5, X8). Botón «Pausar video» visible.
2. **Problemas** (rótulo `LO QUE TE CUESTA HOY`): «Cada consulta que no contestas es un auto que vende otro.» Seis tarjetas con ilustración lineal de marca: Consultas sin contestar · Cotizaciones en Excel · «¿Dónde está mi auto?» · Autos trabados en aduana · Ganancia a ciegas · El vendedor que se fue (textos de «Ruta Importa», E3).
3. **El sistema** (rótulo `UN SOLO LUGAR`): «Un solo sistema para tu importadora, del lote a la placa.» Cinco bloques alternados texto + maqueta: Reparto de consultas («Ninguna consulta se queda sin dueño.») · Cotizador («Precio puesto en tu ciudad en 30 segundos.») · Logística por fases y portal «Mi vehículo» («Tu cliente ve dónde está su auto sin llamar.») · Señas y saldos («Cada saldo con fecha y aviso.») · Finanzas del dueño («La ganancia de cada auto, al día.»). Las maquetas usan el auto ficticio (SUV 2021, VIN `1XXEJEMPLO0000001`, subasta US$ 9.800, grúa US$ 450, flete US$ 1.650, seguro y gastos US$ 300, seña US$ 2.000) y el rótulo «Ejemplo con datos ficticios» (G3).
4. **Calculadora** (`id="calculadora"`): «¿Cuánto se te escapa al mes?» Formulario de 5 datos a la izquierda, resultado a la derecha (abajo en celular), cifras que cuentan al cambiar (§5.2).
5. **Prueba** (rótulo `YA FUNCIONA`): «Ya funciona en una de las importadoras más grandes de Bolivia: 35 asesores y unos 40 autos al mes.» (A0.2, A2). Sin logo ni nombre.
6. **Planes**: cuatro tarjetas (§5.4) con selector Mensual / Anual y enlace «Ver la tabla completa» → `/planes`.
7. **Cómo empezamos**: 1 Diagnóstico («Conocemos cómo opera tu importadora y armamos la propuesta.») · 2 Firma y anticipo («El trabajo empieza con el anticipo cobrado.») · 3 Configuración («Tus pasos, tus documentos y tu equipo. De 2 a 12 semanas, según el plan.») · 4 Salida en vivo («Tu equipo trabaja con datos reales y firmas el acta de entrega.»).
8. **Quiénes somos**: filas visibles de `equipo` por `orden`: foto, nombre, cargo, frase. Fundador con la frase de A6.
9. **Preguntas frecuentes** (acordeón; JSON-LD FAQPage):
   - «¿Dónde se guardan mis datos?» → «En servidores en la nube, cifrados, con respaldos diarios. Los datos son de tu importadora.» (B21.1)
   - «¿Puedo llevarme mis datos?» → «Sí. Puedes exportar e importar tus datos en archivos CSV cuando quieras.» (B21.2)
   - «¿Aguanta si crecemos?» → «Crece contigo: el mismo sistema sirve con 5 o con 500 autos al mes, sin cambiar de herramienta.» (B21.2)
   - «¿Qué pasa si Calesa deja de existir?» → «Recibes el código actualizado de tu sistema y su documentación. Puedes seguir usándolo, modificarlo y contratar a otro programador para mantenerlo; solo no puedes revenderlo. Queda escrito en tu contrato.» (B21.3)
   - «¿Cuánto dura la demo y cuánto tarda en estar listo?» → «La demo dura 30 minutos. Según el plan, tu sistema funciona en 2, 3 a 4, 4 a 6 u 8 a 12 semanas.» (B21.4)
   - «¿Funciona en mi país?» → «Sí. Configuramos la aduana y los impuestos de tu país.» (B21.5)
   - «¿Cuánto cuesta?» → «Desde US$ 490 al mes más una implementación única. Mira la tabla completa en Planes.»
10. **Cierre**: panel ciruela, «Míralo funcionando con un auto de tu inventario.» + «Agendar demo».
Pie: logo blanco, enlaces (Planes, Agendar demo, Privacidad, Términos), «Responsable: Andrés Eduardo Rosas Alpiri · Santa Cruz de la Sierra, Bolivia · privacidad@getcalesa.com», «Última actualización: <fecha de §6.7>» (C5).

### 6.3 `/planes`

Título «Planes y precios». Selector Mensual / Anual. Cuatro tarjetas (§5.4). Tabla completa (encabezado pegajoso; en celular, desplazamiento horizontal dentro de la tabla con la primera columna fija):
- Montos: cuota mensual, pago anual, ahorro, implementación única.
- Tamaño: autos al mes (hasta 20 / 60 / 150 / más de 150); usuarios (hasta 10 / ilimitados / ilimitados / ilimitados); orígenes de compra (1 / 2 / todos / todos + zona franca); países de destino (1 / 1 / 1 / varios).
- Sistema: vitrina web, reparto de consultas y cotizador (todos); inventario, reservas, señas y saldos (desde Operación); roles, cartera transferible y auditoría (desde Operación); logística por fases con documentos (— / estándar / a medida / a medida por país); portal «Mi vehículo» (— / sí / con tu marca / con tu marca); finanzas del dueño (— / extra / sí / sí, consolidado).
- Servicio: funcionando en (2 / 3–4 / 4–6 / 8–12 semanas); respuesta del soporte (48 h / 24 h / 4 h / 2 h + gerente de cuenta); servidor, mejoras y cambios de impuestos (todos).
Celda incluida: ícono check + texto oculto «Incluido»; no incluida: guion + «No incluido». Pie con los dos textos de §5.4. Botón «Agendar demo».

### 6.4 `/agendar` (B8, B9, C4, D3)

**Paso 1 · Tus datos.** Campos: Nombre · Importadora · País (lista §6.6) · WhatsApp (prefijo según país + número) · Email · Autos que vendes al mes · Autos que quieres vender en 3 meses · Vendedores · Administración y logística · ¿Dónde compras? (casillas Copart, IAAI, Manheim, Japón, Corea, China) · casilla obligatoria «Acepto que Calesa me contacte por WhatsApp y correo. Ver privacidad.» · Turnstile. A la derecha (debajo en celular) la gráfica de §5.3 que se actualiza al escribir. Botón «Elegir día y hora». Debajo: «¿Prefieres escribir? Abrir WhatsApp».
**Paso 2 · Elige día y hora.** Zona detectada con `Intl` y selector «Ver horas en: …». Las horas llegan de `GET /api/horas?semana=AAAA-MM-DD&zona=<IANA>&t=<token>` (R4.20). Semana visible con días con horas disponibles resaltados; al elegir día, lista de horas. Botón «Confirmar reunión».
**Paso 3 · Confirmada.** «Tu demo está confirmada.» Fecha y hora en su zona, «Te atenderá <nombre>», enlace de Meet, «Agregar a mi calendario», «Cambiar o cancelar» (enlace de gestión), «Abrir WhatsApp con <nombre>».
El borrador del paso 1 se guarda en `sessionStorage` (con try/catch) para no perderlo sin conexión o al recargar (D4).

### 6.5 Inventario de pantallas

| Ruta | Rol | Contenido | Acciones | Vacío | Cargando | Error | Sin permiso | Sin conexión |
|---|---|---|---|---|---|---|---|---|
| `/` | todos | §6.2 | agendar, WhatsApp, calculadora, detalle por correo | Equipo sin filas: se oculta la sección | estático (SSG + revalidación 1 h) | calculadora: «No pudimos calcular. Revisa los datos.» | — | banner «Sin conexión. Lo que escribiste no se pierde.»; botones de envío desactivados |
| `/planes` | todos | §6.3 | selector, agendar | — | estático | — | — | banner |
| `/agendar` | todos | §6.4 | enviar, elegir hora, confirmar | «No hay horas libres esta semana. Mira la siguiente.» y, si no hay en 21 días, «Ahora no tenemos horas libres. Escríbenos por WhatsApp.» | esqueleto del calendario | «No pudimos guardar tus datos. Intenta de nuevo.» con «Reintentar»; hora ocupada: «Esa hora se acaba de ocupar. Elige otra.» | token vencido: «El enlace venció. Vuelve a llenar el formulario.»; con `?aviso=sin-whatsapp`: franja «Ahora no hay nadie en WhatsApp. Agenda tu demo aquí.» (R4.10) | banner; borrador en sessionStorage |
| `/reunion/[token]` | visitante con enlace | fecha, anfitrión, Meet, estado | cambiar, cancelar; si está cancelada, «Elegir otra hora» (R4.16) | — | esqueleto | «No pudimos cargar tu reunión.» + reintentar | token inválido: «Este enlace no es válido.»; fuera de plazo: §5.8 | banner |
| `/privacidad`, `/terminos` | todos | borrador aprobado por abogado (§6.7) | — | — | estático | — | — | — |
| `/entrar` | sin sesión | campo email | «Enviarme el enlace» | — | botón con indicador | correo no invitado: mismo mensaje que el éxito («Si tu correo está invitado, te llegó un enlace.») | — | banner |
| `/panel` | vendedor, admin | embudo del mes (admin: `metricas_diarias`; vendedor: `metricas_persona`, R4.4), próximas 5 reuniones, solicitudes sin reunión | ir a detalle | «No tienes reuniones próximas.» | esqueletos | «No pudimos cargar el resumen.» + reintentar | inactivo: «Tu acceso está pausado. Habla con el administrador.» | banner |
| `/panel/solicitudes` | vendedor (suyas), admin (todas) | lista paginada: fecha, nombre, importadora, país, estado, asignado (admin) | filtros por estado y origen; buscar por email (admin); «Cargar más» | «Todavía no hay solicitudes.» | esqueleto de filas | + reintentar | — | banner |
| `/panel/solicitudes/[id]` | dueño de la fila o admin | datos, gráfica guardada, reunión, notas, historial | cambiar estado (§5.7), nota, abrir WhatsApp, reasignar (admin, R4.2), borrar (admin, confirma escribiendo «BORRAR») | sin notas: «Sin notas todavía.» | esqueleto | + reintentar | ajena: «Esta solicitud no está asignada a ti.» | banner; nota sin enviar queda en el campo |
| `/panel/reuniones` | vendedor (suyas), admin | próximas y pasadas, paginadas | marcar realizada / no asistió (vía estado de la solicitud), reagendar (solo sus horas), cancelar (R4.1) | «No hay reuniones.» | esqueleto | + reintentar | — | banner |
| `/panel/disponibilidad` | vendedor (sus bloqueos), admin (horario común, reglas, bloqueos de todos) | calendario semanal | crear y borrar bloqueos; admin edita horario y reglas | «Sin bloqueos.» | esqueleto | + reintentar | vendedor en horario común: no se muestra | banner |
| `/panel/perfil` | vendedor, admin | nombre, email (solo lectura), WhatsApp, enlace de Meet | guardar; si cambia el Meet y tiene reuniones futuras, confirma «Avisaremos a N visitantes del nuevo enlace.» (R4.21) | — | — | validación por campo | — | banner |
| `/panel/prospeccion` | vendedor (suyos), admin | enlaces con código, etiqueta, solicitudes que trajo | crear, copiar, desactivar | «Crea tu primer enlace para un prospecto.» | esqueleto | código repetido: «Ese código ya existe.» | — | banner |
| `/panel/equipo` | admin | filas del equipo | crear, editar, subir foto (jpg/png/webp ≤ 2 MB), ordenar, ocultar, borrar | «Agrega a tu equipo.» | esqueleto | foto inválida: «La foto debe ser JPG, PNG o WebP de hasta 2 MB.» | vendedor: «Solo el administrador edita esta sección.» | banner |
| `/panel/calculadora` | admin | los 9 datos de `config_calculadora` con ayuda y el ejemplo 1 recalculado en vivo | guardar | — | — | validación por campo | vendedor: igual que arriba | banner |
| `/panel/usuarios` | admin | usuarios e invitaciones | invitar (nombre y email), reenviar invitación, revocar, poner/quitar en turno, desactivar/activar (R4.3) | «Invita a tu primer vendedor.» | esqueleto | email ya invitado: «Ya hay una invitación para ese correo.» | vendedor: igual que arriba | banner |
| `/panel/actividad` | admin | auditoría paginada y correos fallidos | reintentar correo | «Sin actividad.» | esqueleto | + reintentar | vendedor: igual que arriba | banner |
| 404 / error | todos | «No encontramos esta página.» / «Algo salió mal.» | volver al inicio | — | — | — | — | — |

Banner de tareas detenidas: si `latidos.diario.ultimo_ok` tiene más de 26 h, el admin ve «La tarea diaria no corre desde <fecha>.» (R4.22). Banner de cupos: si R5.2 detectó más del 80 % del plan gratis, «Te acercas al límite gratis de <base o correos>.» Banner de correos fallidos: si hay `correos_salientes` con `estado = fallido`, el admin ve en todo el panel «Hay N correos que no se pudieron enviar. Revisar.» (N con tope «más de 9»).

### 6.6 Listas fijas

**Países** (código, nombre, prefijo, zona por defecto): AR Argentina +54 America/Argentina/Buenos_Aires · BO Bolivia +591 America/La_Paz · CL Chile +56 America/Santiago · CO Colombia +57 America/Bogota · CR Costa Rica +506 America/Costa_Rica · EC Ecuador +593 America/Guayaquil · SV El Salvador +503 America/El_Salvador · GT Guatemala +502 America/Guatemala · HN Honduras +504 America/Tegucigalpa · MX México +52 America/Mexico_City · NI Nicaragua +505 America/Managua · PA Panamá +507 America/Panama · PY Paraguay +595 America/Asuncion · PE Perú +51 America/Lima · PR Puerto Rico +1 America/Puerto_Rico · DO República Dominicana +1 America/Santo_Domingo · UY Uruguay +598 America/Montevideo · VE Venezuela +58 America/Caracas · US Estados Unidos +1 America/New_York · XX Otro país (prefijo libre) zona detectada.
**Zonas del selector**: las de la lista anterior sin repetir, más la detectada si no está en la lista; se acepta cualquier zona IANA válida según `Intl.supportedValuesOf('timeZone')` (R4.13).

### 6.7 Textos legales (C5, H2)

`/privacidad` y `/terminos` se escriben como borrador con los títulos: responsable (Andrés Eduardo Rosas Alpiri, Santa Cruz de la Sierra, Bolivia, mientras Calesa no tenga razón social), correo de privacidad, datos que se recogen (§3), para qué, base (consentimiento de la casilla), cuánto tiempo (24 meses), con quién se comparten (proveedores de infraestructura y correo, sin nombrarlos por marca en la página), derechos y cómo pedir el borrado, cambios en la política, fecha de última actualización. Términos: uso del sitio, precios informativos sin impuestos, la propuesta y el contrato mandan, ley y tribunales de Bolivia. **No se publican en producción hasta que el abogado apruebe** y confirme si la dirección completa del responsable debe figurar (paso P19, rojo). Mientras tanto, en pruebas llevan la franja «Borrador: revisar con abogado».

### 6.8 Notificaciones

Todas salen de `EMAIL_REMITENTE`, en español, con logo, sin emojis. Las de evento salen en el momento; `recordatorio-24h`, `recordatorio-1h` y `solicitud-sin-reunion` (de formulario o prospección) se programan en Resend (X6). Las plantillas con identificador son de React Email (P07, 12 en total); invitación y enlace de acceso son plantillas de Supabase Auth enviadas por el SMTP de Resend (X9, R4.11).
| Plantilla | Evento | Para | Asunto |
|---|---|---|---|
| `reunion-confirmada` | Reunión reservada | visitante (+ .ics REQUEST) | «Tu demo con Calesa: mar 3 nov, 10:00» |
| `reunion-nueva-anfitrion` | Reunión reservada o recibida por reasignación | anfitrión | «Nueva demo: <importadora>, mar 3 nov, 10:00» |
| `reunion-cambiada` | Cambio de hora o de anfitrión (reagenda, reasignación, desactivación) | visitante (.ics, secuencia + 1) | «Cambió tu demo con Calesa: <nueva fecha>» |
| `reunion-cambiada-equipo` | El mismo cambio | anfitrión nuevo y anterior | «Cambio de demo: <importadora>» |
| `reunion-cancelada` | Cancelación (visitante, vendedor o admin) | visitante (.ics CANCEL) y anfitrión | «Se canceló tu demo con Calesa» |
| `recordatorio-24h` | 24 h antes | visitante | «Mañana es tu demo con Calesa» |
| `recordatorio-1h` | 1 h antes | visitante y anfitrión | «Tu demo con Calesa empieza en 1 hora» |
| `meet-cambiado` | El anfitrión cambió su enlace (R4.21) | visitante | «Cambió el enlace de tu demo con Calesa» |
| `detalle-calculadora` | Pidió el detalle (R4.18) | visitante | «Lo que se te escapa al mes: tu detalle» |
| `solicitud-sin-reunion` | 15 min sin reunión o solicitud de calculadora | asignado | «Nueva solicitud sin reunión: <importadora o nombre>» |
| `aviso-equipo` | Toda solicitud nueva y todo cambio o cancelación de reunión (B17) | `EMAIL_AVISOS` | «[Calesa] <tipo>: <importadora o nombre>» |
| `correo-fallido` | Un correo quedó `fallido` | `EMAIL_AVISOS` | «[Calesa] No se pudo enviar un correo» |
| (Supabase) | Invitación | invitado | «Te invitaron al panel de Calesa» |
| (Supabase) | Enlace de acceso | usuario | «Tu enlace para entrar a Calesa» |

`detalle-calculadora` lleva: los 5 datos ingresados, el rango y el mínimo, las 6 filas con mínimo y máximo, las horas, los datos del panel usados, un resumen de «cómo se calculó» en tres frases y el botón «Agendar demo» a `/agendar` con los datos cargados.

### 6.9 Microcopy

Botones: «Quiero verlo con mis autos», «Agendar demo», «Escribir por WhatsApp», «Elegir día y hora», «Confirmar reunión», «Cambiar hora», «Cancelar reunión», «Agregar a mi calendario», «Te mando el detalle por correo», «Enviarme el enlace», «Guardar», «Cargar más». Errores de campo: «Escribe tu nombre.», «Ese correo no parece válido.», «Revisa el número de WhatsApp.», «Marca la casilla para que podamos contactarte.», «Elige al menos un lugar donde compras.» Confirmaciones: «Guardado.», «Enlace copiado.», «Te enviamos el detalle a <email>.»

### 6.10 Accesibilidad y movimiento (D5, E7, B1.1)

WCAG 2.1 AA: contraste medido (§8); todo con teclado y foco visible (anillo 2 px `foco`, separación 2 px); áreas táctiles ≥ 44 px; etiquetas visibles en todos los campos; errores anunciados con `aria-live`; gráficas con tabla equivalente oculta para lectores; estados con ícono + palabra. Movimiento: entradas de 8–12 cuadros (≈ 300 ms) con desaceleración, sin rebotes; cifras que cuentan en 650 ms; transiciones de página con View Transitions; con `prefers-reduced-motion: reduce` todo se muestra sin animación y el video queda en póster.

## 7. Escala y rendimiento

Es el contenido de `docs/RENDIMIENTO.md` (lo genera `semilla-a-repo`). Rige además la regla `escala.md` del kit.

- **Toda lista del panel** (solicitudes, reuniones, notas, enlaces, equipo, usuarios, auditoría, correos) usa paginación por cursor `(creado_en, id)` descendente (reuniones próximas: `(inicio, id)` ascendente). Tamaño de página y tope de lo cargado: los de `src/shared/lib/paginacion.ts` del kit (`tamanoDePagina()`, `TOPE_DE_LO_CARGADO`), con keyset `leerCursor()`/`armarPagina()`; al llegar al tope se muestra «Mostrando las más recientes. Filtra para ver más.» Números en pantalla con `conteo.ts` del kit (`conteoAcotado()`).
- **Sin conteos exactos para mostrar**: el embudo y los números del resumen salen de `metricas_diarias` o `metricas_persona` (≤ 31 filas por mes). Las listas no muestran total. El banner de correos fallidos cuenta con `limit 10`.
- **Índices** que sostienen cada consulta: los de §3. Búsqueda por email exacto (índice), no por texto libre.
- **Horas disponibles**: una consulta por persona elegible acotada a `[ahora, ahora + horizonte]` usando `reuniones(anfitrion_id, inicio)` y el índice gist de bloqueos; respuesta ≤ 20 KB.
- **Volumen de prueba**: la semilla de rendimiento crea 30.000 solicitudes, 20.000 reuniones, 60.000 notas y 100.000 eventos en el proyecto de pruebas; las pruebas de rendimiento exigen que cada lista responda en < 300 ms en el servidor.
- **Presupuesto por pantalla**: `/` ≤ 170 KB de JavaScript comprimido, LCP ≤ 2,5 s en 4G lenta (Lighthouse móvil ≥ 90 en rendimiento y 100 en accesibilidad); `/agendar` ≤ 4 peticiones al cargar; cada página del panel ≤ 3 peticiones al cargar y ≤ 60 KB de datos.
- Páginas públicas estáticas con revalidación de 1 h (y revalidación inmediata al guardar equipo o datos de la calculadora). Imágenes con `next/image`, AVIF/WebP. Video con `preload="none"` y póster.

## 8. Sistema de diseño

Base: el sistema de diseño «Calesa» del dueño, tal cual (E1, E2, E4, E8). Dirección: sobria, precisa, premium; nunca app barata ni concesionaria. Sin la estética verde y amarilla de «Ruta Importa» (E3). Separa con bordes, no con sombras.

### 8.1 Color (tokens OKLCH; hex de referencia del sistema)

| Token | Claro | Oscuro | Par «sobre» |
|---|---|---|---|
| fondo | oklch(97.1% 0.003 286.4) `#F5F5F7` | oklch(17.6% 0.008 297.0) `#111014` | tinta |
| superficie | oklch(100% 0 0) `#FFFFFF` | oklch(22.2% 0.012 293.1) `#1B1A20` | tinta |
| tinta (texto) | oklch(19.8% 0.013 307.7) `#17141A` | oklch(96.3% 0.005 297.7) `#F3F2F6` | — |
| texto-2 | oklch(46.7% 0.023 292.1) `#5A5866` | oklch(81.9% 0.017 293.7) `#C4C2CE` | — |
| borde | oklch(89.4% 0.010 292.8) `#DCDBE2` | oklch(32.3% 0.018 294.6) `#34323C` | — |
| borde-control | oklch(58.7% 0.023 294.9) `#7D7A89` | oklch(61.8% 0.036 291.0) `#85829A` | — |
| marca (primario de identidad) | oklch(33.5% 0.102 316.7) `#4B2259` | igual | sobre-marca `#FFFFFF` |
| accion (botón principal, enlaces) | oklch(38.7% 0.117 316.4) `#5C2C6D` | oklch(80.4% 0.079 314.3) `#D2B0E3` | sobre-accion `#FFFFFF` / `#17141A` |
| secundario (botón secundario) | = superficie con borde-control | = superficie con borde-control | tinta |
| acento | oklch(89.2% 0.039 210.7) `#BFE3EA` | igual | sobre-acento `#17141A` |
| exito | oklch(42.2% 0.092 156.4) `#145C38` | oklch(66.4% 0.144 156.5) `#2EAD6E` | exito-texto sobre exito-fondo `#E6F0EA` / `#15261D` |
| aviso | oklch(49.5% 0.111 64.9) `#8C5200` | oklch(83.6% 0.132 86.4) `#EFC35A` | aviso-texto sobre aviso-fondo `#F6EDE1` / `#272013` |
| peligro (error) | oklch(57.4% 0.193 10.1) `#D0335E` | oklch(77.6% 0.137 6.5) `#FF8FA8` | error-texto `#B42A52` / tinta sobre error-fondo `#FBE8EE` / `#2A161C` |
| info | oklch(49.0% 0.152 262.1) `#2D5BB5` | oklch(77.6% 0.102 262.7) `#93B6F8` | info-texto sobre info-fondo `#E8EEF9` / `#171F2E` |
| foco | = accion | = accion | — |

`borde-control` es nuevo en la web (no está en el sistema): los bordes de campos y botones secundarios necesitan 3:1 (WCAG 1.4.11) y `borde` da 1,37:1. Se propone sumarlo al sistema de diseño.

**Contraste calculado con código** (fórmula WCAG 2.1, 2026-10-31):
| Par | Claro | Oscuro | Mínimo |
|---|---|---|---|
| tinta / fondo | 16,75 | 17,01 | 4,5 |
| tinta / superficie | 18,24 | 15,51 | 4,5 |
| texto-2 / fondo | 6,38 | 10,79 | 4,5 |
| texto-2 / superficie | 6,95 | 9,84 | 4,5 |
| sobre-accion / accion | 10,31 | 9,61 | 4,5 |
| accion / superficie (enlaces) | 10,31 | 9,10 | 4,5 |
| accion / fondo | 9,47 | 9,98 | 4,5 |
| sobre-acento / acento | 13,37 | 13,37 | 4,5 |
| sobre-marca / marca | 12,56 | 12,56 | 4,5 |
| exito-texto / exito-fondo | 6,88 | 14,20 | 4,5 |
| error-texto / error-fondo | 5,27 | 15,32 | 4,5 |
| aviso-texto / aviso-fondo | 5,45 | 14,47 | 4,5 |
| info-texto / info-fondo | 5,50 | 14,81 | 4,5 |
| error-texto / superficie | 6,19 | 15,51 | 4,5 |
| íconos exito / error / aviso / info sobre superficie | 8,02 / 4,86 / 6,32 / 6,41 | 6,02 / 8,02 / 10,39 / 8,47 | 3 |
| borde-control / superficie | 4,19 | 4,66 | 3 |
| borde-control / fondo | 3,84 | 5,11 | 3 |
Todos pasan. Usos: `marca` en portada de cierre, logo y paneles; `accion` solo en lo que se pulsa; `acento` solo para un dato destacado (el mínimo de la calculadora sobre panel `marca`) y nunca en botones ni estados.

### 8.2 Tipografía

Archivo (Google Fonts, ejes `wdth` 62–125 y `wght` 400–800) para todo; JetBrains Mono (400, 500) para VIN, códigos, rótulos y cifras de tablas. Cargadas con `next/font/google`, `display: swap`.
| Estilo | Tamaño celular / escritorio | Interlineado | Peso | Ancho |
|---|---|---|---|---|
| display | 36 / 56 px | 1,05 | 700 | 125 % |
| titulo-1 | 28 / 40 px | 1,1 | 650 | 125 % |
| titulo-2 | 22 / 28 px | 1,2 | 600 | 100 % |
| titulo-3 | 18 / 20 px | 1,3 | 600 | 100 % |
| texto | 16 / 17 px | 1,55 | 400 | 100 % |
| pequeno | 14 px | 1,5 | 400 | 100 % |
| dato-grande | 32 / 48 px | 1,1 | 700, tabular-nums | 125 % |
| etiqueta | 12 px, MAYÚSCULAS, +0,06 em | 1,3 | 500 | JetBrains Mono |
| codigo | 13,5 px | 1,4 | 400 | JetBrains Mono |
Nunca ancho expandido por debajo de 20 px ni en texto corrido.

### 8.3 Espacio, radios, sombras, breakpoints

- Espacio: múltiplos de 4 px: `espacio-1` 4 · 2 8 · 3 12 · 4 16 · 6 24 · 8 32 · 12 48 · 16 64 · 24 96 (entre secciones en escritorio).
- Radios: `radio-s` 6 (campos), `radio-m` 10 (botones), `radio-l` 16 (tarjetas, tablas), `radio-pildora` 999 (etiquetas de estado). Paneles grandes de marca (portada de cierre, bloque de prueba): esquinas rectas.
- Sombras: ninguna en la página; solo hojas, modales y menús: `0 24px 60px oklch(0% 0 0 / 0.25)`.
- Breakpoints: `sm` 640, `md` 768, `lg` 1024, `xl` 1280; ancho máximo de contenido 1200 px; margen lateral 16 px (celular) y 48 px (escritorio).
- Densidad: web cómoda (filas ≥ 48 px); panel compacta (filas de tabla 44 px).

### 8.4 Movimiento

Curva de entrada `cubic-bezier(0.2, 0.8, 0.2, 1)`, salida `cubic-bezier(0.4, 0, 1, 1)`. Duraciones: micro 150 ms; entradas 300 ms con desplazamiento 16 px de abajo hacia arriba; escalonado 60 ms; cifras 650 ms; transición de página (View Transitions) 250 ms con fundido. Sin rebote, sin elástico. Versión reducida: sin desplazamiento ni cifras animadas, solo cambio inmediato; video en pausa con póster.

### 8.5 Componentes (shadcn/ui adaptado; variantes y estados)

| Componente | Variantes | Estados |
|---|---|---|
| Botón | principal (accion), secundario (superficie + borde-control), fantasma (texto accion), peligro (error) · tamaños 44 y 52 px de alto | normal, hover (−6 % luz), foco (anillo), presionado, desactivado (40 % opacidad, sin puntero), cargando (indicador + texto «Enviando…») |
| Campo de texto / número / email / teléfono | con prefijo (US$, +591), con sufijo (autos, %, personas) | normal, foco (borde accion 2 px), error (borde error + mensaje con ícono), desactivado, solo lectura |
| Selector, casilla, grupo de casillas | — | igual que campo |
| Interruptor segmentado | Mensual / Anual; Lista / Semana | seleccionado (accion), no seleccionado |
| Tarjeta | superficie; marca (plan recomendado) | hover (elevación 2 px solo en escritorio) |
| Etiqueta de estado | nueva (info), agendada (info), realizada (exito), no asistió (aviso), ganada (exito), descartada (texto-2), confirmada, cancelada (error) — siempre ícono + palabra | — |
| Acordeón | — | cerrado, abierto, foco |
| Tabla | normal; comparación (primera columna fija, encabezado pegajoso) | fila hover en panel, vacía, cargando (esqueleto) |
| Calendario de agenda | semana; día con horas | día sin horas (texto-2, desactivado), día con horas, día elegido, hora elegida, hora ocupada al confirmar |
| Gráfica de barras (escala) | 2 barras horizontales, rango en la de Calesa | animada, reducida, con tabla oculta |
| Banner | sin conexión (aviso), correos fallidos (error), borrador legal (aviso) | — |
| Hoja inferior (celular) / modal (escritorio) | — | abierta, cerrándose; foco atrapado; Esc cierra |
| Aviso breve (toast) | éxito, error | 4 s, pausa al pasar el puntero |
| Esqueleto | línea, tarjeta, fila | — |

Formularios: etiqueta arriba, ayuda debajo en `texto-2`, error debajo en `error-texto` con ícono triángulo. Tablas: montos a la derecha, `tabular-nums`, encabezados en estilo `etiqueta`.

### 8.6 Iconografía

Lucide, trazo 2 px, extremos redondeados, cuadrícula 24 px, `currentColor`. Estado: flecha circular (info), reloj (aviso), triángulo (error), check (éxito). Ilustraciones de «Problemas»: SVG de línea hechos para la web, trazo 2 px en `tinta` con un solo relleno `acento`, sin personas (E5).

### 8.7 Bloque CSS del contrato del kit (va a `design/tokens.css`)

`semilla-a-repo` copia este bloque entre las marcas `semilla:inicio` y `semilla:fin` de `design/tokens.css` del kit (X16). Los **nombres** son el contrato del kit, que usan `globals.css`, `src/shared/ui/` y sus reglas; los **valores** son los de Calesa (§8.1). El tema oscuro va como `.dark { … }`: el kit pone esa clase y la hace seguir la preferencia del teléfono (E4). Equivalencias: `primario` = accion · `primario-oscuro` = marca · `paper` = fondo · `surface` = superficie · `ink` = tinta · `ink-soft` = texto-2 · `ink-faint` = texto tenue (5,11:1 en claro, 4,66:1 en oscuro) · `line` = borde · `line-strong` = borde-control · `positivo`/`aviso`/`peligro`/`info` = exito/aviso/error/info, con `-soft` = su fondo y `-ink` = su texto o ícono. Propios de Calesa, fuera del contrato: `--color-marca`, `--color-sobre-marca`, `--color-acento`, `--color-sobre-acento`. Sin sombras en la página (se separa con bordes): solo `--shadow-lg` para hojas y modales.

```css
:root {
  --font-sans: "Archivo", "Arial", sans-serif;
  --font-mono: "JetBrains Mono", "Consolas", monospace;
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.75rem;
  --text-2xl: 2.25rem;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-card: 16px;
  --radius-pill: 999px;
  --fila-compacta: 44px;
  --fila-comoda: 48px;
  --sidebar: 15.5rem;
  --topbar: 3.5rem;
  --color-primario: oklch(38.7% 0.117 316.4);
  --color-primario-oscuro: oklch(33.5% 0.102 316.7);
  --color-primario-soft: oklch(38.7% 0.117 316.4 / 0.12);
  --color-primario-ink: oklch(38.7% 0.117 316.4);
  --color-sobre-primario: oklch(100% 0 0);
  --color-paper: oklch(97.1% 0.003 286.4);
  --color-paper-soft: oklch(98.5% 0.002 286.4);
  --color-paper-dim: oklch(95.5% 0.004 290);
  --color-surface: oklch(100% 0 0);
  --color-surface-2: oklch(98.2% 0.003 290);
  --color-surface-3: oklch(96.2% 0.005 292);
  --color-ink: oklch(19.8% 0.013 307.7);
  --color-ink-soft: oklch(46.7% 0.023 292.1);
  --color-ink-faint: oklch(53.9% 0.023 294.8);
  --color-line: oklch(89.4% 0.01 292.8);
  --color-line-strong: oklch(58.7% 0.023 294.9);
  --color-overlay: oklch(19.8% 0.013 307.7 / 0.45);
  --color-positivo: oklch(42.2% 0.092 156.4);
  --color-positivo-soft: oklch(94.6% 0.013 159.9);
  --color-positivo-ink: oklch(42.2% 0.092 156.4);
  --color-aviso: oklch(49.5% 0.111 64.9);
  --color-aviso-soft: oklch(95% 0.019 75.3);
  --color-aviso-ink: oklch(49.5% 0.111 64.9);
  --color-peligro: oklch(57.4% 0.193 10.1);
  --color-peligro-soft: oklch(94.8% 0.022 356.3);
  --color-peligro-ink: oklch(51.5% 0.174 9.1);
  --color-info: oklch(49% 0.152 262.1);
  --color-info-soft: oklch(94.8% 0.016 262.8);
  --color-info-ink: oklch(49% 0.152 262.1);
  --shadow-sm: none;
  --shadow-md: none;
  --shadow-lg: 0 24px 60px oklch(0% 0 0 / 0.25);
  --shadow-focus: 0 0 0 2px var(--color-paper), 0 0 0 4px var(--color-primario);
  --dur-rapida: 150ms;
  --dur-normal: 300ms;
  --dur-pagina: 250ms;
  --ease-salida: cubic-bezier(0.2, 0.8, 0.2, 1);
  --color-marca: oklch(33.5% 0.102 316.7);
  --color-sobre-marca: oklch(100% 0 0);
  --color-acento: oklch(89.2% 0.039 210.7);
  --color-sobre-acento: oklch(19.8% 0.013 307.7);
}

.dark {
  --color-primario: oklch(80.4% 0.079 314.3);
  --color-primario-soft: oklch(80.4% 0.079 314.3 / 0.18);
  --color-primario-ink: oklch(80.4% 0.079 314.3);
  --color-sobre-primario: oklch(19.8% 0.013 307.7);
  --color-paper: oklch(17.6% 0.008 297);
  --color-paper-soft: oklch(19.5% 0.009 296);
  --color-paper-dim: oklch(15.5% 0.007 297);
  --color-surface: oklch(22.2% 0.012 293.1);
  --color-surface-2: oklch(25.5% 0.014 293);
  --color-surface-3: oklch(29% 0.016 294);
  --color-ink: oklch(96.3% 0.005 297.7);
  --color-ink-soft: oklch(81.9% 0.017 293.7);
  --color-ink-faint: oklch(61.8% 0.036 291);
  --color-line: oklch(32.3% 0.018 294.6);
  --color-line-strong: oklch(61.8% 0.036 291);
  --color-overlay: oklch(0% 0 0 / 0.6);
  --color-positivo-soft: oklch(25% 0.029 160.3);
  --color-positivo-ink: oklch(66.4% 0.144 156.5);
  --color-aviso-soft: oklch(24.8% 0.025 82.5);
  --color-aviso-ink: oklch(83.6% 0.132 86.4);
  --color-peligro-soft: oklch(23% 0.034 0.7);
  --color-peligro-ink: oklch(77.6% 0.137 6.5);
  --color-info-soft: oklch(23.9% 0.031 262.6);
  --color-info-ink: oklch(77.6% 0.102 262.7);
  --shadow-lg: 0 24px 60px oklch(0% 0 0 / 0.55);
}
```

## 9. Técnica

### 9.1 Arquitectura y por qué

El repo sale del **kit** de `semilla-a-repo` (X17): Next.js 16 App Router como monolito modular, Supabase, Tailwind 4 con shadcn en `src/shared/ui`, Zod 4, `next-safe-action`, Vitest, Playwright, ESLint con fronteras y las guardas, el coordinador y el piloto ya hechos. Esta semilla no reconstruye nada de eso: agrega los módulos de Calesa y adapta lo compartido. Rigen `AGENTS.md` y `.claude/rules/*` del kit; si esta semilla y una regla del kit chocan, manda la regla del kit y el choque se anota en `docs/pasos/<PASO>/decisiones.md`.

- Páginas públicas estáticas con revalidación (baratas y rápidas); panel renderizado en el servidor con sesión de Supabase (`getClaims()`).
- **Mutaciones del panel**: Server Actions con `actionClient` de `@/shared/lib/safe-action`, permiso con `puede(ctx.permisos, clave, alcance)` y, otra vez, la base (RLS o RPC).
- **Escrituras públicas** (formulario, reservas, gestión de reunión, eventos, WhatsApp), **webhook y cron**: route handlers en `src/app/api/` que validan Turnstile, límite, token o secreto y usan el cliente admin **solo para llamar la RPC pública que les toca**; nunca leen tablas del negocio (regla `datos.md` del kit). Estos archivos se agregan a `DONDE_SE_PERMITE_EL_ADMIN` de `eslint.config.mjs` en P01.
- Lo que cambia estado, dueño, dinero o fórmulas se escribe **solo por RPC** `security definer` (§3).
- Correo: solo por `enviarEmail()` de `@/shared/lib/email`, con un adaptador nuevo `resend` (`EMAIL_PROVEEDOR=resend`) que además programa y cancela (X6).
- Vercel Pro (R4.6) con un solo cron diario; Supabase gratis con respaldo propio (X13). Costo ~US$ 20/mes (G1).
- Sin PWA (F1): el `manifest.ts` del kit se conserva solo para el ícono y el color.

### 9.2 Módulos (`src/modules/<módulo>/`, con `CLAUDE.md`, `index.ts`, `client.ts`, `pantallas/`, `entities/`, `features/`, `infra/`)

| Módulo | Qué hace | Tablas | Depende de |
|---|---|---|---|
| `acceso` | perfiles, catálogo de permisos y `puede()`, entrar con enlace mágico, invitaciones, usuarios, perfil, marco del panel, resumen y actividad | perfiles, invitaciones, permisos, permisos_rol, auditoria | `medicion` |
| `planes` | precios y planes (§5.4): tarjetas y tabla | — (constantes en `entities/`) | — |
| `calculadora` | fórmulas de fugas y de escala (§5.2, §5.3), calculadora pública, gráfica de escala, configuración del panel | config_calculadora | `solicitudes` (detalle por correo) |
| `solicitudes` | estados (§5.7), juntar repetidas, formulario de demo, lista y detalle del panel, notas | solicitudes, notas | `agenda`, `notificaciones` |
| `agenda` | horas disponibles y reparto parejo (§5.5, §5.6), reservar, cambiar, cancelar, reuniones del panel, disponibilidad y bloqueos | reuniones, horario_base, config_agenda, bloqueos | `notificaciones` |
| `notificaciones` | las 12 plantillas de §6.8, enviar, programar, cancelar y reprogramar; registro de correos | correos_salientes | — |
| `prospeccion` | enlaces con código | enlaces_prospeccion | — |
| `equipo` | sección pública «Quiénes somos» y su gestión | equipo, storage `equipo` | — |
| `medicion` | eventos, métricas, embudo, cupos gratis y latidos | eventos, metricas_diarias, metricas_persona, latidos, limites | — |
| `sitio` | contenido de las páginas públicas, maquetas con el auto ficticio, ilustraciones, SEO | — | `planes`, `calculadora`, `equipo` (por sus `pantallas/`) |

Dependencias en un solo sentido, sin ciclos (`agenda` no importa `solicitudes`: recibe el id y los datos que necesita).

### 9.3 Rutas

- Públicas: `src/app/(sitio)/` → `/`, `/planes`, `/privacidad`, `/terminos`; `src/app/agendar/` → `/agendar`; `src/app/reunion/[token]/` → `/reunion/<token>`; `src/app/entrar/` → `/entrar`.
- Panel: `src/app/(app)/` (layout con el marco del panel de `acceso/shell.ts`) → `/panel`, `/panel/solicitudes`, `/panel/reuniones`, `/panel/disponibilidad`, `/panel/perfil`, `/panel/prospeccion`, `/panel/equipo`, `/panel/calculadora`, `/panel/usuarios`, `/panel/actividad`. `src/proxy.ts` del kit protege `/panel`.
- API: `/api/solicitudes`, `/api/reservas`, `/api/horas`, `/api/whatsapp`, `/api/eventos`, `/api/cron/diario`, `/api/webhooks/resend`.
- `src/app/sitemap.ts`, `robots.ts`, `opengraph-image.tsx`.

### 9.4 Carriles y OWNERS

| Carril | Dueño de |
|---|---|
| base | package.json, pnpm-lock.yaml, next.config.ts, eslint.config.mjs, .env.example, .github/, src/app/layout.tsx, src/app/globals.css, src/app/not-found.tsx, src/app/manifest.ts, src/shared/config/, src/shared/lib/, src/shared/ui/, src/shared/CLAUDE.md, design/, public/marca/, e2e/base/ |
| datos | supabase/, src/shared/types/ |
| calculadora | src/modules/calculadora/, src/modules/planes/, src/app/(app)/panel/calculadora/, e2e/calculadora/ |
| ventas | src/modules/agenda/, src/modules/solicitudes/, src/app/agendar/, src/app/reunion/, src/app/api/solicitudes/, src/app/api/reservas/, src/app/api/horas/, src/app/(app)/panel/solicitudes/, src/app/(app)/panel/reuniones/, src/app/(app)/panel/disponibilidad/, e2e/ventas/ |
| notificaciones | src/modules/notificaciones/ |
| sitio | src/modules/sitio/, src/app/(sitio)/, src/app/sitemap.ts, src/app/robots.ts, src/app/opengraph-image.tsx, public/media/, public/ilustraciones/, e2e/sitio/ |
| equipo | src/modules/equipo/, src/modules/prospeccion/, src/app/(app)/panel/equipo/, src/app/(app)/panel/prospeccion/, e2e/equipo/ |
| tareas | vercel.json, src/modules/medicion/, src/app/api/whatsapp/, src/app/api/eventos/, src/app/api/cron/, src/app/api/webhooks/, e2e/tareas/ |
| acceso | src/modules/acceso/, src/proxy.ts, src/app/(app)/layout.tsx, src/app/(app)/_shell/, src/app/(app)/panel/page.tsx, src/app/(app)/panel/usuarios/, src/app/(app)/panel/perfil/, src/app/(app)/panel/actividad/, src/app/entrar/, e2e/acceso/ |
| calidad | e2e/flujos/, e2e/rendimiento/, e2e/accesibilidad/ |
| lanzamiento | infra/ |
Un carril importa de otro solo por las entradas del módulo (`index.ts`, `client.ts`, `pantallas/`); cambiar un módulo de otro carril es una compuerta `afuera`. `docs/pasos/<PASO>/` lo escribe cada paso. `CARRILES_MAX = 3`.

### 9.5 Entornos y variables

- Local y carriles: el stack del kit (Supabase local por bloque y por carril, Mailpit para correo con `EMAIL_PROVEEDOR=mailpit`).
- Vista previa (cada rama en Vercel): proyecto Supabase de pruebas (gratis).
- Producción: proyecto Supabase gratis (X13); dominio `calesa.app` (F6); Resend con `getcalesa.com` verificado (SPF, DKIM, DMARC) (F4).
- Variables: las de §4, declaradas en `src/shared/config/esquemas.ts` y `.env.example` (P01); `pnpm env:check` dice qué falta.

### 9.6 Integraciones

- **Resend** (X6): adaptador `resend` en `src/shared/lib/email/adaptadores/`, con `scheduledAt` para recordatorios y aviso de 15 min, `cancel` y `update` al cambiar o cancelar; webhook de rebotes y fallos (R5.3); SMTP de Resend en Supabase Auth para enlaces de acceso e invitaciones (X9). En local y e2e, Mailpit del kit y un registro de programaciones en `correos_salientes`.
- **Cloudflare Turnstile**: widget en formulario y detalle de calculadora; verificación en el route handler antes de cualquier escritura (C7).
- **Vercel Cron**: un solo trabajo en `vercel.json`, `0 7 * * *` (03:00 La Paz) → `/api/cron/diario`; Vercel envía `Authorization: Bearer CRON_SECRET`; solo en producción. En e2e se llama con reloj fijo (R4.22).
- **GitHub Actions** (X13): `respaldo-diario.yml` (04:00 La Paz) hace `pg_dump` de producción, lo cifra con `age` y lo guarda como artefacto 30 días; `restauracion-semanal.yml` restaura el último respaldo en un Postgres temporal y comprueba que las tablas existan y que haya solicitudes.
- **Supabase gratis**: se mantiene activo con las visitas y la tarea diaria; R5.2 avisa antes de los límites.
- **Vercel Web Analytics**: solo visitas, sin cookies (C6, X7).
- **WhatsApp**: enlaces `wa.me`, sin API (D3).
- **Eventos de medición**: los componentes marcan con `data-evento` o emiten `calesa:evento`; un oyente en el layout del sitio los envía a `POST /api/eventos` (solo `clic_agendar` y `calculadora_usada`); los demás los escribe la RPC del caso (F8, X7).
- Fuera de v1: Google Calendar (R2.5).

### 9.7 Datos de demo y pruebas

- `supabase/seed.sql`: config_agenda, horario_base (B11), config_calculadora (§3), equipo con el fundador. Catálogo de permisos y `permisos_rol` en su migración con `insert … on conflict` (regla del kit). La cuenta del admin se crea con `pnpm admin:crear` (script de P14) usando `auth.admin` con `ADMIN_EMAIL`, y su rol se asigna por RPC (X12).
- Pruebas de base en `supabase/tests/*.sql`, que corre `pnpm db:probar`: `rls-calesa.sql` (las 47 filas de §4), `reservas.sql`, `retencion.sql`, `estados.sql`, con un usuario simulado por rol (A, V1, V2, V3) y los datos S1, S2, R1, E1, E2, enlace `GT-02`.
- e2e en `e2e/<carril>/` con los soportes del kit (`e2e/soporte/`), reloj fijo `ahora = lun 2 nov 2026 08:00 America/La_Paz` inyectado por `TIEMPO_FIJO` solo en pruebas, correo leído de Mailpit y de `correos_salientes`. Las maquetas de la web usan el auto ficticio de G3.

### 9.8 Respaldos y reversión

Supabase gratis no ofrece respaldos diarios descargables: el respaldo diario cifrado de GitHub Actions (30 días) cubre producción y la restauración semanal automática prueba que sirve (X13). Las migraciones siguen la regla del kit: una que entró a `main` no se edita; un cambio es una migración nueva. Antes de migrar producción se dispara a mano el flujo `respaldo-diario.yml` (paso de la lista de lanzamiento). Vercel permite volver al despliegue anterior con un clic.

### 9.9 Monitoreo

Logs de Vercel y de Supabase. Un correo inmediato que falla se reintenta 2 veces en la misma petición; si sigue fallando, o si Resend avisa por webhook que un programado falló o rebotó (R5.3), queda `fallido`: banner en el panel y aviso `correo-fallido`; la tarea diaria reintenta los fallidos una vez más (F10). La tarea diaria escribe en `latidos`; si no tuvo éxito en 26 h, el admin ve el banner de §6.5 (R4.22). R5.2 avisa al acercarse a los límites gratis.

## 10. Verificación

Los comandos son los del kit (`AGENTS.md` › Comandos y «Terminado significa»).
- **Nivel 1** (cada paso): `pnpm lint && pnpm typecheck && pnpm test`, más `pnpm db:probar` si tocó `supabase/`, más `pnpm test:e2e e2e/<carril>/` si tocó pantallas, y `bash scripts/mapa.sh --check`.
- **Nivel 2** (los seis disparadores del kit: cada 3 pasos sin e2e completo, o al tocar código compartido, auth, RLS, layout o esquema base): lo anterior más `pnpm db:reset && pnpm db:types && pnpm db:probar && pnpm test:e2e:completo`.
- **Nivel 3** (cierre de fase, merge a `main`, despliegue): nivel 2 más accesibilidad (axe en todas las rutas) y rendimiento con volumen.
- Cobertura obligatoria: cada fórmula de §5 con sus ejemplos (test al lado de `entities/`); cada fila de la matriz RLS de §4 en `supabase/tests/`; cada pantalla de §6.5 con sus estados (e2e con capturas de vacío, error, sin permiso y sin conexión, en claro y oscuro, en los proyectos `escritorio` y `movil` del kit).
- **Ninguna prueba manual del dueño.** Lo que sería «pruébalo tú» es un e2e o un recorrido de la IA con capturas, anotado en `docs/pasos/<PASO>/bitacora.md`.

## 11. Glosario

Es el contenido de `docs/GLOSARIO.md`.
- **Solicitud**: datos que deja un visitante (formulario, calculadora o enlace de prospección).
- **Reunión** o **demo**: videollamada de 30 min agendada en la web.
- **Anfitrión**: persona del panel que atiende una reunión.
- **Asignado**: persona del panel responsable de una solicitud.
- **Reparto parejo**: regla que da la siguiente reunión o solicitud a quien menos tiene esa semana (§5.6).
- **En turno**: usuario que puede recibir reuniones, solicitudes y clics de WhatsApp.
- **Horario común**: tramos semanales en hora de Bolivia en que se ofrecen horas.
- **Bloqueo**: periodo en que una persona no puede recibir reuniones.
- **Enlace de prospección**: `calesa.app/agendar?ref=CODIGO`, que asigna al vendedor que lo creó.
- **Fuga**: dinero que la importadora pierde al mes por una causa (§5.2).
- **Escenario mínimo / máximo**: cálculo con el extremo bajo o alto de cada supuesto.
- **Cuota mensual**: pago mensual del plan (servidor, seguridad, mantenimiento, soporte).
- **Implementación**: pago único por configurar el sistema a la importadora.
- **Origen de compra**: Copart, IAAI, Manheim, Japón, Corea o China.
- **UTM**: parámetros del enlace que dicen de qué campaña vino una visita.
- **Embudo**: solicitudes → reuniones → ganadas del mes.
- **Bandeja de salida**: tabla de correos pendientes que la tarea por minuto envía.

## 12. Plan de ejecución (resumen de `plan.yaml`)

22 pasos en 11 carriles, con 3 carriles a la vez (`CARRILES_MAX`). Cada paso es una rama `<carril>/<paso>` y un PR; el coordinador del kit entrega el siguiente paso cuando sus dependencias están en `main`.
**Fase 1 · Cimientos**: P01 adaptar la base del kit (rojo). Después, en paralelo: P02 esquema y permisos (rojo), P03 fórmulas y precios (rojo), P04 reglas de agenda y solicitudes (ámbar).
**Fase 2 · Servicios**: P05 RPC y triggers (rojo), P06 seguridad compartida (rojo), P07 notificaciones (ámbar), P20 equipo y prospección (ámbar).
**Fase 3 · Producto público**: P11 flujo de agenda (rojo), P09 calculadora, planes y prueba (rojo), P08 sitio (ámbar), P10 legal (rojo), P12 medición y WhatsApp (ámbar), P13 tarea diaria y webhook (rojo).
**Fase 4 · Panel**: P14 acceso (rojo), P15 ventas (ámbar), P16 equipo y prospección (rojo), P21 datos de la calculadora (rojo), P17 SEO (verde).
**Fase 5 · Cierre**: P18 calidad completa (ámbar), P19 lanzamiento (rojo).

## 13. Política de compuertas

- **Rojo — siempre pregunta al celular** y espera respuesta: guardas del piloto (modelo, effort, carpeta); datos, RLS, migraciones; dinero y fórmulas, y textos con cifras de dinero o del cliente real (H2); textos legales; reglas que mandan parar; despliegue a producción y DNS; pasar el tope de cuota (40 % de la ventana de 5 h o 20 % del semanal, H3).
- **Ámbar — elige la recomendada a los 5 minutos** (`piloto_auto_min`, H4) y lo anota en `docs/pasos/<PASO>/decisiones.md` (regla del kit: no hay docs compartidos).
- **Verde — no pregunta.**
- Horario de preguntas: lunes a viernes 9:00–19:00, hora de Bolivia (H5). Fuera de horario, lo rojo espera.

**Reglas de interfaz por defecto** (para que lo ámbar casi nunca haga falta): usar los componentes de §8.5 sin inventar variantes; todo texto nuevo sigue §6 y la guía de voz; si falta un estado, usar el patrón de §6.5; espacios en múltiplos de 4; un solo botón principal por vista; enlaces en `accion` subrayados al pasar; íconos Lucide; montos con `formatoUSD`; fechas con el formato de §5.1; en celular, acciones principales al alcance del pulgar (abajo); ninguna animación que no esté en §8.4; si una decisión no está aquí ni en el registro, elegir lo más simple que cumpla §6 y anotarlo.

## 14. Registro de decisiones

Copia de `registro.md` al cerrar la versión 7 (todas cerradas o recomendado aceptado).

| ID | Tema | Decisión | Fuente |
|---|---|---|---|
| A0.1 | Público | Dueños de importadoras de autos en Latinoamérica, en español | dueño |
| A0.2 | Prueba social | «Ya funciona en una de las importadoras más grandes de Bolivia: 35 asesores y unos 40 autos al mes.» Sin nombre | dueño (R1) |
| A0.3 | Precios | Tarjetas con cuota mensual al frente; /planes con tabla: mensual, anual (12 por 10, con ahorro) e implementación (US$ 4.500 / 12.000 / 25.000 / desde 60.000) + todo lo que incluye cada plan | dueño (R1, R2) |
| A0.4 | Consultas | Base propia + aviso + WhatsApp + agenda propia estilo Calendly | dueño |
| A0.5 | Fuera de v1 | Fuera: testimonios inventados, cupos falsos, blog, otros idiomas. **Dentro:** tabla completa de precios | dueño |
| A1 | Objetivo | Reuniones de demo agendadas con dueños | dueño |
| A2 | Cifras cliente | 35 asesores, ~40 autos/mes, publicables sin nombre | dueño |
| A3 | Éxito | 15 solicitudes/mes → 10 reuniones/mes → ≥2 ventas en 3 meses; el panel muestra el embudo | dueño (R2) |
| A4 | Origen | Redes + prospección directa; enlace de agenda con código (calesa.app/agendar?ref=CODIGO) creado desde el panel, marca «prospección» y asigna al vendedor que lo creó | dueño (R2) |
| A5 | Mercado | Hispanoamérica, Bolivia como ejemplo | dueño |
| A6 | Quiénes somos | Andrés Eduardo Rosas Alpiri, desarrollador y fundador de Calesa: «Estudié decenas de importadoras, de Bolivia a Centroamérica, y en todas vi lo mismo: consultas que se enfrían en WhatsApp, cotizaciones armadas a mano y clientes que llaman para saber dónde está su auto. Construí Calesa para que una importadora venda más y funcione igual aunque cambien las personas.» | dueño (R2) |
| B1 | Páginas | Inicio largo + Planes, Agendar, Privacidad, Términos; fácil de navegar, transiciones animadas | dueño |
| B1.1 | Transiciones | Transiciones entre páginas y entradas al hacer scroll, sobrias (E7), apagadas con movimiento reducido | Claude (concilia B1 y E7) |
| B2 | Secciones inicio | Las 10 en el orden propuesto; «Planes» en el inicio muestra tarjetas y enlaza a /planes con tabla completa | dueño + Claude |
| B3 | Titular | «Vende más autos sin perder el control.» | dueño |
| B4 | Calculadora | 5 datos; supuestos de la Radiografía (rangos, mínimo de titular, etiqueta «estimación»); los datos que no pide toman los valores por defecto de la Radiografía y se muestran en «cómo se calculó» | dueño (R2) |
| B5 | Contacto en calculadora | No pide nada antes; ofrece detalle por correo y agendar | dueño |
| B6 | Cifra de planes | Cuota mensual al frente (Vitrina US$ 490, Operación US$ 1.290, Completo US$ 2.900, Grupo desde US$ 5.500) | dueño (R1) |
| B7 | Texto de plan | Tamaño, 3–4 líneas, plazo | dueño |
| B8 | Formulario | Nombre, importadora, país, WhatsApp, email, autos/mes hoy, autos/mes en 3 meses, vendedores, administración y logística, orígenes; gráfica «Crecer sin contratar» con la fórmula de escala de la Radiografía (capacidad +30–60 % operación, +10–20 % ventas) | dueño (R2, R3) |
| B9 | Después del formulario | Agenda directa; alternativa WhatsApp | dueño |
| B10 | Duración | 30 min | dueño |
| B11 | Horario | L–V 9–12 y 14–18, America/La_Paz, editable | dueño |
| B12 | Reglas agenda | Mín. 12 h, máx. 21 días, 15 min entre reuniones, máx. 4/día | dueño |
| B13 | Lugar reunión | v1: enlace de Meet fijo de cada vendedor (lo carga él en el panel). Google Calendar con Meet único por reunión pasa a v2 | dueño (R2) |
| B14 | Calendario real | v1: bloqueos a mano; cada vendedor bloquea solo sus horas, el admin las de cualquiera. Lectura de Google Calendar pasa a v2 | dueño (R2) |
| B15 | Cambiar/cancelar | Enlace en el correo, hasta 2 h antes | dueño |
| B16 | Recordatorios | Confirmación con .ics, 24 h y 1 h antes, por correo | dueño |
| B17 | Avisos | Correo por cada solicitud y cambio de reunión | dueño |
| B18 | Panel | Solicitudes y reuniones con estado, notas, horarios y bloqueos | dueño |
| B19 | Usuarios panel | Vendedores por invitación por correo; roles fijos admin y vendedor. (Lo de «crear contraseña» queda reemplazado por F5) | dueño (R1) |
| B20 | Enlace a app | Sin enlace: la app es privada y la demo se ve en la reunión | dueño |
| B21.1 | FAQ datos | «En servidores en la nube, cifrados, con respaldos diarios. Los datos son de tu importadora.» | dueño (R1) |
| B21.2 | FAQ exportar y capacidad | Exporta e importa en CSV. Sin cifra de usuarios: «Crece contigo: el mismo sistema sirve con 5 o con 500 autos al mes, sin cambiar de herramienta.» | dueño (R1) |
| B21.3 | FAQ continuidad | Recibe el código actualizado y su documentación; puede usarlo, modificarlo y contratar a otro programador; no puede revenderlo; va en el contrato (revisar con abogado). El extra «Código fuente, uso interno» sigue a la venta | dueño (R1) |
| B21.4 | FAQ plazos | Demo 30 min; 2 / 3–4 / 4–6 / 8–12 semanas | dueño |
| B21.5 | FAQ país | Sí, se configuran aduana e impuestos del país | dueño |
| C1 | Datos guardados | Formulario, reunión, UTM; calculadora solo si pide detalle | dueño |
| C2 | Retención | 24 meses desde último contacto | dueño |
| C3 | Borrado | Correo de privacidad; se borra desde el panel | dueño |
| C4 | Consentimiento | Casilla obligatoria con enlace a Privacidad | dueño |
| C5 | Textos legales | Borrador «revisar con abogado». Calesa no está constituida: responsable Andrés Eduardo Rosas Alpiri, con domicilio en Santa Cruz de la Sierra, Bolivia; ley y tribunales de Bolivia; el abogado aprueba y confirma si hace falta la dirección completa; se cambia cuando haya razón social | dueño (R1, 12:00) |
| C6 | Analítica | Vercel Web Analytics, sin cookies | dueño |
| C7 | Spam | Turnstile + límite por IP | dueño |
| D1 | Recorridos | Los 5 confirmados | dueño |
| D2 | Dispositivo | Celular primero | dueño |
| D3 | WhatsApp | Mensaje «Hola, vengo de calesa.app y quiero ver una demo con mis autos.»; el botón abre el WhatsApp del vendedor que toca por turno (no hay número general) | dueño (R3) |
| D4 | Estados | Cargando, vacío, error con reintento, sin conexión, agenda sin horas | dueño |
| D5 | Accesibilidad | WCAG 2.1 AA | dueño |
| D6 | Idioma | Español neutro, tú | dueño |
| E1 | Base visual | Sistema de diseño Calesa | dueño |
| E2 | Adjetivos | Sobria, precisa, premium | dueño |
| E3 | Ruta | Sin estética de ruta; se reusan estructura y textos | dueño |
| E4 | Temas | Claro + oscuro automático | dueño |
| E5 | Portada | Combina las 3: video del dueño (con póster de respaldo), capturas animadas en «El sistema», ilustraciones lineales de marca en «Problemas» | dueño + Claude |
| E6 | Fotos | Retrato del fundador + equipo, editable desde el panel | dueño |
| E7 | Animación | Sobria | dueño |
| E8 | Logo | Archivos del sistema de diseño | dueño |
| F1 | Stack | Next.js + TS + Tailwind + shadcn/ui + Zod + Supabase + Vercel, pnpm, sin PWA | dueño |
| F2 | Aislamiento | Repo y Supabase nuevos solo para la web | dueño |
| F3 | Textos | En archivos del repositorio | dueño |
| F4 | Correo | Resend con dominio getcalesa.com (redirige al dueño). Claude elige: envía `hola@getcalesa.com`, avisos a `equipo@getcalesa.com`, privacidad `privacidad@getcalesa.com` | dueño («elige tú») |
| F5 | Acceso | Enlace mágico por correo para todos (admin y vendedores); solo entran correos invitados | dueño (R1) |
| F6 | Dominio | calesa.app = esta web; la demo vive en demo.calesa.app y se adapta por cliente; panel en calesa.app/panel sin enlace público | dueño + Claude |
| F7 | SEO | Completo | dueño |
| F8 | Medición | UTM, origen y eventos | dueño |
| F9 | Entornos | Vista previa + producción; Supabase pruebas y producción | dueño |
| F10 | Monitoreo | Logs de Vercel + correo si falla un aviso | dueño |
| G1 | Presupuesto | ~US$ 20/mes (estimación): solo Vercel Pro (el plan gratis no permite uso comercial); Supabase, Resend (3.000 correos/mes, 100/día) y Turnstile en plan gratis; ningún proceso corre si no hace falta | dueño (R5) |
| G2 | Plazo | Lo antes posible | dueño |
| G3 | Datos demo | Auto ficticio de «Guiones» | dueño |
| H1 | Agentes | Solo Claude | dueño |
| H2 | Rojas extra | Textos con cifras de dinero o del cliente, y legales | dueño |
| H3 | Tope cuota | 40 % ventana 5 h, 20 % semanal | dueño |
| H4 | Piloto auto | 5 min | dueño |
| H5 | Horario revisión | L–V 9–19 Bolivia | dueño |
| X1 | Zona horaria visitante | La agenda muestra las horas en la zona del visitante (detectada, con selector) | Claude |
| X2 | Tipos de reunión | Un tipo («Demo 30 min») en v1; el modelo admite más | Claude |
| R1.1 | Otras formas de pago | Solo se mencionan (compra de licencia, pago en hitos, extras) sin montos: «te lo detallamos en la propuesta» | dueño (R1) |
| R1.2 | Anfitrión de demos | Turnos entre vendedores con reparto parejo (entre los libres, quien tenga menos reuniones esa semana); el admin solo si ningún vendedor está libre; horario común editable por el admin, el admin puede pausar vendedores | dueño (R1, R2) |
| R1.3 | Cuentas Google | v1 sin Google; v2 conecta Gmail personales con trámite de verificación de Google | dueño (R2) |
| R1.4 | Permisos vendedor | Solo ve y atiende lo asignado a él: cambia estado, notas, reagenda; no configura ni borra | dueño (R1) |
| R2.1 | Solicitudes sin reunión | Se asignan al llegar con reparto parejo y el vendedor recibe aviso | dueño (R2) |
| R2.2 | Enlace de prospecto | La agenda de un enlace con código muestra solo las horas del vendedor que lo creó | Claude (deriva de A4) |
| R2.3 | Reagendar | Si el visitante cambia la hora, se mantiene el mismo vendedor si está libre; si no, reparto parejo | Claude |
| R2.4 | Sección Equipo | La edita solo el admin (fotos, nombre, cargo, orden, visible) | Claude (deriva de R1.4: el vendedor no configura) |
| R2.5 | Fuera de v1 | Integración con Google Calendar (Meet único, ocultar ocupados, verificación de Google) → v2 | dueño (R2) |
| R3.1 | Turno de WhatsApp | El botón público pasa por /api/whatsapp: elige con reparto parejo (clics de la semana), registra el evento sin datos personales y redirige a wa.me; si nadie está disponible, redirige a /agendar con aviso (R4.10). Tras el formulario, abre el WhatsApp del vendedor asignado | Claude (deriva de D3) |
| R3.2 | Perfil de usuario | Cada usuario del panel tiene nombre, WhatsApp (obligatorio para entrar al turno) y enlace de Meet | Claude (deriva de B13, D3) |
| R3.3 | Vendedor desactivado | Al pausar o desactivar, sale del turno; sus reuniones futuras y solicitudes abiertas pasan al reparto parejo y el admin recibe aviso | Claude |
| R3.4 | Borrado por retención | Tarea diaria borra solicitudes sin contacto hace 24 meses (C2) | Claude (deriva de C2) |
| B4.1 | Datos de la calculadora | Los datos que la calculadora no pide (precio promedio, % vendidos con seña, seña, cobro en moneda local sí/no, % cobrado en moneda local, volatilidad, sueldo por persona, costo del dinero, días de ciclo) se editan desde el panel; los rangos de supuestos quedan fijos en código | dueño (11:37) |
| B4.2 | Quién edita la calculadora | Solo el admin (el vendedor no configura, R1.4) | Claude (deriva de R1.4) |
| B4.3 | 5.º dato de la calculadora | «Personas en administración y logística»: es el único dato de equipo que usa el cálculo de fugas de la Radiografía | Claude (deriva de B4 y de la fórmula) |
| B8.1 | Meta del formulario | Autos en 3 meses ≥ autos hoy; si es igual, la gráfica muestra «Con la misma cantidad no necesitas contratar»; si es menor, error de validación | Claude |
| X3 | Formato de estimaciones y precios | Montos sin decimales, redondeo al entero más cercano (mitad hacia arriba), «US$ 4.452»; igual que en «Planes Calesa» y la Radiografía | Claude (deriva de artefactos del dueño) |
| X4 | Estado «ganada» | La solicitud suma el estado «ganada» para que el panel muestre el embudo de A3 (solicitudes → reuniones → ventas) | Claude (deriva de A3) |
| X5 | Aviso de solicitud sin reunión | La solicitud se asigna al crearse; el vendedor recibe el aviso de «solicitud sin reunión» solo si a los 15 min no agendó; al agendar se prefiere al vendedor asignado si está libre | Claude (concilia R2.1 y R1.2) |
| X6 | Correos y tareas | Sin cron por minuto: los correos salen en el momento de la acción; recordatorios de 24 h y 1 h y el aviso de 15 min se programan en Resend (hasta 30 días antes) y se cancelan o reprograman si la reunión cambia; un solo cron diario de Vercel para retención, reintentos y limpieza | dueño (R5: «no me gusta el cron cada minuto») |
| X7 | Eventos de medición | Los eventos (F8) se guardan en tabla propia, ligados a UTM y solicitudes; Vercel Web Analytics cuenta visitas sin cookies | Claude (deriva de C6, F8) |
| X8 | Imágenes del sistema | v1 usa maquetas de interfaz hechas en código con el auto ficticio (G3); las capturas reales de demo.calesa.app las reemplazan cuando el dueño las entregue | Claude (deriva de E5, B20) |
| X9 | Correo de acceso | Los enlaces mágicos e invitaciones de Supabase salen por el SMTP de Resend con el dominio getcalesa.com | Claude (deriva de F4, F5) |
| X10 | Horas ofrecidas | Inicios cada 30 min dentro del horario; el máximo de 4 reuniones por día es por persona | Claude (deriva de B10–B12) |
| X11 | Exceso de autos | La regla de «Planes Calesa» (US$ 25 por auto extra si pasas el tope 3 meses seguidos) **no se muestra en la web**; queda para la propuesta | dueño (12:00) |
| X12 | Admin | Hay un solo admin (Andrés), creado por la semilla de datos; las invitaciones siempre crean vendedores | Claude (deriva de B19) |
| X13 | Plan de Supabase | Gratis en producción y pruebas; respaldo diario cifrado con GitHub Actions (se guarda 30 días) y restauración automática semanal de prueba; pasar a Pro cuando haya ventas o la base pase 400 MB (aviso automático) | dueño (R5) |
| X14 | Cuenta del admin | El admin entra con alpiryk@gmail.com (ADMIN_EMAIL) | dueño (12:00) |
| R4.1 | Vendedor y sus reuniones | Reagenda y cancela las suyas; al reagendar sigue de anfitrión y solo ve horas en que él está libre; sin límite de 2 h; el visitante recibe correo y el admin aviso | dueño (R4) |
| R4.2 | Reasignar con reunión | La reunión pasa al nuevo vendedor si está libre a esa hora; si no, el panel exige reagendar primero; correo de cambio con nuevo anfitrión y Meet | dueño (R4) |
| R4.3 | Desactivar con reunión sin reemplazo | Si nadie está libre, la reunión pasa al admin aunque no esté en turno; aviso al admin y correo de cambio al visitante; el panel exige que el admin tenga enlace de Meet antes de desactivar | dueño (R4) |
| R4.4 | Lo que ve el vendedor | Su propio embudo del mes (métricas por persona) y el historial de sus solicitudes | dueño (R4) |
| R4.5 | Solicitudes repetidas | Mismo correo con solicitud abierta (nueva o agendada) de los últimos 30 días: se actualiza esa, conserva el asignado, sin aviso nuevo salvo que reserve; queda en el historial | dueño (R4) |
| R4.6 | Hosting | Vercel Pro (Hobby es solo para uso no comercial); se descartó Cloudflare Workers por los límites de 3 MiB y 10 ms de CPU del plan gratis | dueño (R4) |
| R4.7 | Máquina de estados | Trigger en solicitudes valida las transiciones de §5.7 y sincroniza la reunión; nadie actualiza `reuniones.estado` directo; reagendar y cancelar desde el panel pasan por acciones de servidor que verifican al anfitrión o admin y llaman a las funciones SQL | Claude (auditoría) |
| R4.8 | Invariante de anfitrión | Una reunión confirmada siempre tiene `anfitrion_id = solicitudes.asignado_a` | Claude (deriva de R4.2) |
| R4.9 | Admin como respaldo | Para reuniones, solicitudes y WhatsApp el admin es respaldo solo si está activo y en turno (con WhatsApp y Meet); la única excepción es R4.3 | Claude (unifica R1.2, R2.1, R3.1) |
| R4.10 | WhatsApp en página estática | El botón siempre apunta a /api/whatsapp; si nadie está disponible redirige a /agendar?aviso=sin-whatsapp con «Ahora no hay nadie en WhatsApp. Agenda tu demo aquí.» | Claude (auditoría) |
| R4.11 | Plantillas de correo | Lista cerrada con identificador en §6.8; invitación y enlace de acceso son plantillas de Supabase Auth | Claude (auditoría) |
| R4.12 | Admin en pruebas | Producción tiene un solo admin (alpiryk@gmail.com); el admin A de seed-pruebas existe solo en local y pruebas | Claude (deriva de X12) |
| R4.13 | Zona del visitante | Se acepta cualquier zona IANA válida; el selector muestra las de §6.6 más la detectada | Claude (deriva de X1) |
| R4.14 | Alta de vendedor | El admin escribe nombre y correo; la acción de servidor invita con Supabase y crea el perfil (rol vendedor, en_turno false) | Claude (deriva de B19) |
| R4.15 | Una reunión por solicitud | Índice único parcial en reuniones(solicitud_id) donde estado = confirmada | Claude (deriva de §4) |
| R4.16 | Volver a reservar | Tras cancelar, /reunion/<token> ofrece «Elegir otra hora» mientras la solicitud esté en nueva, hasta 30 días después de creada | Claude (auditoría) |
| R4.17 | Borrado completo | Borrar una solicitud elimina sus correos pendientes y vacía `datos` de los enviados a ese correo | Claude (deriva de C3) |
| R4.18 | Solicitud desde la calculadora | Usa los rangos de §5.2; el correo de detalle lleva filas, rango, horas, datos usados, resumen de «cómo se calculó» y botón para agendar | Claude (deriva de B4, B5) |
| R4.19 | Códigos de prospección | Los escribe el usuario y se guardan en mayúsculas; con enlace inactivo o inexistente, ?ref se ignora (origen formulario, reparto normal) | Claude (deriva de A4) |
| R4.20 | Servicio de horas | GET /api/horas entrega las horas de una semana para un token de solicitud o de reunión; la restricción de prospección se mantiene al reagendar | Claude (auditoría) |
| R4.21 | Cambio de enlace de Meet | Al cambiar su enlace, se actualizan sus reuniones futuras confirmadas y cada visitante recibe «Cambió el enlace de tu demo» | Claude (auditoría) |
| R4.22 | Latidos de tareas | La tarea diaria registra su resultado en `latidos`; si no tuvo éxito en 26 h, banner en el panel del admin; en pruebas las e2e la llaman con reloj fijo | Claude (deriva de F10, X6) |
| R5.1 | Imágenes sin costo | Las fotos del equipo se reducen en el navegador antes de subir (WebP, 800 px de lado mayor, ≤ 300 KB); imágenes estáticas pre-optimizadas en el repositorio; `next/image` con `unoptimized` para no consumir optimización de Vercel | Claude (deriva de G1) |
| R5.2 | Aviso de cupos gratis | La tarea diaria mide el tamaño de la base (`pg_database_size`) y los correos del día; si pasa el 80 % del plan gratis (400 MB o 80 correos/día), avisa al admin | Claude (deriva de X13) |
| R5.3 | Rebotes y fallos de Resend | Un webhook de Resend (`/api/webhooks/resend`, firma verificada) marca los correos rebotados o fallidos, porque los programados se envían fuera de la petición | Claude (deriva de X6, F10) |
| X15 | Versión de Node | Node 24 o más reciente, porque lo exige el kit de semilla-a-repo | Claude (requisito de semilla-a-repo) |
| X16 | Contrato de tokens del kit | El bloque CSS de §8.7 usa los nombres de `design/tokens.css` del kit con los valores de Calesa, y el tema oscuro como `.dark`; se agregan `descripcion` y `carriles_max: 3` al frontmatter | Claude (requisito de semilla-a-repo) |
| X17 | Alineación con el kit | La semilla sigue la estructura del kit de semilla-a-repo: módulos en `src/modules/` con entities/features/infra, lo compartido en `src/shared/`, e2e en `e2e/`, comandos del kit, correo por `enviarEmail()` con adaptador `resend`, permisos con `puede()` y catálogo, escrituras sensibles solo por RPC, notas en `docs/pasos/<PASO>/`; si algo choca, manda la regla del kit | Claude (lectura de AGENTS.md y reglas del kit) |

## 15. Riesgos y supuestos

1. **Cifra del cliente real** (A2, A0.2): se publica «una de las importadoras más grandes de Bolivia: 35 asesores y unos 40 autos al mes» porque el dueño confirmó que es real. Si cambia, se edita en `src/modules/sitio/` (paso rojo por H2).
2. **Textos legales**: borrador hasta que el abogado apruebe; responsable con domicilio en Santa Cruz de la Sierra, Bolivia; si el abogado pide la dirección completa, el dueño la entrega en P19, que no despliega sin la aprobación (C5).
3. **Promesa de continuidad** (B21.3): la FAQ promete código y licencia de uso interno si Calesa deja de existir; debe quedar igual en el contrato. Riesgo legal si el contrato dice otra cosa.
4. **Respaldos diarios** (B21.1): la FAQ habla de la app de Calesa; el dueño confirmó que su base hace respaldos diarios. La web usa Supabase gratis con respaldo propio diario (X13).
5. **Supuestos de la calculadora** (B4): son los de la Radiografía, estimaciones sin auditoría; por eso siempre se muestran como rango con la etiqueta «Estimación» y «Cómo se calculó».
6. **Sin Google Calendar en v1** (R2.5): un vendedor puede tener una reunión en su calendario personal que la web no ve; depende de que cargue sus bloqueos. Mitigación: aviso en `/panel/disponibilidad` y correo de cada reserva al anfitrión.
7. **Enlace de Meet fijo** (B13): dos reuniones del mismo vendedor usan la misma sala; el descanso de 15 min evita que coincidan.
8. **WhatsApp por turno sin número general** (D3): si nadie del equipo está en turno con WhatsApp y el admin no tiene número, el botón desaparece; el formulario sigue disponible.
9. **Supabase SMTP**: sin SMTP propio, Supabase limita los correos de acceso; X9 lo resuelve con Resend.
10. **Capturas reales** (X8): la v1 usa maquetas; si el dueño entrega capturas de `demo.calesa.app`, reemplazan las maquetas sin tocar la estructura.
11. **Video de portada** (E5): lo graba el dueño; mientras no exista, se ve la maqueta animada.
12. **Costo** (G1, R4.6, X13): ~US$ 20/mes, solo Vercel Pro. Límites gratis a vigilar (R5.2): Supabase 500 MB de base y pausa si pasa 7 días sin actividad; Resend 3.000 correos al mes y 100 por día (cada demo usa unos 6). Con el volumen esperado (A3) quedan muy por debajo; si se acercan, la tarea diaria avisa.
13. **Versiones** (§ frontmatter): verificadas en npm el 2026-10-31; TypeScript se fija en 6.0.3 (la 7 existe, pero no todas las herramientas del stack la soportan igual).
14. **Volumen**: supuesto de decenas de solicitudes al mes (A3); la base se prueba con 30.000 para no depender de ese supuesto.
15. **Zonas horarias**: Bolivia no usa horario de verano; las zonas de los visitantes sí pueden (Chile, Paraguay, EE. UU.); todo se calcula con `date-fns-tz` (ya en el kit; antes `@date-fns/tz` y se prueba con Santiago en el cambio de horario.
16. **Exceso de autos** (X11): la regla existe en «Planes Calesa» pero no se publica; si alguien pregunta, se explica en la propuesta.
