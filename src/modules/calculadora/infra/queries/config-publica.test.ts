import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const { cacheTag, cacheLife, rpc } = vi.hoisted(() => ({
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
  rpc: vi.fn(),
}))
vi.mock('next/cache', () => ({ cacheTag, cacheLife }))
vi.mock('../cliente-publico', () => ({ crearClientePublico: () => ({ rpc }) }))

import { CONFIG_INICIAL } from '../../entities/ejemplos.fixture'
import { leerConfigCalculadora } from './config-publica'

describe('leerConfigCalculadora (C5)', () => {
  beforeEach(() => {
    cacheTag.mockClear()
    cacheLife.mockClear()
    rpc.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('ok: llama la RPC, etiqueta calculadora, una hora y el dato', async () => {
    rpc.mockResolvedValue({ data: [CONFIG_INICIAL], error: null })
    const r = await leerConfigCalculadora()
    expect(rpc).toHaveBeenCalledWith('config_calculadora')
    expect(cacheTag).toHaveBeenCalledWith('calculadora')
    expect(cacheLife).toHaveBeenCalledTimes(1)
    expect(cacheLife).toHaveBeenCalledWith('hours')
    expect(r).toEqual({ ok: true, data: CONFIG_INICIAL })
    expect(console.error).not.toHaveBeenCalled()
  })

  it('error de la RPC: fallo, minutos y un registro con el código y sin datos', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied' } })
    const r = await leerConfigCalculadora()
    expect(r.ok).toBe(false)
    expect(cacheTag).toHaveBeenCalledWith('calculadora')
    expect(cacheLife).toHaveBeenCalledTimes(1)
    expect(cacheLife).toHaveBeenCalledWith('minutes')
    expect(console.error).toHaveBeenCalledTimes(1)
    expect(console.error).toHaveBeenCalledWith('config_calculadora: 42501 permission denied')
  })

  it('respuesta que no cumple el esquema: fallo, minutos y su registro', async () => {
    rpc.mockResolvedValue({ data: [{ ...CONFIG_INICIAL, precio: 200 }], error: null })
    const r = await leerConfigCalculadora()
    expect(r.ok).toBe(false)
    expect(cacheLife).toHaveBeenCalledTimes(1)
    expect(cacheLife).toHaveBeenCalledWith('minutes')
    expect(console.error).toHaveBeenCalledWith(
      'config_calculadora: la respuesta no cumple el esquema',
    )
  })
})
