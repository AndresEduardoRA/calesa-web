// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// `limitar` lee el entorno del servidor, que carga `server-only`.
vi.mock('server-only', () => ({}))

import type { EntornoDelServidor } from '../../config/servidor'
import { MENSAJE_INESPERADO, MENSAJE_SIN_RESPUESTA } from '../errores'
import { clienteQueResponde, type ErrorDeRpc } from './cliente-de-contar-envio.soporte'
import { contadorDeSupabase } from './contador-de-supabase'
import { claveDeLimite, limitar } from './limites'
import { TEXTO_LIMITE } from './textos'

// Una clave con la forma real (`accion:<sha256>`), para que «no contiene la clave» no dependa de una letra suelta.
const HEX = 'c0ffee'.repeat(10) + 'beef'
const CLAVE = `formulario:${HEX}`
const pedido = { clave: CLAVE, maximo: 5, ventanaSegundos: 3600 }
const TEXTO_DE_LA_RPC = 'La clave del límite de envíos no es válida.'
const fallo = (mensaje: string) => ({ ok: false, error: { codigo: 'inesperado', mensaje } })
const conError = (error: ErrorDeRpc) => clienteQueResponde({ data: null, error })

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

// Lo que se registró, todo junto: ni la clave, ni el texto de la RPC, ni el `hint`, ni lo lanzado.
function registrado(): string {
  return JSON.stringify(vi.mocked(console.error).mock.calls)
}

function expectRegistroLimpio() {
  const texto = registrado()
  for (const prohibido of [HEX, 'límite de envíos', 'p_clave', 'se cayó el socket']) {
    expect(texto).not.toContain(prohibido)
  }
}

// La tabla de C5: el error que llega, el motivo que se registra y el texto que recibe el visitante.
const fila = (nombre: string, error: ErrorDeRpc, motivo: string, mensaje = MENSAJE_INESPERADO) => ({
  nombre,
  error,
  motivo,
  mensaje,
})

const ERRORES_DE_LA_RPC = [
  fila(
    '22023 de contar_envio',
    { code: '22023', message: TEXTO_DE_LA_RPC, hint: 'p_clave' },
    '22023',
  ),
  fila(
    '42501 (no es service_role)',
    { code: '42501', message: 'permission denied for function contar_envio' },
    '42501',
  ),
  fila('42501 sin texto', { code: '42501', message: '' }, '42501'),
  fila('P0001', { code: 'P0001', message: TEXTO_DE_LA_RPC }, 'P0001'),
  fila('PT409', { code: 'PT409', message: TEXTO_DE_LA_RPC }, 'PT409'),
  fila('23505', { code: '23505', message: TEXTO_DE_LA_RPC }, '23505'),
  fila('PGRST116', { code: 'PGRST116', message: TEXTO_DE_LA_RPC }, 'PGRST116'),
  fila(
    'PGRST202 (código desconocido)',
    { code: 'PGRST202', message: 'Could not find the function' },
    'PGRST202',
  ),
  fila('22003 (código desconocido)', { code: '22003', message: TEXTO_DE_LA_RPC }, '22003'),
  fila(
    "sin red, code ''",
    { code: '', message: 'TypeError: fetch failed' },
    'sin-codigo',
    MENSAJE_SIN_RESPUESTA,
  ),
  fila(
    'sin red, code null',
    { code: null, message: 'TypeError: fetch failed' },
    'sin-codigo',
    MENSAJE_SIN_RESPUESTA,
  ),
  fila(
    'sin red, sin code',
    { message: 'TypeError: fetch failed' },
    'sin-codigo',
    MENSAJE_SIN_RESPUESTA,
  ),
  fila('sin código y el texto de la RPC', { message: TEXTO_DE_LA_RPC }, 'sin-codigo'),
]

describe('un error de la RPC nunca muestra su texto (C5, C7)', () => {
  it.each(ERRORES_DE_LA_RPC)('$nombre', async ({ error, motivo, mensaje }) => {
    expect(await contadorDeSupabase(conError(error))(pedido)).toEqual(fallo(mensaje))
    expect(console.error).toHaveBeenCalledExactlyOnceWith(`limites: contar_envio ${motivo}`)
    expectRegistroLimpio()
  })
})

describe('nunca lanza (C6, C7)', () => {
  it('rpc que lanza al llamarla: inesperado', async () => {
    const cliente = clienteQueResponde(() => {
      throw new Error('se cayó el socket')
    })
    expect(await contadorDeSupabase(cliente)(pedido)).toEqual(fallo(MENSAJE_INESPERADO))
    expect(console.error).toHaveBeenCalledExactlyOnceWith('limites: contar_envio excepcion')
    expectRegistroLimpio()
  })

  it('rpc que rechaza: inesperado, sin rechazar', async () => {
    const cliente = clienteQueResponde(() => Promise.reject(new Error('se cayó el socket')))
    await expect(contadorDeSupabase(cliente)(pedido)).resolves.toEqual(fallo(MENSAJE_INESPERADO))
    expect(console.error).toHaveBeenCalledExactlyOnceWith('limites: contar_envio excepcion')
    expectRegistroLimpio()
  })
})

describe('limitar con contadorDeSupabase (C8)', () => {
  const SAL = 'sal-de-prueba-para-las-ip-0123456789abcdef'
  const IP = '203.0.113.7'
  const conSal = {
    entorno: {
      SUPABASE_SECRET_KEY: 's',
      EMAIL_PROVEEDOR: 'ninguno',
      IP_SAL_SECRETO: SAL,
    } as EntornoDelServidor,
  }
  const hexDeLaClave = claveDeLimite('formulario', IP, SAL).split(':')[1] ?? ''

  it('un 22023 con el texto de la RPC llega como inesperado, sin ese texto', async () => {
    const cliente = conError({ code: '22023', message: TEXTO_DE_LA_RPC, hint: 'p_clave' })
    const resultado = await limitar('formulario', IP, contadorDeSupabase(cliente), conSal)
    expect(resultado).toEqual(fallo(MENSAJE_INESPERADO))
    expect(JSON.stringify(resultado)).not.toContain('límite de envíos')
    expect(hexDeLaClave).toMatch(/^[0-9a-f]{64}$/)
    expect(registrado()).not.toContain(hexDeLaClave)
  })

  it('un false de la RPC frena con TEXTO_LIMITE', async () => {
    const cliente = clienteQueResponde({ data: false, error: null })
    expect(await limitar('formulario', IP, contadorDeSupabase(cliente), conSal)).toEqual({
      ok: false,
      error: { codigo: 'regla', mensaje: TEXTO_LIMITE },
    })
  })

  it('un true de la RPC deja pasar', async () => {
    const cliente = clienteQueResponde({ data: true, error: null })
    expect(await limitar('formulario', IP, contadorDeSupabase(cliente), conSal)).toEqual({
      ok: true,
      data: null,
    })
  })

  it('sin red hacia la base: MENSAJE_SIN_RESPUESTA', async () => {
    const cliente = conError({ message: 'TypeError: fetch failed' })
    expect(await limitar('formulario', IP, contadorDeSupabase(cliente), conSal)).toEqual(
      fallo(MENSAJE_SIN_RESPUESTA),
    )
  })
})
