import { entornoDelServidor, type EntornoDelServidor } from '../../config/servidor'
import { fallo, MENSAJE_INESPERADO, ok, type Resultado } from '../errores'
import { sha256Hex } from './cripto'
import { ipParaLimite } from './ip'
import { TEXTO_LIMITE } from './textos'

// El límite de envíos por IP (C7, F8): cada acción lleva su propio contador por hora. La IP nunca sale en claro: la clave es
// `<accion>:<sha256(ip + IP_SAL_SECRETO)>` (semilla §3, tabla `limites`). Quién cuenta entra por parámetro (`ContarEnvio`):
// `contadorDeSupabase(cliente)`, sobre la RPC `contar_envio`, con el cliente que le pasa la ruta; en las pruebas,
// `crearContadorEnMemoria`.

export const VENTANA_SEGUNDOS = 3600

export const LIMITES = {
  formulario: 5,
  detalle: 5,
  reservas: 10,
  whatsapp: 30,
  eventos: 60,
} as const satisfies Record<string, number>

export type AccionLimitada = keyof typeof LIMITES

// El contrato de quien cuenta, ventana fija: si no hay fila o `ahora >= ventana_inicio + ventana`, la ventana empieza ahora
// con conteo 1; si no, el conteo suma 1. Devuelve si el envío está permitido: `conteo <= maximo`.
export type ContarEnvio = (pedido: {
  clave: string
  maximo: number
  ventanaSegundos: number
}) => Promise<Resultado<boolean>>

type Dependencias = { entorno?: EntornoDelServidor }

export function claveDeLimite(accion: AccionLimitada, ip: string, sal: string): string {
  return `${accion}:${sha256Hex(ipParaLimite(ip) + sal)}`
}

// Falla cerrado: sin sal, o si quien cuenta falla, el envío no pasa.
export async function limitar(
  accion: AccionLimitada,
  ip: string,
  contar: ContarEnvio,
  dependencias: Dependencias = {},
): Promise<Resultado<null>> {
  const sal = (dependencias.entorno ?? entornoDelServidor()).IP_SAL_SECRETO
  if (!sal) return fallo('inesperado', MENSAJE_INESPERADO)
  const pedido = {
    clave: claveDeLimite(accion, ip, sal),
    maximo: LIMITES[accion],
    ventanaSegundos: VENTANA_SEGUNDOS,
  }
  let conteo: Resultado<boolean>
  try {
    conteo = await contar(pedido)
  } catch {
    return fallo('inesperado', MENSAJE_INESPERADO)
  }
  if (!conteo.ok) return conteo
  return conteo.data ? ok(null) : fallo('regla', TEXTO_LIMITE)
}
