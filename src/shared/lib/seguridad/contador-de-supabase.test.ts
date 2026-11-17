// @vitest-environment node
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'

// La tabla de casos importa `LIMITES` como valor, y `limites.ts` carga `server-only`.
vi.mock('server-only', () => ({}))

import { MENSAJE_INESPERADO } from '../errores'
import type { ClienteSupabase } from '../supabase/server'
import {
  CASOS_DE_CONTAR_ENVIO,
  esperadoDelCaso,
  recorrerCaso,
  relojFijo,
} from './casos-de-contar-envio.soporte'
import { clienteEnMemoria, clienteQueResponde } from './cliente-de-contar-envio.soporte'
import { contadorDeSupabase, type ClienteDeContarEnvio } from './contador-de-supabase'

const INESPERADO = { ok: false, error: { codigo: 'inesperado', mensaje: MENSAJE_INESPERADO } }
const pedido = { clave: 'k', maximo: 2, ventanaSegundos: 3600 }

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ClienteDeContarEnvio (C1)', () => {
  it('el cliente de Supabase del proyecto entra sin cast', () => {
    expectTypeOf<ClienteSupabase>().toExtend<ClienteDeContarEnvio>()
  })
})

describe('contadorDeSupabase corre la tabla de casos de ContarEnvio (C9)', () => {
  it.each(CASOS_DE_CONTAR_ENVIO)('$nombre', async (caso) => {
    const { reloj, avanzar } = relojFijo()
    const contar = contadorDeSupabase(clienteEnMemoria(reloj))
    expect(await recorrerCaso(caso, contar, avanzar)).toEqual(esperadoDelCaso(caso))
    expect(console.error).not.toHaveBeenCalled()
  })
})

describe('la llamada a la RPC (C3)', () => {
  it('llama una vez a contar_envio con los argumentos generados', async () => {
    const cliente = clienteQueResponde({ data: true, error: null })
    expect(await contadorDeSupabase(cliente)(pedido)).toEqual({ ok: true, data: true })
    expect(cliente.rpc).toHaveBeenCalledTimes(1)
    expect(cliente.rpc).toHaveBeenCalledWith('contar_envio', {
      p_clave: 'k',
      p_maximo: 2,
      p_ventana_segundos: 3600,
    })
  })

  it('un false de la RPC es un envío que no pasa, no un error', async () => {
    const cliente = clienteQueResponde({ data: false, error: null })
    expect(await contadorDeSupabase(cliente)(pedido)).toEqual({ ok: true, data: false })
    expect(console.error).not.toHaveBeenCalled()
  })
})

describe('el pedido se valida antes de llamar (C2)', () => {
  it.each([
    { nombre: 'clave vacía', cambio: { clave: '' } },
    { nombre: 'clave de 201', cambio: { clave: 'x'.repeat(201) } },
    { nombre: 'máximo 0', cambio: { maximo: 0 } },
    { nombre: 'máximo 1,5', cambio: { maximo: 1.5 } },
    { nombre: 'máximo 2³¹', cambio: { maximo: 2 ** 31 } },
    { nombre: 'ventana 0', cambio: { ventanaSegundos: 0 } },
    { nombre: 'ventana 86 401', cambio: { ventanaSegundos: 86_401 } },
    { nombre: 'ventana 1,5', cambio: { ventanaSegundos: 1.5 } },
  ])('$nombre: inesperado y la RPC no se llama', async ({ cambio }) => {
    const cliente = clienteQueResponde({ data: true, error: null })
    expect(await contadorDeSupabase(cliente)({ ...pedido, ...cambio })).toEqual(INESPERADO)
    expect(cliente.rpc).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalledExactlyOnceWith('limites: contar_envio pedido')
  })

  it.each([
    { nombre: 'clave de 200', cambio: { clave: 'x'.repeat(200) } },
    { nombre: 'máximo 1', cambio: { maximo: 1 } },
    { nombre: 'máximo 2³¹ − 1', cambio: { maximo: 2 ** 31 - 1 } },
    { nombre: 'ventana 1', cambio: { ventanaSegundos: 1 } },
    { nombre: 'ventana 86 400', cambio: { ventanaSegundos: 86_400 } },
  ])('$nombre: es válido y llama a la RPC', async ({ cambio }) => {
    const cliente = clienteQueResponde({ data: true, error: null })
    expect(await contadorDeSupabase(cliente)({ ...pedido, ...cambio })).toEqual({
      ok: true,
      data: true,
    })
    expect(cliente.rpc).toHaveBeenCalledTimes(1)
  })
})

describe('la respuesta se valida con z.boolean() (C4)', () => {
  it.each([
    { nombre: 'null', data: null },
    { nombre: 'undefined', data: undefined },
    { nombre: "'true'", data: 'true' },
    { nombre: "'false'", data: 'false' },
    { nombre: '1', data: 1 },
    { nombre: '0', data: 0 },
    { nombre: '{}', data: {} },
    { nombre: '[true]', data: [true] },
  ])('data $nombre: inesperado', async ({ data }) => {
    const cliente = clienteQueResponde({ data, error: null })
    expect(await contadorDeSupabase(cliente)(pedido)).toEqual(INESPERADO)
    expect(console.error).toHaveBeenCalledExactlyOnceWith('limites: contar_envio respuesta')
  })
})
