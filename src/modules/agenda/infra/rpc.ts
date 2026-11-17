// Las RPC de la agenda pública (P05), por un puerto: `LlamarRpc`. Las cuatro son sólo de `service_role`; el cliente que las llama lo
// arma quien cablea la ruta (P36), nunca este archivo. Cada respuesta se valida con Zod y cada error se traduce con la tabla C3.
//
// El adaptador de la ruta hace un único cast: `(fn, args) => admin.rpc(fn, args as Database['public']['Functions'][typeof fn]['Args'])`.
// Es seguro porque el generador de tipos no marca nulables los argumentos de una función SQL y aquí el `satisfies` ya fija las claves;
// sólo `reservar_reunion` y `datos_para_horas` reciben un nulo, y las dos rechazan con `22023` lo que no sea exactamente uno.
import type { z } from 'zod'
import {
  errorDePostgrest,
  fallo,
  MENSAJE_INESPERADO,
  ok,
  type ErrorPostgrest,
  type Resultado,
} from '@/shared/lib/errores'
import type { Database } from '@/shared/types/database.types'
import {
  esquemaDatosParaHoras,
  esquemaResumenReunion,
  type DatosParaHoras,
  type ResumenReunion,
} from '../entities/respuestas'
import type { TokenLeido } from './tokens'

export type RpcDeAgenda =
  'datos_para_horas' | 'reservar_reunion' | 'cambiar_reunion' | 'cancelar_reunion'

type Funciones = Database['public']['Functions']
// Las claves exactas de la RPC generada: si la base renombra un argumento, cae `typecheck`.
type ArgumentosDe<F extends RpcDeAgenda> = Record<keyof Funciones[F]['Args'], string | null>

export type LlamarRpc = (
  fn: RpcDeAgenda,
  args: Record<string, string | null>,
) => PromiseLike<{ data: unknown; error: ErrorPostgrest | null }>

// El registro lleva la función y el código, nunca los argumentos: ahí van el token, su hash y datos de la persona.
function inesperado(fn: RpcDeAgenda, codigo: string): Resultado<never> {
  console.error(`agenda: ${fn} ${codigo}`)
  return fallo('inesperado', MENSAJE_INESPERADO)
}

// P0001 (las reglas E1–E8) y PT409 (E7) llegan con el texto para la persona; sin código, un pedido que no llegó.
function errorDeRpc(fn: RpcDeAgenda, error: ErrorPostgrest): Resultado<never> {
  const legible = error.code === 'P0001' || error.code === 'PT409'
  if (legible || !error.code) {
    const traducido = errorDePostgrest(error)
    if (traducido.codigo === 'inesperado') {
      console.error(`agenda: ${fn} sin-codigo`)
    }
    return { ok: false, error: traducido }
  }
  return inesperado(fn, error.code)
}

async function llamarYValidar<F extends RpcDeAgenda, T>(
  llamar: LlamarRpc,
  fn: F,
  args: ArgumentosDe<F>,
  esquema: z.ZodType<T>,
): Promise<Resultado<T>> {
  let respuesta: Awaited<ReturnType<LlamarRpc>>
  try {
    respuesta = await llamar(fn, args)
  } catch {
    return inesperado(fn, 'excepcion')
  }
  if (respuesta.error) {
    return errorDeRpc(fn, respuesta.error)
  }
  const datos = esquema.safeParse(respuesta.data)
  return datos.success ? ok(datos.data) : inesperado(fn, 'respuesta')
}

export function leerDatosParaHoras(
  llamar: LlamarRpc,
  token: TokenLeido,
): Promise<Resultado<DatosParaHoras>> {
  const args = {
    p_solicitud_id: token.tipo === 'solicitud' ? token.solicitudId : null,
    p_token_hash: token.tipo === 'gestion' ? token.hash : null,
  } satisfies ArgumentosDe<'datos_para_horas'>
  return llamarYValidar(llamar, 'datos_para_horas', args, esquemaDatosParaHoras)
}

// Con un token de solicitud, la solicitud nueva; con uno de gestión, volver a reservar (R4.16) con el hash del token anterior.
export function reservarEnLaBase(
  llamar: LlamarRpc,
  pedido: { token: TokenLeido; inicio: string; zona: string; tokenHash: string },
): Promise<Resultado<ResumenReunion>> {
  const { token } = pedido
  const args = {
    p_solicitud_id: token.tipo === 'solicitud' ? token.solicitudId : null,
    p_token_anterior: token.tipo === 'gestion' ? token.hash : null,
    p_inicio: pedido.inicio,
    p_zona_visitante: pedido.zona,
    p_token_hash: pedido.tokenHash,
  } satisfies ArgumentosDe<'reservar_reunion'>
  return llamarYValidar(llamar, 'reservar_reunion', args, esquemaResumenReunion)
}

export function cambiarEnLaBase(
  llamar: LlamarRpc,
  pedido: { hash: string; inicio: string; actualizadoEn: string },
): Promise<Resultado<ResumenReunion>> {
  const args = {
    p_token_hash: pedido.hash,
    p_inicio: pedido.inicio,
    p_actualizado_en_esperado: pedido.actualizadoEn,
  } satisfies ArgumentosDe<'cambiar_reunion'>
  return llamarYValidar(llamar, 'cambiar_reunion', args, esquemaResumenReunion)
}

export function cancelarEnLaBase(
  llamar: LlamarRpc,
  pedido: { hash: string; actualizadoEn: string },
): Promise<Resultado<ResumenReunion>> {
  const args = {
    p_token_hash: pedido.hash,
    p_actualizado_en_esperado: pedido.actualizadoEn,
  } satisfies ArgumentosDe<'cancelar_reunion'>
  return llamarYValidar(llamar, 'cancelar_reunion', args, esquemaResumenReunion)
}
