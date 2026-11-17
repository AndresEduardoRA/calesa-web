import { vi } from 'vitest'

import type { ErrorPostgrest } from '../errores'
import { crearContadorEnMemoria } from './contador-en-memoria.soporte'
import type { ArgumentosDeContarEnvio, ClienteDeContarEnvio } from './contador-de-supabase'

// Los clientes falsos de las pruebas de `contadorDeSupabase`. No son de producción: no se exportan en `index.ts` y se importan por
// su ruta. Los dos guardan la llamada en un `vi.fn` para ver con qué argumentos se llamó a `rpc`.

// Lo que trae un error de PostgREST de verdad: además de `code` y `message`, la RPC pone el parámetro en `hint`.
export type ErrorDeRpc = ErrorPostgrest & { hint?: string | null; details?: string | null }

export type RespuestaDeRpc = { data: unknown; error: ErrorDeRpc | null }

// Simula `contar_envio` con el contrato en memoria: traduce `p_*` al pedido de `crearContadorEnMemoria`.
export function clienteEnMemoria(reloj: () => Date) {
  const contar = crearContadorEnMemoria(reloj)
  const rpc = vi.fn(
    async (_fn: 'contar_envio', args: ArgumentosDeContarEnvio): Promise<RespuestaDeRpc> => {
      const resultado = await contar({
        clave: args.p_clave,
        maximo: args.p_maximo,
        ventanaSegundos: args.p_ventana_segundos,
      })
      return resultado.ok
        ? { data: resultado.data, error: null }
        : { data: null, error: { code: 'P0001', message: resultado.error.mensaje } }
    },
  )
  return { rpc } satisfies ClienteDeContarEnvio
}

// Responde siempre lo mismo, o lo que devuelva `responder` (que puede lanzar o rechazar).
export function clienteQueResponde(
  respuesta: RespuestaDeRpc | (() => PromiseLike<RespuestaDeRpc>),
) {
  const rpc = vi.fn(
    (_fn: 'contar_envio', _args: ArgumentosDeContarEnvio): PromiseLike<RespuestaDeRpc> =>
      typeof respuesta === 'function' ? respuesta() : Promise.resolve(respuesta),
  )
  return { rpc } satisfies ClienteDeContarEnvio
}
