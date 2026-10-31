import 'server-only'

import { entornoDelServidor, type EntornoDelServidor } from '../../config/servidor'
import { fallo, type Resultado } from '../errores'
import { crearAdaptadorMailpit } from './adaptadores/mailpit'
import { crearAdaptadorResend, type AdaptadorResend } from './adaptadores/resend-api'
import {
  esquemaDeCuando,
  esquemaDeIdDeEmail,
  esquemaDeMensaje,
  type EnvioDeEmail,
  type MensajeDeEmail,
  type Remitente,
} from './tipos'

export type { EnvioDeEmail, MensajeDeEmail } from './tipos'

type Dependencias = { entorno?: EntornoDelServidor; pedir?: typeof fetch }
type Envio = Promise<Resultado<EnvioDeEmail>>

const APAGADO = 'El envío de correos está apagado (EMAIL_PROVEEDOR=ninguno).'
const MENSAJE_INVALIDO = 'El correo no se mandó: el mensaje no es válido.'

const sinAdaptador = (proveedor: string) =>
  fallo('regla', `${proveedor} todavía no tiene adaptador (src/shared/lib/email/adaptadores/).`)

// El esquema del entorno ya exige el remitente cuando hay un proveedor.
const remitenteDe = (entorno: EntornoDelServidor): Remitente => ({
  email: entorno.EMAIL_REMITENTE ?? '',
  nombre: entorno.EMAIL_REMITENTE_NOMBRE ?? '',
})

// La única puerta de los correos que manda la app (notificaciones, avisos, compartir algo). El proveedor sale de
// `EMAIL_PROVEEDOR`: cambiarlo es cambiar variables, nunca código. Los correos de Auth (invitación, recuperación)
// no pasan por aquí: los manda Supabase Auth por SMTP.
export async function enviarEmail(mensaje: MensajeDeEmail, dependencias: Dependencias = {}): Envio {
  const entorno = dependencias.entorno ?? entornoDelServidor()
  const valido = esquemaDeMensaje.safeParse(mensaje)
  if (!valido.success) return fallo('validacion', MENSAJE_INVALIDO)
  if (entorno.EMAIL_PROVEEDOR === 'ninguno') return fallo('regla', APAGADO)
  if (entorno.EMAIL_PROVEEDOR === 'mailpit' && entorno.MAILPIT_URL) {
    return crearAdaptadorMailpit(entorno.MAILPIT_URL, dependencias.pedir)(
      valido.data,
      remitenteDe(entorno),
    )
  }
  if (entorno.EMAIL_PROVEEDOR === 'resend' && entorno.RESEND_API_KEY) {
    return crearAdaptadorResend(entorno.RESEND_API_KEY, dependencias.pedir).enviar(
      valido.data,
      remitenteDe(entorno),
    )
  }
  return sinAdaptador(entorno.EMAIL_PROVEEDOR)
}

// Si el proveedor programa, cancela y reprograma correos: sólo Resend. Sin él (local, e2e), quien programa guarda el correo y lo
// manda a su hora por su cuenta, sin leer códigos de error.
export function programaCorreos(entorno: EntornoDelServidor = entornoDelServidor()): boolean {
  return entorno.EMAIL_PROVEEDOR === 'resend'
}

// El adaptador que programa, o por qué no hay: Mailpit no programa y `ninguno` no manda nada.
function adaptadorQuePrograma(dependencias: Dependencias): Resultado<AdaptadorResend> {
  const entorno = dependencias.entorno ?? entornoDelServidor()
  if (entorno.EMAIL_PROVEEDOR === 'resend' && entorno.RESEND_API_KEY)
    return { ok: true, data: crearAdaptadorResend(entorno.RESEND_API_KEY, dependencias.pedir) }
  if (entorno.EMAIL_PROVEEDOR === 'ninguno') return fallo('regla', APAGADO)
  if (entorno.EMAIL_PROVEEDOR === 'mailpit')
    return fallo('regla', 'Mailpit no programa correos (EMAIL_PROVEEDOR=mailpit).')
  return sinAdaptador(entorno.EMAIL_PROVEEDOR)
}

// `cuando`: ISO 8601 con zona. Resend acepta hasta 30 días adelante.
export async function programarEmail(
  mensaje: MensajeDeEmail,
  cuando: string,
  dependencias: Dependencias = {},
): Envio {
  const valido = esquemaDeMensaje.safeParse(mensaje)
  if (!valido.success) return fallo('validacion', MENSAJE_INVALIDO)
  if (!esquemaDeCuando.safeParse(cuando).success)
    return fallo('validacion', 'El correo no se programó: la hora no es ISO 8601 con zona.')
  const adaptador = adaptadorQuePrograma(dependencias)
  if (!adaptador.ok) return adaptador
  const entorno = dependencias.entorno ?? entornoDelServidor()
  return adaptador.data.programar(valido.data, remitenteDe(entorno), cuando)
}

// Un correo cancelado no se puede reprogramar (Resend).
export async function cancelarEmail(id: string, dependencias: Dependencias = {}): Envio {
  if (!esquemaDeIdDeEmail.safeParse(id).success)
    return fallo('validacion', 'El correo no se canceló: el id no es válido.')
  const adaptador = adaptadorQuePrograma(dependencias)
  return adaptador.ok ? adaptador.data.cancelar(id) : adaptador
}

export async function reprogramarEmail(
  id: string,
  cuando: string,
  dependencias: Dependencias = {},
): Envio {
  if (!esquemaDeIdDeEmail.safeParse(id).success)
    return fallo('validacion', 'El correo no se reprogramó: el id no es válido.')
  if (!esquemaDeCuando.safeParse(cuando).success)
    return fallo('validacion', 'El correo no se reprogramó: la hora no es ISO 8601 con zona.')
  const adaptador = adaptadorQuePrograma(dependencias)
  return adaptador.ok ? adaptador.data.reprogramar(id, cuando) : adaptador
}
