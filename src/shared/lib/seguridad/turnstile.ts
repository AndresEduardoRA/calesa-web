import { z } from 'zod'

import { entornoDelServidor, type EntornoDelServidor } from '../../config/servidor'
import { fallo, MENSAJE_INESPERADO, ok, type Resultado } from '../errores'
import { IP_DESCONOCIDA } from './ip'
import { TEXTO_TURNSTILE } from './textos'

// Cloudflare Turnstile del lado del servidor, antes de cualquier escritura (C7). Contrato de siteverify según
// https://developers.cloudflare.com/turnstile/get-started/server-side-validation/ (contrastado el 2026-11-17): POST
// form-urlencoded con `secret`, `response` y `remoteip` opcional; token de hasta 2048 caracteres; responde JSON con `success`
// y `error-codes`. Falla cerrado. Nunca registra el token ni el secreto.

export const URL_SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

const TOPE_MS = 5000
const LARGO_MAXIMO = 2048
const ERRORES_DEL_SECRETO = new Set(['missing-input-secret', 'invalid-input-secret'])

const esquemaDeRespuesta = z.object({
  success: z.boolean(),
  'error-codes': z.array(z.string()).optional(),
})

type Respuesta = z.infer<typeof esquemaDeRespuesta>

// `ip`: la IP completa de `ipDelPedido`, nunca la de `ipParaLimite` (el /64 no es una dirección).
type Dependencias = { ip?: string; entorno?: EntornoDelServidor; pedir?: typeof fetch }

async function consultar(cuerpo: URLSearchParams, pedir: typeof fetch): Promise<Respuesta | null> {
  try {
    const respuesta = await pedir(URL_SITEVERIFY, {
      method: 'POST',
      body: cuerpo,
      signal: AbortSignal.timeout(TOPE_MS),
    })
    if (!respuesta.ok) return null
    const datos = esquemaDeRespuesta.safeParse(await respuesta.json())
    return datos.success ? datos.data : null
  } catch {
    return null
  }
}

export async function verificarTurnstile(
  token: string,
  dependencias: Dependencias = {},
): Promise<Resultado<null>> {
  if (token === '' || token.length > LARGO_MAXIMO) return fallo('validacion', TEXTO_TURNSTILE)
  const secreto = (dependencias.entorno ?? entornoDelServidor()).TURNSTILE_SECRET_KEY
  if (!secreto) return fallo('inesperado', MENSAJE_INESPERADO)
  const cuerpo = new URLSearchParams({ secret: secreto, response: token })
  const { ip } = dependencias
  if (ip && ip !== IP_DESCONOCIDA) cuerpo.set('remoteip', ip)
  return interpretar(await consultar(cuerpo, dependencias.pedir ?? fetch))
}

// Sin respuesta válida, o con un error del secreto (el servidor está mal configurado), es `inesperado`; cualquier otro
// rechazo es de la persona y reintentar sirve.
function interpretar(respuesta: Respuesta | null): Resultado<null> {
  if (!respuesta) return fallo('inesperado', MENSAJE_INESPERADO)
  if (respuesta.success) return ok(null)
  const delSecreto = respuesta['error-codes']?.find((codigo) => ERRORES_DEL_SECRETO.has(codigo))
  if (delSecreto) {
    console.error(`Turnstile rechazó el secreto del servidor (${delSecreto}).`)
    return fallo('inesperado', MENSAJE_INESPERADO)
  }
  return fallo('validacion', TEXTO_TURNSTILE)
}
