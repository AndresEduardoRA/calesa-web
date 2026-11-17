# notificaciones

Las 12 plantillas de correo de §6.8 (con marca y modo texto), el .ics de una reunión, las referencias idempotentes y los momentos de los recordatorios; y, sobre `enviarEmail()` del kit, enviar, programar, cancelar y reprogramar registrando cada correo.

## Entra y sale

- Entra: nada de otros módulos. Los datos llegan armados (la calculadora entrega textos ya formateados; la agenda, la reunión). `infra/` usa `src/shared/lib/email` y `src/shared/config`.
- Sale (`index.ts`, sólo servidor): `crearNotificador` (enviarAhora, programar, cancelar, cancelarDeReunion, cancelarDeSolicitud, reprogramar, reintentar, despacharVencidos), `renderizar`, `armarIcs`, `momentosDeRecordatorio`, `referenciaDe`, `PLANTILLAS`, `esquemaDatos` y sus tipos (incluida la interfaz `RegistroDeCorreos`).
- Tablas: `correos_salientes` (dueño), siempre por la interfaz `RegistroDeCorreos`; sólo se escribe por RPC (§3), ver «Ojo».

## Archivos clave

- `entities/datos.ts` — los datos de cada plantilla como unión discriminada por `plantilla` (Zod); `idsDe` y `datosParaGuardar` (sin `enlaceGestion`).
- `entities/plantillas/*.ts` — cada plantilla entrega un `Contenido` (asunto, título, bloques, método de .ics); no dibujan.
- `entities/marca.ts` — dibuja los bloques en HTML (tabla de 600 px, estilos en línea, hex de §8.1) y en texto desde el mismo contenido.
- `entities/html.ts` — el escape: la etiqueta `html` escapa cada interpolación; `urlSegura` sólo deja pasar `http:` y `https:`.
- `entities/render.ts` — `renderizar(datos, contexto)` puro: asunto, html, texto y .ics.
- `entities/ics.ts` — .ics RFC 5545 a mano: UID `<reunionId>@calesa.app`, `SEQUENCE` = la secuencia recibida, CRLF, líneas plegadas a 75 octetos.
- `entities/adjunto-ics.ts` — el .ics como adjunto (`text/calendar; method=REQUEST|CANCEL`, UTF-8 en base64); `renderizar` lo devuelve y `armar()` (`infra/nucleo.ts`) lo pone en el mensaje.
- `entities/referencia.ts` — la clave idempotente de cada correo.
- `entities/registro.ts` — la interfaz `RegistroDeCorreos` (tipos); `entities/reintentos.ts` — 3 intentos, esperas de 300 y 900 ms, sólo se reintenta `inesperado`.
- `infra/notificador.ts` — compone `enviar.ts`, `programar.ts` y `cancelar.ts` sobre `enviarEmail()` y compañía (`infra/correo.ts`, el único que lee el entorno).
- `infra/*.soporte.ts` — registro y correo falsos de las pruebas; no salen por `index.ts`.

## No se rompe

- Todo dato de la persona entra al HTML por el escape (`marca.ts`); nunca se arma HTML con una plantilla de texto normal.
- El .ics nunca lleva el enlace de gestión (lleva el token) y el UID de una reunión no cambia: el calendario del visitante actualiza el evento.
- La referencia lleva lo que cambia el cuerpo: la secuencia de la reunión y, en los recordatorios, el hash del enlace de Meet. Con la misma referencia y otro cuerpo Resend responde 409.
- Las fechas salen de `fechas.ts` (con el día de la semana, «mar 3 nov, 10:00») y los montos de `formato.ts`; al visitante en su zona, al equipo en la hora de Bolivia con rótulo.
- El correo se registra DESPUÉS de mandarlo (no hay estado «pendiente»). Un correo que no sale queda `fallido` y no tumba la acción que lo pidió; se avisa una vez a `EMAIL_AVISOS` (`correo-fallido`), nunca un aviso de un aviso ni con el proveedor apagado.
- La misma referencia no manda dos veces: `enviarAhora` y `programar` devuelven la fila que ya estaba (`yaEstaba`). Un `conflicto` (409) tampoco es un fallo.
- `enlaceGestion` (lleva el token) nunca se guarda en `correos_salientes.datos`: un correo que se vuelve a armar desde el registro sale sin él y remite al correo de confirmación.
- Cancelar no llama al proveedor si la fila ya salió (`resendId` con `programadoPara` pasado): cuenta `yaSalieron`.
- Un `.ics` sólo con `reunion-confirmada`, `reunion-cambiada` (REQUEST) y `reunion-cancelada` al visitante (CANCEL).

## Ojo

- **El `terminado` de P07 está cumplido en parte.** Cada correo se registra contra la interfaz `RegistroDeCorreos` y las pruebas usan uno en memoria: la base se escribe sólo por RPC (§3) y no hay ninguna todavía. El adaptador sobre las RPC es el paso P29 (tras P27, RPC de `correos_salientes`, del carril `datos`).
- El .ics sale adjunto en todo camino que arma el correo (enviar, programar, reintentar, despachar). `adjunto_ics` guarda el texto del primero (CRLF), no el base64; un reenvío lo vuelve a dibujar desde `datos` (mismo UID y `SEQUENCE`, `DTSTAMP` nuevo). `reprogramar` con `resendId` sólo cambia la hora en el proveedor: no vuelve a armar ni a mandar el correo.
- Quien programa debe cancelar los de la secuencia vieja y programar los nuevos al cambiar una reunión. Los recordatorios llevan el hash del enlace de Meet en su referencia: si cambia el enlace (R4.21), el recordatorio nuevo no choca con el cancelado.
- Un correo programado en Resend que ya salió sigue `programado` en el registro hasta que P13 (webhook) lo marque.
- La cabecera lleva la palabra «Calesa» en lugar del logo (no está en el repo); se cambia en `entities/marca.ts`.
