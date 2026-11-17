# notificaciones

Las 12 plantillas de correo de §6.8 (con marca y modo texto), el .ics de una reunión, las referencias idempotentes y los momentos de los recordatorios; y, sobre `enviarEmail()` del kit, enviar, programar, cancelar y reprogramar registrando cada correo.

## Entra y sale

- Entra: nada de otros módulos. Los datos llegan armados (la calculadora entrega textos ya formateados; la agenda, la reunión). `infra/` usa `src/shared/lib/email` y `src/shared/config`.
- Sale (`index.ts`, sólo servidor): `renderizar`, `armarIcs`, `momentosDeRecordatorio`, `referenciaDe`, `PLANTILLAS`, `esquemaDatos` y sus tipos.
- Tablas: `correos_salientes` (dueño; sólo por RPC, ver «Ojo»).

## Archivos clave

- `entities/datos.ts` — los datos de cada plantilla como unión discriminada por `plantilla` (Zod); `idsDe` y `datosParaGuardar` (sin `enlaceGestion`).
- `entities/plantillas/*.ts` — cada plantilla entrega un `Contenido` (asunto, título, bloques, método de .ics); no dibujan.
- `entities/marca.ts` — dibuja los bloques en HTML (tabla de 600 px, estilos en línea, hex de §8.1) y en texto desde el mismo contenido.
- `entities/html.ts` — el escape: `html\`…\``escapa cada interpolación;`urlSegura`sólo deja`http:`y`https:`.
- `entities/render.ts` — `renderizar(datos, contexto)` puro: asunto, html, texto y .ics.
- `entities/ics.ts` — .ics RFC 5545 a mano: UID `<reunionId>@calesa.app`, `SEQUENCE` = la secuencia recibida, CRLF, líneas plegadas a 75 octetos.
- `entities/referencia.ts` — la clave idempotente de cada correo.

## No se rompe

- Todo dato de la persona entra al HTML por el escape (`marca.ts`); nunca se arma HTML con una plantilla de texto normal.
- El .ics nunca lleva el enlace de gestión (lleva el token) y el UID de una reunión no cambia: el calendario del visitante actualiza el evento.
- La referencia lleva lo que cambia el cuerpo: la secuencia de la reunión y, en los recordatorios, el hash del enlace de Meet. Con la misma referencia y otro cuerpo Resend responde 409.
- Las fechas salen de `fechas.ts` y los montos de `formato.ts`; al visitante en su zona, al equipo en la hora de Bolivia con rótulo.
- Un `.ics` sólo con `reunion-confirmada`, `reunion-cambiada` (REQUEST) y `reunion-cancelada` al visitante (CANCEL).

## Ojo

- Hoy la fecha sale sin día de la semana («3 nov 2026, 10:00»): `fechas.ts` no lo escribe. Se cambia en `entities/formato-correo.ts`.
- La cabecera lleva la palabra «Calesa» en lugar del logo (no está en el repo); se cambia en `entities/marca.ts`.
