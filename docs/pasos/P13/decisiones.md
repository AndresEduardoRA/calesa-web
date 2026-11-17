# Decisiones · P13 · Tarea diaria y webhook de Resend

## 2026-11-17 · Cómo llegó el paso a ejecutarse

- Primer plan: el auditor lo bloqueó dos veces (dependencias del `plan.yaml` de `main` y el reloj fijo) → compuerta `atasco`. El dueño
  contestó «parar — detener P13 hasta que estén P30 y los pasos de datos».
- Al volver, P30 ya estaba integrado, pero faltaban P23, P38 y P39, y ningún paso hacía las RPC del latido, los cupos, el reintento ni el
  evento de Resend → compuerta `afuera`. El dueño contestó «seguir»: replanificar P13 sólo con lo que no necesita la base (firma del
  webhook, orquestación y manejadores en Vitest) y proponer P40.
- La rama se puso al día con `git merge --no-ff origin/main` (`1d16b0e`). El plan nuevo pasó la auditoría con observaciones, ya aplicadas.
- Autoelección, tal cual: `- 2026-11-17T18:52:18-04:00 · P13 · compuerta datos contestada sola (PILOTO_AUTO): aprobar`

## 2026-11-17 · Para el coordinador: el alcance de P13 y la partición

- **P13** queda con este `terminado`: «`medicion` orquesta la tarea diaria por puertos y arma su latido; manejadores del cron
  (CRON_SECRET) y del webhook (firma de Resend, eventos), probados en Vitest; sin rutas, `vercel.json` ni e2e (P42)». Su `depende_de` pasa
  a `[P05, P06, P07, P12]`: P23, P30, P38 y P39 pasan a P42. La `verificacion` no cambia.
- **Ids.** Las notas de otros pasos ya proponían otros «P40»:

  | Propuesta                                                | Dónde                                       | Queda como                                          |
  | -------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------- |
  | «P40 · RPC de correos para el webhook y la tarea diaria» | `docs/pasos/P27/decisiones.md:81-86`        | absorbido por el **P40** de abajo                   |
  | «P40 · Recolector de fotos huérfanas del bucket equipo»  | `docs/pasos/P34/decisiones.md:76`, `:80-91` | **P44**; donde P34 dice «lo cumple P40», se lee P44 |

- **P40** · «RPC de la tarea diaria y del webhook de Resend» · `datos` · rojo · `modulos: [supabase/, src/shared/types/]` ·
  `depende_de: [P27, P30, P38]` · `verificacion`: la de P27.
  - Todo `security definer`, `set search_path = ''` y sólo `service_role`, con la hora por `_ahora()` (P38).
  - `registrar_latido(p_tarea, p_ok, p_error, p_cupos text[])`. Con `p_ok`: `ultimo_ok = _ahora()`, error nulo y `fallos_seguidos = 0`.
    Sin él: error cortado a 500 y `fallos_seguidos + 1`, sin tocar `ultimo_ok`. `p_cupos` nulo deja los anteriores.
  - La fila `latidos('diario')` en la migración (`on conflict do nothing`), y el `insert` de `supabase/semillas/pruebas.sql:62` pasa a
    upsert. Si no, `db:reset` cae por la clave primaria.
  - `medir_cupos()` → `{bytes_de_base, correos_del_dia}`: `pg_database_size` y un conteo acotado con `limit 81`.
  - `correos_para_reintentar(p_tope)`: toma y marca (`reintentado_en`) en una sentencia, acotado con `_acotar_pagina`.
  - `aplicar_evento_resend(p_resend_id, p_estado, p_ultimo_error, p_reintentable, p_ocurrido_en)` con las transiciones de abajo. Guarda
    `correos_salientes.no_reintentar` y devuelve `{fila, cambio}`, o null sin fila con ese `resend_id`.
  - Índices: `(resend_id) where resend_id is not null`, `(enviado_en) where enviado_en is not null` y el de los fallidos por reintentar.
  - Pruebas en `supabase/tests/`: un `email.sent` tardío no baja un `fallido`, y un `fallido` sólo se toma una vez.
  - **A decidir en P40**, con la recomendación primero:
    - Los cupos van en `latidos.cupos text[] not null default '{}'`, que escribe la misma RPC del latido.
    - «Los correos del día» son las 24 h hasta `_ahora()`: la tarea corre a las 03:00 de La Paz y a esa hora el día casi no tiene correos.
    - Cada fallido se reintenta una sola vez, y sólo si sirve que salga. No se toman: un programado cuya hora ya pasó, un correo de una
      reunión que ya no está confirmada o ya empezó (salvo `reunion-cancelada`), uno de una secuencia vieja de su reunión, ni un
      `no_reintentar`. Lo que no se toma queda `fallido`, a la vista del admin.
- **P41** · «Reintento diario y eventos de Resend en el notificador» · `notificaciones` · ámbar · `modulos: [src/modules/notificaciones/]`
  · `depende_de: [P29, P40]`.
  - `RegistroDeCorreos` suma `paraReintentar(tope)` y `aplicarEvento(accion)`.
  - El notificador suma `ponerAlDiaLosCorreos()` (despachar los vencidos y un lote de `paraReintentar`, los dos con `TOPE_DE_LOTE`) y
    `aplicarEventoDeResend(accion)`, que avisa `correo-fallido` sólo si la fila cambió a `fallido`.
  - El tipo de `accion` se declara en `notificaciones` con la forma de `AccionAplicable` (`src/app/api/webhooks/resend/evento.ts`), sin
    importar de `src/app`.
- **P42** · «Rutas del cron diario y del webhook de Resend, vercel.json y e2e» · `tareas` · rojo · `modulos: [vercel.json,
src/modules/medicion/, src/app/api/cron/, src/app/api/webhooks/, e2e/tareas/diario.spec.ts]` ·
  `depende_de: [P13, P23, P30, P38, P39, P40, P41, P44]` · `verificacion`: la de P13.
  - `GET /api/cron/diario` arma los puertos de `correrTareaDiaria` (cliente admin, `retencion_diaria`, P40 y el notificador de P41 con el
    reloj de P39) y llama a `manejarCron`. `POST /api/webhooks/resend` llama a `manejarWebhookDeResend` con `RESEND_WEBHOOK_SECRET` y la
    hora de P39.
  - `vercel.json` con `0 7 * * *` → `/api/cron/diario` como único cron. `leerLatidoDiario` y `EstadoDeTarea` suman `cupos`.
  - Un paso `fotos` en la tarea diaria, sobre las RPC de P44: confirma cada lote justo antes de borrarlo con la API de Storage.
  - `maxDuration` según el peor caso medido (5 vueltas de retención, 50 + 50 correos con sus esperas). Antes se comprueba en
    `node_modules/next/dist/docs/` que vale con `cacheComponents`.
  - e2e con `TIEMPO_FIJO`: retención (25 meses sí, 23 no), un reintento, 81 correos → aviso de cupos, latido `ok`, un webhook firmado que
    marca un rebote, y 401 sin secreto y sin firma.
- **Banners.** P14 suma P39 y dibuja el de tarea detenida con `leerLatidoDiario`, sin esperar a P42. **P43** · «Banner de cupos gratis en
  el marco del panel» · `acceso` · ámbar · `modulos: [src/modules/acceso/, src/app/(app)/_shell/, e2e/acceso/cupos.spec.ts]` ·
  `depende_de: [P14, P42]` · `verificacion`: nivel 2, la de P14 (toca `_shell/`).
- **P44** · «Recolector de fotos huérfanas del bucket equipo» · `datos` · rojo · `modulos: [supabase/, src/shared/types/]` ·
  `depende_de: [P34]` · `verificacion`: la de P34. El `terminado` es el que dejó P34 (`docs/pasos/P34/decisiones.md:80-88`).
- **P18** suma P42 y P43. Sin ciclos: P39 depende de `[P06, P33]`, P23 de `[P01, P02, P22]` y P44 de `[P34]`.

## 2026-11-17 · Decisiones no obvias del código

- **Hechos verificados hoy** en la documentación (Resend y Svix):
  - Firma: cabeceras `svix-id`, `svix-timestamp` y `svix-signature`. Se firma `<id>.<timestamp>.<cuerpo crudo>` con HMAC-SHA256 y la
    clave en base64 tras `whsec_`; la firma va en base64. Puede haber varias `v1,<firma>` separadas por espacio, y vale si alguna casa.
    Fuentes: <https://resend.com/docs/dashboard/webhooks/verify-webhooks-requests> y
    <https://docs.svix.com/receiving/verifying-payloads/how-manual>.
  - Tipos de evento: <https://resend.com/docs/dashboard/webhooks/event-types>.
  - Cuerpo (`type`, `created_at` del evento, `data.email_id`, `data.bounce.type`, `data.failed.reason`):
    <https://www.resend.com/docs/webhooks/emails/bounced.md> y `…/failed.md`. Los eventos pueden llegar desordenados.
- **El vector de prueba** es el de la guía manual de Svix (cuerpo `{"test": 2432232314}`, con un espacio). Su HMAC se recalculó con
  `node:crypto` y da la firma publicada.
- **Se firman los bytes exactos** (`request.arrayBuffer()`), nunca un texto reconstruido: `text()` decodifica y quita un BOM, y un JSON
  reserializado ya no casa. El JSON sale de esos bytes sólo después de verificar, en UTF-8 estricto (inválido → 400).
- **La tolerancia del timestamp es de 5 min**, para los dos lados: la documentación no la fija. Se miran sólo las primeras 10 firmas.
- **La firma y el evento viven junto a su ruta** (`src/app/api/webhooks/resend/`) y no en `src/shared/lib/seguridad/`, que es del carril
  `base`. Moverlos después es un `git mv`.
- **Qué eventos cambian el registro** (R5.3 y lo que espera P07): `bounced`, `failed` y `suppressed` → `fallido`; `sent` y `delivered` →
  `enviado`; los demás se ignoran. `suppressed` entra porque es un correo que Resend no envió. La hora es el `created_at` de primer nivel.
- **`reintentable: false`** para un rebote `Permanent`, uno sin tipo conocido (no se gasta cupo en dudas, G1) y un suprimido. Del cuerpo
  nunca se toman el destinatario, el asunto, el mensaje del rebote ni el diagnóstico; de `failed.reason`, sólo un `^[a-z_]{1,40}$`.
- **Ventana de 10 min sin fila.** P07 registra el correo después de mandarlo: un `no_encontrado` de un evento de menos de 10 min responde
  500 y Resend reintenta; uno más viejo, 200. Riesgo aceptado: un fallo que llega más de 10 min antes que su fila queda sin marcar.
- **El cron responde 500 con el resumen si un paso falla**, para que la corrida quede en los logs de Vercel (F10). Si verificar el
  secreto lanza (entorno inválido), 500 sin correr.
- **La retención se vuelve a llamar mientras `quedanMas`**, hasta 5 veces por corrida; lo que quede, lo sigue la próxima.
