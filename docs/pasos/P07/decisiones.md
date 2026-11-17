# P07 · Decisiones

Fecha: 2026-11-17 (America/La_Paz). El plan (`.piloto/planes/P07.md`), auditado en una ronda («observaciones», aplicadas), terminó en una
compuerta `afuera`; la persona contestó `seguir (Recommended)`: P07 hace lo que cabe en `src/modules/notificaciones/` sin tocar la base ni
`src/shared`. No hubo autoelecciones ámbar (`hechos.json › autoelecciones` vino vacío): las preguntas de producto P3, P4 y P5 del plan las
tomé con su opción recomendada, que es reversible y sin datos ni permisos en juego.

## El `terminado` queda cumplido en parte

- «Registrando cada una en `correos_salientes`»: se cumple contra la interfaz `RegistroDeCorreos` (`entities/registro.ts`) y un registro en
  memoria en las pruebas. La base se escribe sólo por RPC (§3, `semilla.md:296`) y ninguna RPC escribe `correos_salientes` todavía.
- «.ics REQUEST y CANCEL»: el .ics se arma, se prueba y se guarda en `adjunto_ics`, pero **no sale adjunto**: `enviarEmail()` no admite
  adjuntos. El correo dice fecha, hora y enlace de Meet en el cuerpo.
- Pendientes `afuera` (compuerta contestada `seguir`), para el coordinador. Los ids son propuestos; si ya se usaron, el siguiente libre:

| Paso | Carril           | Qué hace                                                                                                                                                                                                                                        | Riesgo | Depende de    |
| ---- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------- |
| P27  | `datos`          | RPC de `correos_salientes` (registrar, marcar enviado, fallido, cancelado y reprogramado; leer por referencia, id, reunión o solicitud, y vencidos) con su índice de vencidos (`security definer`, `set search_path = ''`, sólo `service_role`) | rojo   | P02, P05      |
| P28  | `base`           | `adjuntos` en `esquemaDeMensaje` y en los adaptadores `mailpit` y `resend-api`; formato de fecha con día de la semana en `fechas.ts` (§6.8: «mar 3 nov, 10:00»)                                                                                 | rojo   | P01           |
| P29  | `notificaciones` | Adaptador de `RegistroDeCorreos` sobre las RPC (el cliente entra por parámetro: no suma archivos a `DONDE_SE_PERMITE_EL_ADMIN`); adjuntar el .ics (`text/calendar; method=REQUEST\|CANCEL`); fecha con día                                      | ámbar  | P07, P27, P28 |

P11, P13, P14, P15 y P16 suman P29 a su `depende_de` si escriben el registro de verdad.

## Decisiones no obvias

- **Plantillas en TypeScript, no React Email.** El lint prohíbe `@react-email/*` (P01) y `renderToStaticMarkup` lanza error en el bundle de
  Next (`node_modules/next/dist/build/webpack/alias/react-dom-server.js`). Cada plantilla entrega un `Contenido` (asunto, título, bloques) y
  `marca.ts` lo dibuja en HTML y en texto: los dos dicen lo mismo y todo dato pasa por un único escape (`html.ts`).
- **La etiqueta `html` se importa como `seguro` en `marca.ts` y `html.test.ts`.** Prettier reformatea el interior de toda plantilla
  etiquetada `html` y mete saltos y espacios al HTML del correo (rompió tres pruebas). No es un truco: es evitar que el formateador
  cambie el contenido de un correo.
- **El .ics se escribe a mano (RFC 5545)**, sin dependencia: UID `<reunionId>@calesa.app`, `SEQUENCE` = la secuencia recibida, CRLF, líneas
  plegadas a 75 octetos sin partir un carácter de varios bytes.
- **La referencia idempotente lleva lo que cambia el cuerpo.** Distinto del ejemplo `recordatorio24:<reunion_id>` de §3: lleva la secuencia
  (con la misma referencia y otro cuerpo, Resend responde 409) y, en los recordatorios, el hash FNV-1a del enlace de Meet (R4.21 puede
  cambiar el enlace sin subir `secuencia_ics`; sin el hash, el recordatorio nuevo chocaría con la fila `cancelado`).
- **Se registra después de mandar:** la tabla no tiene estado «pendiente» (`estado_correo` = enviado, programado, cancelado, fallido).
- **Un correo `fallido` no tumba la acción que lo pidió** (`enviarAhora` devuelve `ok` con `estado: 'fallido'`); avisa una vez a
  `EMAIL_AVISOS` (`correo-fallido`), nunca un aviso de un aviso. Con el proveedor apagado (`regla`) queda `fallido` sin avisar.
- **Un `conflicto` (409) no es un fallo:** se relee la referencia y se devuelve la fila que ya estaba; sin fila, «Ese correo ya va en camino.»
- **`correo-fallido` copia `reunionId` y `solicitudId`** de la fila que falló, para que el borrado de datos por solicitud (R4.17) lo vacíe.
- **El enlace de gestión nunca se guarda** (P5, recomendada): `datosParaGuardar` lo quita; `enlaceGestion` es opcional en las plantillas y,
  si falta, el correo dice «Para cambiar o cancelar, usa el enlace del correo de confirmación.»
- **Cancelar no llama al proveedor si la fila ya salió** (`resendId` con `programadoPara` pasado): cuenta `yaSalieron`. Nada pasa a
  `enviado` esas filas hasta el webhook de P13.
- **`marcarReprogramado(id, programadoPara, resendId?)`** lleva un tercer parámetro (distinto del plan) porque reintentar un programado
  fallido necesita volver la fila a `programado` con el `resendId` nuevo (o `null` sin proveedor que programe).
- **Fecha sin día de la semana** (P3, recomendada): «3 nov 2026, 10:00» con `formatearFechaHora()`; el día llega con P28 y se cambia en
  `entities/formato-correo.ts`. **Cabecera con la palabra «Calesa»** (P4, recomendada): no hay logo en el repo (P25); se cambia en
  `entities/marca.ts`.
- **Reparto de commits distinto del plan:** el commit 1 trae las plantillas, el .ics, las referencias y los recordatorios (el asunto lleva «y»: el .ics se dibuja desde `render.ts`, que los junta, y no compilaba sin él); el commit 2
  trae el registro, los reintentos y todo `infra/`. `docs/MAPA.md` no se versiona (está en `.gitignore`).
- **Un lote de despacho de 50** (`TOPE_DE_LOTE`, constante local de `infra/enviar.ts`): cabe en una petición del cron de P13.
- **401 y 403 de Resend se reintentan** (llegan como `inesperado`, `resend-api.ts`); no se pueden distinguir sin tocar `src/shared`.
- Términos para la próxima semilla: «registro de correos» (`correos_salientes`) y «plantilla». `docs/GLOSARIO.md` no se toca (sale de la
  semilla); su entrada «Bandeja de salida» habla de una tarea por minuto que X6 descartó.
