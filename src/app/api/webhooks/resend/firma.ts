import { createHmac } from 'node:crypto'

import { igualesEnTiempoConstante } from '@/shared/lib/seguridad'

// La firma de los webhooks de Resend, que firma con Svix (verificado en su documentación el 2026-11-17: resend.com/docs/dashboard/
// webhooks/verify-webhooks-requests y docs.svix.com/receiving/verifying-payloads/how-manual). Lo firmado es
// `<svix-id>.<svix-timestamp>.<cuerpo crudo>`, con HMAC-SHA256 y la clave en base64 tras `whsec_`; la firma va en base64, y
// `svix-signature` trae una o varias `v1,<firma>` separadas por espacio. Vive junto a su única ruta: moverla a `shared` es un `git mv`.

// La documentación no fija la tolerancia: 5 min, para los dos lados, contra el replay (decisión de P13).
export const TOLERANCIA_DE_FIRMA_S = 300
// Las entradas de `svix-signature` que se miran: una cabecera con miles no hace miles de comparaciones.
const MAXIMO_DE_FIRMAS = 10
const PREFIJO_DEL_SECRETO = 'whsec_'
const VERSION = 'v1,'
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/
const SEGUNDOS = /^\d{1,12}$/

function claveDelSecreto(secreto: string | null | undefined): Buffer | null {
  if (!secreto?.startsWith(PREFIJO_DEL_SECRETO)) {
    return null
  }
  const base64 = secreto.slice(PREFIJO_DEL_SECRETO.length)
  if (!BASE64.test(base64)) {
    return null
  }
  const clave = Buffer.from(base64, 'base64')
  return clave.length > 0 ? clave : null
}

function calcular(clave: Buffer, id: string, timestamp: string, cuerpo: Uint8Array): string {
  // Los bytes del cuerpo tal como llegaron, nunca un texto reconstruido: un JSON reserializado no casa.
  return createHmac('sha256', clave)
    .update(`${id}.${timestamp}.`, 'utf8')
    .update(cuerpo)
    .digest('base64')
}

type ParaFirmar = { secreto: string; id: string; timestamp: string; cuerpo: Uint8Array }

// La firma `v1,<base64>` de un cuerpo, o null sin un secreto válido. La usa la verificación y la arman las pruebas.
export function firmarCuerpoDeResend({
  secreto,
  id,
  timestamp,
  cuerpo,
}: ParaFirmar): string | null {
  const clave = claveDelSecreto(secreto)
  return clave ? `${VERSION}${calcular(clave, id, timestamp, cuerpo)}` : null
}

export type FirmaDeResend = {
  id: string | null
  timestamp: string | null
  firmas: string | null
  cuerpo: Uint8Array
  secreto: string | null | undefined
  ahora: Date
}

function vigente(timestamp: string, ahora: Date): boolean {
  if (!SEGUNDOS.test(timestamp)) {
    return false
  }
  return Math.abs(ahora.getTime() / 1000 - Number(timestamp)) <= TOLERANCIA_DE_FIRMA_S
}

// true sólo con las tres cabeceras, un secreto válido, el timestamp a ≤ 5 min y alguna `v1,` igual (en tiempo constante) entre las
// primeras 10. Nunca lanza ni registra nada.
export function verificarFirmaDeResend(f: FirmaDeResend): boolean {
  try {
    const clave = claveDelSecreto(f.secreto)
    if (!clave || !f.id || !f.timestamp || !f.firmas || !vigente(f.timestamp, f.ahora)) {
      return false
    }
    const esperada = calcular(clave, f.id, f.timestamp, f.cuerpo)
    return f.firmas
      .split(' ')
      .slice(0, MAXIMO_DE_FIRMAS)
      .some(
        (entrada) =>
          entrada.startsWith(VERSION) &&
          igualesEnTiempoConstante(entrada.slice(VERSION.length), esperada),
      )
  } catch {
    return false
  }
}
