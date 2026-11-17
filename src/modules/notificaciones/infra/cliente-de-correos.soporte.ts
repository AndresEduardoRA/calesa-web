// Los clientes falsos de las pruebas de `registroDeSupabase` (no salen por `index.ts`). `clienteSobreMemoria` simula las 9 RPC de P27 con
// el registro en memoria: traduce los `p_*` al contrato y contesta como PostgREST (fechas con `+00:00`, `null` sin fila, códigos de error).
// `clienteQueResponde` devuelve lo que se le diga. Los dos guardan cada llamada en un `vi.fn`.
import { vi } from 'vitest'

import type { ErrorPostgrest, Resultado } from '@/shared/lib/errores'
import type { FilaDeCorreo, NuevaFila } from '../entities/registro'
import type { ClienteDeCorreos, FuncionDeCorreo } from './registro-de-supabase'
import { RegistroEnMemoria } from './registro-en-memoria.soporte'

export type ErrorDeRpc = ErrorPostgrest & { hint?: string | null }
export type RespuestaDeRpc = { data: unknown; error: ErrorDeRpc | null }

// Los `p_*` de las 9 RPC, todos opcionales y sin tipo: el cliente falso los lee por nombre.
type Argumentos = {
  p_id?: unknown
  p_referencia?: unknown
  p_para?: unknown
  p_plantilla?: unknown
  p_datos?: unknown
  p_adjunto_ics?: unknown
  p_estado?: unknown
  p_resend_id?: unknown
  p_programado_para?: unknown
  p_intentos?: unknown
  p_ultimo_error?: unknown
  p_enviado_en?: unknown
  p_cambiar_resend_id?: unknown
  p_reunion_id?: unknown
  p_solicitud_id?: unknown
  p_ahora?: unknown
  p_tope?: unknown
}

const DATO_INVALIDO = 'Un dato del correo no es válido.'

// Lo que escribe `to_jsonb(timestamptz)` en una base en UTC.
const conZona = (iso: string | null) => (iso === null ? null : iso.replace('Z', '+00:00'))

function comoJson(fila: FilaDeCorreo) {
  return {
    ...fila,
    programadoPara: conZona(fila.programadoPara),
    enviadoEn: conZona(fila.enviadoEn),
  }
}

function comoRespuesta(r: Resultado<FilaDeCorreo | FilaDeCorreo[]>): RespuestaDeRpc {
  if (r.ok)
    return { data: Array.isArray(r.data) ? r.data.map(comoJson) : comoJson(r.data), error: null }
  const { codigo, mensaje } = r.error
  if (codigo === 'no_encontrado') return { data: null, error: null }
  if (codigo === 'duplicado')
    return { data: null, error: { code: '23505', message: mensaje, hint: 'p_referencia' } }
  if (codigo === 'regla' && mensaje === DATO_INVALIDO)
    return { data: null, error: { code: '22023', message: mensaje, hint: 'p_estado' } }
  return { data: null, error: { code: codigo === 'regla' ? 'P0001' : 'XX000', message: mensaje } }
}

const texto = (v: unknown): string => String(v)
const textoONulo = (v: unknown): string | null => (v === undefined || v === null ? null : String(v))

function nuevaDe(a: Argumentos): NuevaFila {
  return {
    para: texto(a.p_para),
    plantilla: texto(a.p_plantilla),
    datos: a.p_datos as Record<string, unknown>,
    adjuntoIcs: textoONulo(a.p_adjunto_ics),
    estado: texto(a.p_estado) as NuevaFila['estado'],
    resendId: textoONulo(a.p_resend_id),
    programadoPara: textoONulo(a.p_programado_para),
    intentos: Number(a.p_intentos ?? 0),
    ultimoError: textoONulo(a.p_ultimo_error),
    enviadoEn: textoONulo(a.p_enviado_en),
    referencia: textoONulo(a.p_referencia),
    reunionId: textoONulo(a.p_reunion_id),
    solicitudId: textoONulo(a.p_solicitud_id),
  }
}

function reprogramar(memoria: RegistroEnMemoria, a: Argumentos): Promise<RespuestaDeRpc> {
  const conBandera = a.p_cambiar_resend_id === true
  if (!conBandera && a.p_resend_id !== undefined)
    return Promise.resolve({
      data: null,
      error: { code: '22023', message: DATO_INVALIDO, hint: 'p_resend_id' },
    })
  const resendId = conBandera ? textoONulo(a.p_resend_id) : undefined
  return memoria
    .marcarReprogramado(texto(a.p_id), texto(a.p_programado_para), resendId)
    .then((r) => comoRespuesta(r))
}

async function marcar(
  memoria: RegistroEnMemoria,
  fn: FuncionDeCorreo,
  a: Argumentos,
): Promise<RespuestaDeRpc | null> {
  switch (fn) {
    case 'marcar_correo_enviado':
      return comoRespuesta(
        await memoria.marcarEnviado(texto(a.p_id), {
          resendId: textoONulo(a.p_resend_id),
          intentos: Number(a.p_intentos),
          enviadoEn: texto(a.p_enviado_en),
        }),
      )
    case 'marcar_correo_fallido':
      return comoRespuesta(
        await memoria.marcarFallido(texto(a.p_id), {
          intentos: Number(a.p_intentos),
          ultimoError: texto(a.p_ultimo_error),
        }),
      )
    case 'marcar_correo_cancelado':
      return comoRespuesta(await memoria.marcarCancelado(texto(a.p_id)))
    case 'marcar_correo_reprogramado':
      return reprogramar(memoria, a)
    case 'correo_por_referencia':
    case 'correo_por_id':
    case 'registrar_correo':
    case 'correos_programados_de':
    case 'correos_vencidos':
      return null
  }
}

const tope = (a: Argumentos): number => Number(a.p_tope ?? 50)
const quienDe = (a: Argumentos) =>
  a.p_reunion_id === undefined
    ? { solicitudId: texto(a.p_solicitud_id) }
    : { reunionId: texto(a.p_reunion_id) }

async function consultar(
  memoria: RegistroEnMemoria,
  fn: FuncionDeCorreo,
  a: Argumentos,
): Promise<RespuestaDeRpc | null> {
  switch (fn) {
    case 'correo_por_referencia':
      return comoRespuesta(await memoria.porReferencia(texto(a.p_referencia)).then(nulaONo))
    case 'correo_por_id':
      return comoRespuesta(await memoria.porId(texto(a.p_id)).then(nulaONo))
    case 'registrar_correo':
      return comoRespuesta(await memoria.registrar(nuevaDe(a)))
    case 'correos_programados_de':
      return comoRespuesta(await memoria.programadosDe(quienDe(a), tope(a)))
    case 'correos_vencidos':
      return comoRespuesta(await memoria.vencidos(texto(a.p_ahora), tope(a)))
    case 'marcar_correo_enviado':
    case 'marcar_correo_fallido':
    case 'marcar_correo_cancelado':
    case 'marcar_correo_reprogramado':
      return null
  }
}

async function responder(
  memoria: RegistroEnMemoria,
  fn: FuncionDeCorreo,
  a: Argumentos,
): Promise<RespuestaDeRpc> {
  return (
    (await marcar(memoria, fn, a)) ??
    (await consultar(memoria, fn, a)) ?? { data: null, error: { code: 'XX000', message: '?' } }
  )
}

// Una lectura sin fila: la RPC contesta `null`, no un error.
const nulaONo = (r: Resultado<FilaDeCorreo | null>): Resultado<FilaDeCorreo> =>
  r.ok && r.data === null
    ? { ok: false, error: { codigo: 'no_encontrado', mensaje: '' } }
    : (r as Resultado<FilaDeCorreo>)

export function clienteSobreMemoria() {
  const memoria = new RegistroEnMemoria()
  const rpc = vi.fn((fn: FuncionDeCorreo, args: Argumentos) => responder(memoria, fn, args))
  return { rpc, memoria } satisfies ClienteDeCorreos & { memoria: RegistroEnMemoria }
}

export function clienteQueResponde(
  respuesta: RespuestaDeRpc | (() => PromiseLike<RespuestaDeRpc>),
) {
  const rpc = vi.fn(() =>
    typeof respuesta === 'function' ? respuesta() : Promise.resolve(respuesta),
  )
  return { rpc } satisfies ClienteDeCorreos
}
