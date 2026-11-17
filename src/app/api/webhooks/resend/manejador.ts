import type { Resultado } from '@/shared/lib/errores'
import { type AccionAplicable, leerEventoDeResend } from './evento'
import { verificarFirmaDeResend } from './firma'

// El webhook de Resend (R5.3) sin su ruta: lo llama `POST /api/webhooks/resend` (P42) con `RESEND_WEBHOOK_SECRET`, la hora y el
// registro que aplica la acción (P40/P41). Firma antes que nada; responde sólo `{ ok }` y nunca registra el cuerpo, las cabeceras ni el
// secreto.

export const TOPE_DEL_CUERPO_BYTES = 65_536
// P07 registra un correo después de mandarlo: un `email.failed` casi inmediato puede llegar antes que su fila. Un evento más nuevo que
// esto sin fila responde 500 y Resend reintenta; uno más viejo (fila borrada, o un correo de Supabase Auth, que no se registra), 200.
export const VENTANA_SIN_FILA_MS = 10 * 60 * 1000

export type DependenciasDelWebhook = {
  secreto: string | undefined
  ahora: Date
  aplicar: (accion: AccionAplicable) => Promise<Resultado<unknown>>
}

const responder = (estado: number) =>
  Response.json(
    { ok: estado === 200 },
    { status: estado, headers: { 'Cache-Control': 'no-store' } },
  )

// El JSON sale de los bytes ya verificados, en UTF-8 estricto; undefined si no es UTF-8 o no es JSON.
function decodificar(cuerpo: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(cuerpo)) as unknown
  } catch {
    return undefined
  }
}

async function leerCuerpo(request: Request): Promise<Uint8Array | null> {
  if (Number(request.headers.get('content-length') ?? 0) > TOPE_DEL_CUERPO_BYTES) {
    return null
  }
  const cuerpo = new Uint8Array(await request.arrayBuffer())
  return cuerpo.byteLength > TOPE_DEL_CUERPO_BYTES ? null : cuerpo
}

async function aplicarAccion(accion: AccionAplicable, { ahora, aplicar }: DependenciasDelWebhook) {
  const resultado = await aplicar(accion)
  if (resultado.ok) {
    return responder(200)
  }
  const codigo = resultado.error.codigo
  if (
    codigo === 'no_encontrado' &&
    ahora.getTime() - Date.parse(accion.ocurridoEn) >= VENTANA_SIN_FILA_MS
  ) {
    return responder(200)
  }
  console.error(`webhook resend: ${codigo}`)
  return responder(500)
}

async function atender(request: Request, dependencias: DependenciasDelWebhook): Promise<Response> {
  const cuerpo = await leerCuerpo(request)
  if (!cuerpo) {
    return responder(413)
  }
  const firmado = verificarFirmaDeResend({
    id: request.headers.get('svix-id'),
    timestamp: request.headers.get('svix-timestamp'),
    firmas: request.headers.get('svix-signature'),
    cuerpo,
    secreto: dependencias.secreto,
    ahora: dependencias.ahora,
  })
  if (!firmado) {
    return responder(401)
  }
  const json = decodificar(cuerpo)
  const evento = json === undefined ? null : leerEventoDeResend(json)
  if (!evento?.ok) {
    return responder(400)
  }
  return evento.data.tipo === 'ignorar' ? responder(200) : aplicarAccion(evento.data, dependencias)
}

export async function manejarWebhookDeResend(
  request: Request,
  dependencias: DependenciasDelWebhook,
): Promise<Response> {
  try {
    return await atender(request, dependencias)
  } catch {
    console.error('webhook resend: inesperado')
    return responder(500)
  }
}
