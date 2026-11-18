import { z } from 'zod'

import { fallo, ok, type Resultado } from '@/shared/lib/errores'

// Qué hace con el registro de correos cada evento de Resend (R5.3; tipos y cuerpo verificados en resend.com/docs el 2026-11-17).
// Rebotes, fallos y suprimidos → `fallido`; `sent` y `delivered` → `enviado` (lo que espera P07 de un programado que salió). Del cuerpo
// sólo se toman el id del correo, la hora del evento, el tipo de rebote y un motivo de fallo limpio: nunca el destinatario, el asunto,
// el mensaje del rebote ni el diagnóstico.

// La acción que aplica el registro (P40/P41). Es idempotente y tolera el desorden: `enviado` sólo desde `programado`, `fallido` desde
// `programado` o `enviado`, y un `fallido` o `cancelado` no cambia. `reintentable: false` deja el correo fuera del reintento diario.
// `notificaciones` declara la misma forma: no importa de `src/app`.
export type AccionAplicable =
  | {
      tipo: 'fallido'
      resendId: string
      ultimoError: string
      reintentable: boolean
      ocurridoEn: string
    }
  | { tipo: 'enviado'; resendId: string; ocurridoEn: string }

export type AccionDelEvento = AccionAplicable | { tipo: 'ignorar' }

export const TEXTOS_DEL_EVENTO = {
  reboteTemporal: 'Resend: el correo rebotó por un problema temporal.',
  rebotePermanente: 'Resend: el correo rebotó; la dirección no lo recibe.',
  fallo: 'Resend no pudo enviar el correo.',
  suprimido: 'Resend no lo envió: la dirección está suprimida.',
} as const

const conTipo = z.object({ type: z.string() })
// `created_at` de primer nivel es la hora del evento; `data.created_at`, la del correo, que no sirve aquí.
const delCorreo = z.object({
  created_at: z.iso.datetime({ offset: true }),
  data: z.object({ email_id: z.string().min(1).max(100) }),
})
const deRebote = z.object({
  data: z.object({ bounce: z.object({ type: z.literal('Temporary') }) }),
})
const deFallo = z.object({
  data: z.object({ failed: z.object({ reason: z.string().regex(/^[a-z_]{1,40}$/) }) }),
})

type DelCorreo = { resendId: string; ocurridoEn: string }

const fallido = (c: DelCorreo, ultimoError: string, reintentable: boolean): AccionAplicable => ({
  tipo: 'fallido',
  ...c,
  ultimoError,
  reintentable,
})

// Un rebote sin tipo conocido cuenta como permanente: no se gasta cupo en dudas (G1).
function rebote(json: unknown, c: DelCorreo): AccionAplicable {
  return deRebote.safeParse(json).success
    ? fallido(c, TEXTOS_DEL_EVENTO.reboteTemporal, true)
    : fallido(c, TEXTOS_DEL_EVENTO.rebotePermanente, false)
}

function falloDeEnvio(json: unknown, c: DelCorreo): AccionAplicable {
  const motivo = deFallo.safeParse(json)
  const texto = motivo.success
    ? `${TEXTOS_DEL_EVENTO.fallo} (${motivo.data.data.failed.reason})`
    : TEXTOS_DEL_EVENTO.fallo
  return fallido(c, texto, true)
}

const QUE_HACE = new Map<string, (json: unknown, c: DelCorreo) => AccionAplicable>([
  ['email.bounced', rebote],
  ['email.failed', falloDeEnvio],
  ['email.suppressed', (_json, c) => fallido(c, TEXTOS_DEL_EVENTO.suprimido, false)],
  ['email.sent', (_json, c) => ({ tipo: 'enviado', ...c })],
  ['email.delivered', (_json, c) => ({ tipo: 'enviado', ...c })],
])

export function leerEventoDeResend(json: unknown): Resultado<AccionDelEvento> {
  const tipo = conTipo.safeParse(json)
  if (!tipo.success) {
    return fallo('validacion', 'El evento no trae su tipo.')
  }
  const accion = QUE_HACE.get(tipo.data.type)
  if (!accion) {
    return ok({ tipo: 'ignorar' })
  }
  const correo = delCorreo.safeParse(json)
  if (!correo.success) {
    return fallo('validacion', 'El evento no trae el correo ni su hora.')
  }
  const ocurridoEn = new Date(correo.data.created_at).toISOString()
  return ok(accion(json, { resendId: correo.data.data.email_id, ocurridoEn }))
}
