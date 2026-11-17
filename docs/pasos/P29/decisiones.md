# P29 · Decisiones

Fecha: 2026-11-17 (America/La_Paz). Paso ámbar con `decisiones: []`. El plan (`.piloto/planes/P29.md`) pasó una ronda de auditoría
(«observaciones», aplicadas en `.piloto/planes/P29.respuestas.md`) y no tuvo preguntas de producto. `hechos.json › autoelecciones` no
trae ninguna de P29.

## El `terminado` de P07 queda cerrado

Las tres partes que P07 dejó en `docs/pasos/P07/decisiones.md`: el registro real (`registroDeSupabase` sobre las RPC de P27), el .ics
adjunto (sobre el `adjuntos` de P28) y la fecha con día (`formatearFechaConDia`).

## Decisiones no obvias

- **Las fechas de los cuerpos también van sin año.** La semilla §6.8 (l. 635-637) escribe los asuntos «mar 3 nov, 10:00»; la regla general de
  l. 421 dice «mar 3 nov 2026, 10:00». Las 12 plantillas pasan por `fechaParaVisitante` y `fechaParaEquipo`, así que el cuerpo sigue al
  asunto (P28 eligió un formato sin año). Para la próxima semilla: alinear l. 421 con §6.8, o sumar `formatearFechaConDiaYAnio` a `fechas.ts`.
- **El nombre del adjunto es `demo-calesa.ics`** (constante `NOMBRE_DEL_ICS`). El método viaja en el tipo MIME
  (`text/calendar; method=REQUEST|CANCEL`, sin `charset`: RFC 5545 §3.1.4 fija UTF-8); el calendario lee el contenido.
- **`adjunto_ics` guarda el texto del primer .ics** (CRLF), no el base64. Nadie lo reescribe. Un reenvío (reintentar, despachar un vencido)
  vuelve a dibujar el .ics desde `datos`: mismo UID y mismo `SEQUENCE` (están en `datos`), `DTSTAMP` del reenvío, que es lo correcto en iTIP.
- **`reprogramar` con `resendId` no vuelve a armar el correo:** sólo cambia la hora en Resend; el correo y su adjunto quedaron allí al
  programarlo. Sin `resendId` sólo cambia la hora del registro y `despacharVencidos` lo arma, con su .ics, a la hora nueva. Hoy ninguna
  plantilla que se programa lleva .ics (los recordatorios, el aviso de Meet y `solicitud-sin-reunion` no).
- **No se comprobó si Resend acepta adjuntos con `scheduled_at`** (sin acceso a su documentación desde el carril). No importa hoy, por lo
  anterior; si una plantilla programada llevara .ics, se comprueba en ese paso.
- **El adaptador es `registroDeSupabase(cliente: ClienteDeCorreos)`**, con un tipo estructural del cliente (las 9 RPC con los `Args` de
  `database.types.ts`; `ClienteSupabase` entra sin cast, lo fija una prueba de tipos). No importa `@supabase/*` ni el admin, así que no suma
  archivos a `DONDE_SE_PERMITE_EL_ADMIN`. Va en `infra/` sin `server-only` (no lee el entorno): ya lo cubre el `index.ts`, que lo importa.
- **Un opcional nulo se omite, nunca se manda** (P27); `marcarReprogramado` tiene sus tres formas con `p_cambiar_resend_id`. Un id que no es
  guid no llega a la base (daría `22P02`, `inesperado`): las lecturas dicen `ok(null)` o `[]` y las marcas `no_encontrado`.
- **El `null` de la base depende del método:** `ok(null)` en `porReferencia` y `porId`, `no_encontrado` en las cuatro `marcar*`, y error
  (`inesperado`, motivo `respuesta`) en `registrar` y las listas, donde siempre debe haber algo.
- **Los textos de las RPC:** pasan tal cual los de `23505`, `22023` y `P0001` (P27 los escribió para la persona y no llevan datos). Un `42501`
  (cliente sin `service_role`) sale como `sin_permiso` con un texto en español y sin el de Postgres, que la auditoría vio que podía llegar a
  una ruta pública. Cualquier otro código, con el texto del kit.
- **El registro del servidor lleva una línea** (`notificaciones: <rpc> <código>`, con ` hint=<parámetro>` sólo en `22023`), nunca argumentos,
  datos, direcciones ni texto del error. `23505` y `P0001` son resultado esperado del contrato y no se registran.
- **Las horas se normalizan a `toISOString()`** (`…:00.000Z`) al leer: la base las escribe con `+00:00`. Así la fila del adaptador, la de la
  memoria y `deps.reloj().toISOString()` de P07 escriben igual.
- **La memoria se ajustó a P27** para que la misma tabla de casos valga para las dos: tabla de transiciones con los textos de la base, un
  `cancelado` que se vuelve a cancelar devuelve la fila, `registrar` rechaza `cancelado`, orden por `(programadoPara, id)` con los sin hora
  al final y corte después de ordenar. Ninguna prueba de P07 hacía una transición que la tabla prohíbe. `supabase/tests/correos-*.sql` es la
  contraparte en la base.
- **Mutación que sobrevive (equivalente):** quitar el desempate por id del orden de la memoria. En la memoria los ids salen en el orden en
  que se insertan y el orden del `sort` es estable, así que no se puede distinguir. Se deja como documentación de lo que hace la base. El
  desempate de la base lo prueba `supabase/tests/correos-vencidos.sql` (P27).
- **`registrar` con `datos` que no son JSON** (un `BigInt`) da `validacion` sin llamar a la base.

## Avisos para otros pasos (propuestos; si ya se usaron los ids, el siguiente libre)

- **Los `fallido` de una reunión cancelada nunca se cancelan:** `correos_programados_de` sólo trae `programado`. Hace falta una RPC del carril
  `datos` que liste también los `fallido` (sumar a P40) y un paso de `notificaciones` que `cancelarDe…` los cancele (`fallido → cancelado`
  ya se admite, P27).
- **El cableado es de las rutas:** P11, P13, P15 y P36 hacen `crearNotificador({ registro: registroDeSupabase(admin), … })` por petición, y
  suman su archivo a `DONDE_SE_PERMITE_EL_ADMIN`.
- Términos para la próxima semilla: sin términos nuevos («registro de correos» ya lo propuso P07).
