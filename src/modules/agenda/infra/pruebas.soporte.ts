// Dobles de las pruebas de los casos públicos (`*.soporte.*`): un `LlamarRpc` y unos correos que anotan lo que reciben, el entorno y
// los tokens de prueba. Las respuestas de ejemplo de la base están en `entities/respuestas.soporte.ts`. No sale por `index.ts`.
import type { EntornoDelServidor } from '@/shared/config/servidor'
import { fallo, ok, type ErrorPostgrest, type Resultado } from '@/shared/lib/errores'
import type { LlamarRpc, RpcDeAgenda } from './rpc'

export {
  ANTERIOR,
  REUNION,
  SOLICITUD,
  datosParaHoras,
  resumen,
  reunionDelToken,
} from '../entities/respuestas.soporte'

export const SITIO = 'https://calesa.test'

export const ENTORNO = {
  SUPABASE_SECRET_KEY: 's',
  EMAIL_PROVEEDOR: 'ninguno',
  TOKEN_FIRMA_SECRETO: 'secreto-de-firma-de-prueba-0123456789abcdef',
  IP_SAL_SECRETO: 'sal-de-prueba-para-las-ip-0123456789abcdef',
} as EntornoDelServidor

// Un token de gestión canónico: 32 bytes en cero, en base64url sin relleno.
export const TOKEN_GESTION = 'A'.repeat(43)

type Respuesta = { data: unknown; error: ErrorPostgrest | null }
export type Llamada = { fn: RpcDeAgenda; args: Record<string, string | null> }

// Un `LlamarRpc` que contesta por función y anota cada llamada en orden.
export function rpcFalsa(respuestas: Partial<Record<RpcDeAgenda, Respuesta>>) {
  const llamadas: Llamada[] = []
  const llamar: LlamarRpc = (fn, args) => {
    llamadas.push({ fn, args })
    const sinRespuesta = { data: null, error: { code: 'XX000', message: 'sin respuesta' } }
    return Promise.resolve(respuestas[fn] ?? sinRespuesta)
  }
  return { llamar, llamadas }
}

export type Pedido =
  | { metodo: 'enviarAhora' | 'programar'; para?: string; datos: unknown; cuando?: string }
  | { metodo: 'cancelarDeReunion' | 'cancelarDeSolicitud'; id: string }

type Envio = { para?: string; datos: unknown }

// Unos correos (la forma de `CorreosDeAgenda`) que anotan cada pedido en orden. `falla` decide, por pedido, si el puerto devuelve
// un fallo o lanza.
export function correosFalsos(
  falla: (pedido: Pedido) => 'fallo' | 'excepcion' | null = () => null,
) {
  const pedidos: Pedido[] = []
  const responder = (pedido: Pedido): Promise<Resultado<unknown>> => {
    pedidos.push(pedido)
    const modo = falla(pedido)
    if (modo === 'excepcion') {
      return Promise.reject(new Error('el proveedor no responde'))
    }
    return Promise.resolve(modo === 'fallo' ? fallo('inesperado', 'no salió') : ok(null))
  }
  const correos = {
    enviarAhora: ({ para, datos }: Envio) => responder({ metodo: 'enviarAhora', para, datos }),
    programar: ({ para, datos, cuando }: Envio & { cuando: string }) =>
      responder({ metodo: 'programar', para, datos, cuando }),
    cancelarDeReunion: (id: string) => responder({ metodo: 'cancelarDeReunion', id }),
    cancelarDeSolicitud: (id: string) => responder({ metodo: 'cancelarDeSolicitud', id }),
  }
  return { correos, pedidos }
}
