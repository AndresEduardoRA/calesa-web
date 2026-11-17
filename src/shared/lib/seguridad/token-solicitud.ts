import { createHmac } from 'node:crypto'
import { z } from 'zod'

import { entornoDelServidor, type EntornoDelServidor } from '../../config/servidor'
import { fallo, MENSAJE_INESPERADO, ok, type Resultado } from '../errores'
import { igualesEnTiempoConstante } from './cripto'
import { TEXTO_TOKEN_VENCIDO } from './textos'

// El token de solicitud deja reservar a quien acaba de llenar el formulario (semilla §5.6):
// `<solicitud_id>.<exp>.<firma>`, con `firma = base64url(HMAC-SHA256(TOKEN_FIRMA_SECRETO, solicitud_id + "." + exp))`.
// El id y el vencimiento van en claro porque `GET /api/horas` recibe sólo el token. Vence 2 h después de **emitido**: no se
// firma con `solicitudes.creado_en`, que puede ser de hasta 30 días atrás cuando la solicitud se junta con otra (R4.5).
// El «un uso por solicitud» no se controla aquí: lo garantiza la RPC que reserva.

const DURACION_SEGUNDOS = 2 * 60 * 60
const EXP = /^\d{1,12}$/
const FIRMA = /^[A-Za-z0-9_-]{43}$/
const esquemaDeId = z.guid()

type Firmar = { entorno?: EntornoDelServidor; emitidoEn?: Date }
type Verificar = { entorno?: EntornoDelServidor; ahora?: Date }

export type TokenDeSolicitud = { token: string; venceEn: string }
export type SolicitudDelToken = { solicitudId: string; venceEn: string }

const firma = (secreto: string, id: string, exp: string) =>
  createHmac('sha256', secreto).update(`${id}.${exp}`, 'utf8').digest('base64url')

const venceEn = (exp: number) => new Date(exp * 1000).toISOString()

export function firmarTokenDeSolicitud(
  solicitudId: string,
  dependencias: Firmar = {},
): Resultado<TokenDeSolicitud> {
  const secreto = (dependencias.entorno ?? entornoDelServidor()).TOKEN_FIRMA_SECRETO
  if (!secreto) return fallo('inesperado', MENSAJE_INESPERADO)
  const id = esquemaDeId.safeParse(solicitudId.toLowerCase())
  const emitido = (dependencias.emitidoEn ?? new Date()).getTime()
  if (!id.success || Number.isNaN(emitido)) {
    return fallo('validacion', 'No se pudo firmar el enlace: la solicitud no es válida.')
  }
  const exp = Math.floor(emitido / 1000) + DURACION_SEGUNDOS
  const token = `${id.data}.${String(exp)}.${firma(secreto, id.data, String(exp))}`
  return ok({ token, venceEn: venceEn(exp) })
}

// Los tres segmentos, o `null` si el token no tiene la forma exacta.
function partes(token: string): { id: string; exp: string; recibida: string } | null {
  const [id = '', exp = '', recibida = '', ...sobra] = token.split('.')
  const conForma =
    sobra.length === 0 && esquemaDeId.safeParse(id).success && EXP.test(exp) && FIRMA.test(recibida)
  return conForma ? { id, exp, recibida } : null
}

// La firma se compara (en tiempo constante) antes de mirar el vencimiento: un `exp` manipulado nunca llega a decir «venció».
// Inválido y vencido dicen lo mismo; sólo cambia el código (`validacion` o `regla`).
export function verificarTokenDeSolicitud(
  token: string,
  dependencias: Verificar = {},
): Resultado<SolicitudDelToken> {
  const secreto = (dependencias.entorno ?? entornoDelServidor()).TOKEN_FIRMA_SECRETO
  if (!secreto) return fallo('inesperado', MENSAJE_INESPERADO)
  const segmentos = partes(token)
  if (!segmentos) return fallo('validacion', TEXTO_TOKEN_VENCIDO)
  const { id, exp, recibida } = segmentos
  if (!igualesEnTiempoConstante(recibida, firma(secreto, id, exp))) {
    return fallo('validacion', TEXTO_TOKEN_VENCIDO)
  }
  // Escrito como «no está antes del vencimiento»: con un reloj inválido (`NaN`) también falla cerrado.
  const ahora = (dependencias.ahora ?? new Date()).getTime()
  if (!(ahora < Number(exp) * 1000)) return fallo('regla', TEXTO_TOKEN_VENCIDO)
  return ok({ solicitudId: id, venceEn: venceEn(Number(exp)) })
}
