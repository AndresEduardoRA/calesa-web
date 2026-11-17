import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const { cacheTag, cacheLife, rpc } = vi.hoisted(() => ({
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
  rpc: vi.fn(),
}))
vi.mock('next/cache', () => ({ cacheTag, cacheLife }))
vi.mock('@/shared/config/entorno', () => ({
  entornoPublico: () => ({ NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321' }),
}))
vi.mock('../cliente-publico', () => ({ crearClientePublico: () => ({ rpc }) }))

import { leerEquipoVisible } from './equipo-visible'

const fila = {
  id: '11111111-1111-4111-8111-111111111111',
  nombre: 'Andrés Rosas',
  cargo: 'Fundador',
  frase: null,
  foto_ruta: 'abc.webp',
  orden: 1,
}

describe('leerEquipoVisible (C9)', () => {
  beforeEach(() => {
    cacheTag.mockClear()
    cacheLife.mockClear()
    rpc.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('ok: etiqueta equipo, una hora, y las fotos con la base de entornoPublico', async () => {
    rpc.mockResolvedValue({ data: [fila], error: null })
    const r = await leerEquipoVisible()
    expect(rpc).toHaveBeenCalledWith('equipo_visible')
    expect(cacheTag).toHaveBeenCalledWith('equipo')
    expect(cacheLife).toHaveBeenCalledTimes(1)
    expect(cacheLife).toHaveBeenCalledWith('hours')
    expect(r).toEqual({
      ok: true,
      data: [
        {
          id: fila.id,
          nombre: 'Andrés Rosas',
          cargo: 'Fundador',
          frase: null,
          fotoUrl: 'http://127.0.0.1:54321/storage/v1/object/public/equipo/abc.webp',
        },
      ],
    })
    expect(console.error).not.toHaveBeenCalled()
  })

  it('error de la RPC: fallo, minutos y registro sin filas', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied' } })
    const r = await leerEquipoVisible()
    expect(r.ok).toBe(false)
    expect(cacheTag).toHaveBeenCalledWith('equipo')
    expect(cacheLife).toHaveBeenCalledTimes(1)
    expect(cacheLife).toHaveBeenCalledWith('minutes')
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('42501'))
  })

  it('datos que no cumplen el esquema: fallo y minutos', async () => {
    rpc.mockResolvedValue({ data: [{ ...fila, nombre: 'A' }], error: null })
    const r = await leerEquipoVisible()
    expect(r.ok).toBe(false)
    expect(cacheLife).toHaveBeenCalledWith('minutes')
    expect(cacheLife).not.toHaveBeenCalledWith('hours')
    expect(console.error).toHaveBeenCalled()
  })
})
