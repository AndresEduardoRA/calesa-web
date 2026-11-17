import { z } from 'zod'

import type { Database } from '../../types/database.types'
import {
  errorDePostgrest,
  fallo,
  MENSAJE_INESPERADO,
  MENSAJE_SIN_CONEXION,
  MENSAJE_SIN_RESPUESTA,
  ok,
  type ErrorPostgrest,
  type Resultado,
} from '../errores'
import type { ContarEnvio } from './limites'

// Quien cuenta de verdad: `ContarEnvio` sobre la RPC `contar_envio` (P32), que aplica la ventana fija en una sola sentencia. El cliente
// entra por parámetro y lo arma quien cablea la ruta (P11, P34), **por petición**: nunca en un `const` a nivel de módulo, porque el
// contador lo guarda y el admin no vive en una variable global. Este archivo no importa `@supabase/*` ni el admin.
//
// Todo falla cerrado: un pedido fuera de rango, un error de la RPC, una respuesta que no es booleana o una llamada que lanza dan
// `inesperado`, y `limitar` no deja pasar el envío. El visitante nunca lee el texto de la RPC (su `22023` dice «La clave del límite de
// envíos no es válida.»): de lo que da `errorDePostgrest` sólo pasan los textos del kit.

export type ArgumentosDeContarEnvio = Database['public']['Functions']['contar_envio']['Args']

// Lo mínimo que se usa del cliente de Supabase: un `SupabaseClient<Database>` (el del servidor o el admin) entra sin cast.
export type ClienteDeContarEnvio = {
  rpc(
    fn: 'contar_envio',
    args: ArgumentosDeContarEnvio,
  ): PromiseLike<{ data: unknown; error: ErrorPostgrest | null }>
}

// Los rangos de la RPC (P32): con ellos, un `22023` sólo puede venir de un desacuerdo entre este esquema y la base.
const esquemaDelPedido = z.object({
  clave: z.string().min(1).max(200),
  maximo: z.int32().min(1),
  ventanaSegundos: z.int().min(1).max(86_400),
})

const esquemaDeLaRespuesta = z.boolean()

// Los únicos textos de `errorDePostgrest` que llegan al visitante: los del kit para un pedido que no llegó.
const TEXTOS_QUE_PASAN: ReadonlySet<string> = new Set([
  MENSAJE_SIN_RESPUESTA,
  MENSAJE_SIN_CONEXION,
  MENSAJE_INESPERADO,
])

// El registro lleva sólo el motivo (el código, `sin-codigo`, `respuesta`, `excepcion` o `pedido`): nunca la clave ni el texto.
function inesperado(motivo: string, mensaje: string = MENSAJE_INESPERADO): Resultado<never> {
  console.error(`limites: contar_envio ${motivo}`)
  return fallo('inesperado', mensaje)
}

function errorDeLaRpc(error: ErrorPostgrest): Resultado<never> {
  const { mensaje } = errorDePostgrest(error)
  return inesperado(
    error.code || 'sin-codigo',
    TEXTOS_QUE_PASAN.has(mensaje) ? mensaje : MENSAJE_INESPERADO,
  )
}

export function contadorDeSupabase(cliente: ClienteDeContarEnvio): ContarEnvio {
  return async (pedido) => {
    const validado = esquemaDelPedido.safeParse(pedido)
    if (!validado.success) {
      return inesperado('pedido')
    }
    const { clave, maximo, ventanaSegundos } = validado.data
    const argumentos = {
      p_clave: clave,
      p_maximo: maximo,
      p_ventana_segundos: ventanaSegundos,
    } satisfies ArgumentosDeContarEnvio
    let respuesta: { data: unknown; error: ErrorPostgrest | null }
    try {
      respuesta = await cliente.rpc('contar_envio', argumentos)
    } catch {
      return inesperado('excepcion')
    }
    if (respuesta.error) {
      return errorDeLaRpc(respuesta.error)
    }
    const permitido = esquemaDeLaRespuesta.safeParse(respuesta.data)
    if (!permitido.success) {
      return inesperado('respuesta')
    }
    return ok(permitido.data)
  }
}
