import { z } from 'zod'

import {
  errorDePostgrest,
  fallo,
  MENSAJE_INESPERADO,
  ok,
  type ErrorPostgrest,
  type Resultado,
} from '@/shared/lib/errores'
import type { Database } from '@/shared/types/database.types'
import type { FilaDeCorreo, NuevaFila, Quien, RegistroDeCorreos } from '../entities/registro'
import { datosComoJson, esquemaDeFila, esquemaDeFilas } from './fila-de-correo'

// El registro de correos de verdad: `RegistroDeCorreos` sobre las 9 RPC de `correos_salientes` (P27). El cliente entra por parámetro y lo
// arma quien cablea la ruta (P11, P13, P15, P36), **por petición**: nunca en un `const` de módulo, porque el cliente es el admin
// (`service_role`: es lo único que ejecuta estas RPC) y el admin no vive en una variable global. Este archivo no importa `@supabase/*` ni
// el admin. Lo que lee una RPC se valida con Zod; un error es un valor, nunca una excepción.

type Funciones = Database['public']['Functions']
export type FuncionDeCorreo =
  | 'correo_por_referencia'
  | 'correo_por_id'
  | 'registrar_correo'
  | 'marcar_correo_enviado'
  | 'marcar_correo_fallido'
  | 'marcar_correo_cancelado'
  | 'marcar_correo_reprogramado'
  | 'correos_programados_de'
  | 'correos_vencidos'

// Lo mínimo que se usa del cliente: un `SupabaseClient<Database>` (el admin) entra sin cast. La RPC pone el parámetro en `hint`.
export type ClienteDeCorreos = {
  rpc<F extends FuncionDeCorreo>(
    fn: F,
    args: Funciones[F]['Args'],
  ): PromiseLike<{ data: unknown; error: (ErrorPostgrest & { hint?: string | null }) | null }>
}

const MENSAJE_SIN_PERMISO = 'No se pudo leer ni escribir el registro de correos.'
const NO_ENCONTRADO = 'No se encontró el correo.'
const esGuid = (valor: string): boolean => z.guid().safeParse(valor).success

// Los únicos errores que son parte del contrato y no se registran: una referencia repetida y una transición que la tabla no permite.
const ESPERADOS: ReadonlySet<string> = new Set(['23505', 'P0001'])
// Los textos de estas tres RPC están escritos para la persona (P27): pasan tal cual. Lo demás, sólo el del kit.
const CON_TEXTO_PROPIO: ReadonlySet<string> = new Set(['23505', '22023', 'P0001'])

// Una línea con el motivo (el código, `sin-codigo`, `respuesta`, `excepcion` o `datos`): nunca argumentos, datos ni el texto del error.
function registrarMotivo(fn: string, motivo: string): void {
  console.error(`notificaciones: ${fn} ${motivo}`)
}

function inesperado(fn: string, motivo: string): Resultado<never> {
  registrarMotivo(fn, motivo)
  return fallo('inesperado', MENSAJE_INESPERADO)
}

function errorDeLaRpc(
  fn: string,
  error: ErrorPostgrest & { hint?: string | null },
): Resultado<never> {
  const codigo = error.code ?? ''
  const app = errorDePostgrest(error)
  if (!ESPERADOS.has(codigo)) {
    const pista = codigo === '22023' && /^[a-z_]{1,40}$/.test(error.hint ?? '') ? error.hint : null
    registrarMotivo(fn, `${codigo || 'sin-codigo'}${pista ? ` hint=${pista}` : ''}`)
  }
  if (CON_TEXTO_PROPIO.has(codigo) || app.codigo === 'inesperado') return { ok: false, error: app }
  return app.codigo === 'sin_permiso'
    ? fallo('sin_permiso', MENSAJE_SIN_PERMISO)
    : fallo('inesperado', MENSAJE_INESPERADO)
}

// Llama a la RPC y devuelve lo que contestó, sin leerlo: un error de la RPC o una excepción ya son un `Resultado` fallido.
async function llamar<F extends FuncionDeCorreo>(
  cliente: ClienteDeCorreos,
  fn: F,
  args: Funciones[F]['Args'],
): Promise<Resultado<unknown>> {
  try {
    const respuesta = await cliente.rpc(fn, args)
    return respuesta.error ? errorDeLaRpc(fn, respuesta.error) : ok(respuesta.data)
  } catch {
    return inesperado(fn, 'excepcion')
  }
}

function leer<T>(fn: string, esquema: z.ZodType<T>, data: unknown): Resultado<T> {
  const leido = esquema.safeParse(data)
  return leido.success ? ok(leido.data) : inesperado(fn, 'respuesta')
}

// Las lecturas por referencia o id: sin fila, `ok(null)`.
async function filaOpcional<F extends FuncionDeCorreo>(
  cliente: ClienteDeCorreos,
  fn: F,
  args: Funciones[F]['Args'],
): Promise<Resultado<FilaDeCorreo | null>> {
  const cruda = await llamar(cliente, fn, args)
  if (!cruda.ok) return cruda
  return cruda.data === null ? ok(null) : leer(fn, esquemaDeFila, cruda.data)
}

// `registrar` y las `marcar*`: la RPC devuelve la fila. Sin ella, una marca dice `no_encontrado` y un registro es un error de respuesta.
async function filaDeLaRpc<F extends FuncionDeCorreo>(
  cliente: ClienteDeCorreos,
  fn: F,
  args: Funciones[F]['Args'],
  siNoHay: 'no_encontrado' | 'inesperado',
): Promise<Resultado<FilaDeCorreo>> {
  const cruda = await llamar(cliente, fn, args)
  if (!cruda.ok) return cruda
  if (cruda.data !== null) return leer(fn, esquemaDeFila, cruda.data)
  return siNoHay === 'no_encontrado'
    ? fallo('no_encontrado', NO_ENCONTRADO)
    : inesperado(fn, 'respuesta')
}

async function listaDeLaRpc<F extends FuncionDeCorreo>(
  cliente: ClienteDeCorreos,
  fn: F,
  args: Funciones[F]['Args'],
): Promise<Resultado<FilaDeCorreo[]>> {
  const cruda = await llamar(cliente, fn, args)
  return cruda.ok ? leer(fn, esquemaDeFilas, cruda.data) : cruda
}

type ArgumentosDeRegistrar = Funciones['registrar_correo']['Args']

// Un opcional nulo se omite, nunca se manda (P27: los opcionales llevan `default null`).
function argumentosDeRegistrar(
  n: NuevaFila,
  datos: ArgumentosDeRegistrar['p_datos'],
): ArgumentosDeRegistrar {
  return {
    p_para: n.para,
    p_plantilla: n.plantilla,
    p_datos: datos,
    p_estado: n.estado,
    p_intentos: n.intentos,
    ...(n.adjuntoIcs === null ? {} : { p_adjunto_ics: n.adjuntoIcs }),
    ...(n.resendId === null ? {} : { p_resend_id: n.resendId }),
    ...(n.programadoPara === null ? {} : { p_programado_para: n.programadoPara }),
    ...(n.ultimoError === null ? {} : { p_ultimo_error: n.ultimoError }),
    ...(n.enviadoEn === null ? {} : { p_enviado_en: n.enviadoEn }),
    ...(n.referencia === null ? {} : { p_referencia: n.referencia }),
    ...(n.reunionId === null ? {} : { p_reunion_id: n.reunionId }),
    ...(n.solicitudId === null ? {} : { p_solicitud_id: n.solicitudId }),
  }
}

// Sin tercer argumento `resend_id` queda como estaba; con `null` se limpia; con un id se pisa (`p_cambiar_resend_id`, P27).
function extraDeReprogramar(resendId: string | null | undefined) {
  if (resendId === undefined) return {}
  return resendId === null
    ? { p_cambiar_resend_id: true }
    : { p_resend_id: resendId, p_cambiar_resend_id: true }
}

// Un id que no es guid no llega a la base (daría `22P02`, `inesperado`): se trata como el que no existe.
const sinFila = <T>(valor: T) => Promise.resolve(ok(valor))
const noEncontrado = () => Promise.resolve(fallo('no_encontrado', NO_ENCONTRADO))

export function registroDeSupabase(cliente: ClienteDeCorreos): RegistroDeCorreos {
  const marca = <F extends FuncionDeCorreo>(
    fn: F,
    id: string,
    args: Funciones[F]['Args'],
  ): Promise<Resultado<FilaDeCorreo>> =>
    esGuid(id) ? filaDeLaRpc(cliente, fn, args, 'no_encontrado') : noEncontrado()

  return {
    porReferencia: (referencia) =>
      filaOpcional(cliente, 'correo_por_referencia', { p_referencia: referencia }),
    porId: (id) =>
      esGuid(id) ? filaOpcional(cliente, 'correo_por_id', { p_id: id }) : sinFila(null),
    async registrar(nueva) {
      const datos = datosComoJson(nueva.datos)
      if (!datos.ok) {
        registrarMotivo('registrar_correo', 'datos')
        return datos
      }
      return filaDeLaRpc(
        cliente,
        'registrar_correo',
        argumentosDeRegistrar(nueva, datos.data),
        'inesperado',
      )
    },
    marcarEnviado: (id, d) =>
      marca('marcar_correo_enviado', id, {
        p_id: id,
        p_intentos: d.intentos,
        p_enviado_en: d.enviadoEn,
        ...(d.resendId === null ? {} : { p_resend_id: d.resendId }),
      }),
    marcarFallido: (id, d) =>
      marca('marcar_correo_fallido', id, {
        p_id: id,
        p_intentos: d.intentos,
        p_ultimo_error: d.ultimoError,
      }),
    marcarCancelado: (id) => marca('marcar_correo_cancelado', id, { p_id: id }),
    marcarReprogramado: (id, programadoPara, resendId) =>
      marca('marcar_correo_reprogramado', id, {
        p_id: id,
        p_programado_para: programadoPara,
        ...extraDeReprogramar(resendId),
      }),
    programadosDe: (quien: Quien, tope) => {
      const [clave, id] =
        'reunionId' in quien
          ? (['p_reunion_id', quien.reunionId] as const)
          : (['p_solicitud_id', quien.solicitudId] as const)
      return esGuid(id)
        ? listaDeLaRpc(cliente, 'correos_programados_de', { [clave]: id, p_tope: tope })
        : sinFila<FilaDeCorreo[]>([])
    },
    vencidos: (ahora, tope) =>
      listaDeLaRpc(cliente, 'correos_vencidos', { p_ahora: ahora, p_tope: tope }),
  }
}
