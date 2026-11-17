import { fallo, ok, type Resultado } from '../../errores'
import { destinatarios, type EnvioDeEmail, type MensajeDeEmail, type Remitente } from '../tipos'

// Resend por su API REST (https://resend.com/docs/api-reference), sin SDK: el lint prohíbe el paquete `resend` (y por eso este
// archivo no se llama `resend.ts`: su patrón también atrapa un import local con ese nombre). No reintenta (eso es de quien llama)
// y no lee el entorno: la clave le llega de `index.ts`.
const API = 'https://api.resend.com'

type Envio = Promise<Resultado<EnvioDeEmail>>

export type AdaptadorResend = {
  enviar: (mensaje: MensajeDeEmail, remitente: Remitente) => Envio
  programar: (mensaje: MensajeDeEmail, remitente: Remitente, cuando: string) => Envio
  cancelar: (id: string) => Envio
  reprogramar: (id: string, cuando: string) => Envio
}

// Los `name` de error de Resend son códigos fijos (`daily_quota_exceeded`): pueden ir en el mensaje. El `message` nunca: puede
// traer direcciones. Un `name` que no tiene forma de código tampoco.
const CODIGO_DE_RESEND = /^[a-z_]{1,64}$/

function errorDeResend(status: number, nombre: string): Resultado<never> {
  const detalle = nombre ? `${String(status)} ${nombre}` : String(status)
  if (status === 400 || status === 422)
    return fallo('validacion', `Resend no aceptó el correo (${detalle}).`)
  if (status === 401) return fallo('inesperado', `Resend rechazó la clave (${detalle}).`)
  if (status === 403)
    return fallo('inesperado', `Resend no lo permite (${detalle}): revisa la clave y el dominio.`)
  if (status === 404) return fallo('no_encontrado', 'Resend no encuentra ese correo.')
  // Misma referencia con otro cuerpo, un pedido igual en curso, u otro cambiando ese correo. No es el «Recargar» de una pantalla.
  if (status === 409)
    return fallo(
      'conflicto',
      `Resend no lo hizo: choca con otro pedido con la misma referencia o sobre el mismo correo (${detalle}).`,
    )
  // Pedidos por segundo, o la cuota diaria o mensual.
  if (status === 429)
    return fallo('inesperado', `Resend no acepta más correos por ahora (${detalle}).`)
  return fallo('inesperado', `El correo no salió: Resend respondió ${detalle}.`)
}

function cuerpoDeEnvio(mensaje: MensajeDeEmail, remitente: Remitente) {
  const nombre = remitente.nombre.replace(/[<>"]/g, '').trim()
  const etiquetas = Object.entries(mensaje.etiquetas ?? {})
  const adjuntos = mensaje.adjuntos ?? []
  return {
    from: nombre ? `${nombre} <${remitente.email}>` : remitente.email,
    to: destinatarios(mensaje.para),
    subject: mensaje.asunto,
    html: mensaje.html,
    text: mensaje.texto,
    // Resend sólo admite letras, números, `_` y `-` en las etiquetas: el `.` (`v1.2`) va como `_`.
    // `content` en base64 (string) y `content_type` con sus parámetros (`text/calendar; method=REQUEST`).
    ...(adjuntos.length > 0 && {
      attachments: adjuntos.map((a) => ({
        filename: a.nombre,
        content: a.contenido,
        content_type: a.tipo,
      })),
    }),
    ...(etiquetas.length > 0 && {
      tags: etiquetas.map(([name, valor]) => ({ name, value: valor.replaceAll('.', '_') })),
    }),
  }
}

export function crearAdaptadorResend(clave: string, pedir: typeof fetch = fetch): AdaptadorResend {
  async function llamar(
    ruta: string,
    pedido: { metodo: 'POST' | 'PATCH'; cuerpo?: object; referencia?: string | undefined },
  ): Envio {
    const cabeceras: Record<string, string> = { Authorization: `Bearer ${clave}` }
    if (pedido.cuerpo) cabeceras['Content-Type'] = 'application/json'
    if (pedido.referencia) cabeceras['Idempotency-Key'] = pedido.referencia
    let respuesta: Response
    try {
      respuesta = await pedir(`${API}${ruta}`, {
        method: pedido.metodo,
        headers: cabeceras,
        ...(pedido.cuerpo && { body: JSON.stringify(pedido.cuerpo) }),
      })
    } catch {
      return fallo('inesperado', 'El correo no salió: Resend no respondió.')
    }
    const datos = (await respuesta.json().catch(() => null)) as {
      id?: unknown
      name?: unknown
    } | null
    if (!respuesta.ok) {
      const nombre =
        typeof datos?.name === 'string' && CODIGO_DE_RESEND.test(datos.name) ? datos.name : ''
      return errorDeResend(respuesta.status, nombre)
    }
    return typeof datos?.id === 'string' && datos.id !== ''
      ? ok({ id: datos.id })
      : fallo('inesperado', 'Resend no devolvió el id del correo.')
  }

  return {
    enviar: (mensaje, remitente) =>
      llamar('/emails', {
        metodo: 'POST',
        cuerpo: cuerpoDeEnvio(mensaje, remitente),
        referencia: mensaje.referencia,
      }),
    programar: (mensaje, remitente, cuando) =>
      llamar('/emails', {
        metodo: 'POST',
        cuerpo: { ...cuerpoDeEnvio(mensaje, remitente), scheduled_at: cuando },
        referencia: mensaje.referencia,
      }),
    cancelar: (id) => llamar(`/emails/${encodeURIComponent(id)}/cancel`, { metodo: 'POST' }),
    reprogramar: (id, cuando) =>
      llamar(`/emails/${encodeURIComponent(id)}`, {
        metodo: 'PATCH',
        cuerpo: { scheduled_at: cuando },
      }),
  }
}
