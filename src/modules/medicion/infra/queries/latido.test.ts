import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { llamadas, respuesta, from } = vi.hoisted(() => {
  const llamadas: [string, unknown[]][] = []
  const respuesta: { valor: unknown } = { valor: { data: null, error: null } }
  const cadena = {}
  for (const metodo of ['select', 'eq']) {
    Object.assign(cadena, {
      [metodo]: (...args: unknown[]) => {
        llamadas.push([metodo, args])
        return cadena
      },
    })
  }
  Object.assign(cadena, {
    maybeSingle: () => {
      llamadas.push(['maybeSingle', []])
      return Promise.resolve(respuesta.valor)
    },
  })
  const from = vi.fn((tabla: string) => {
    llamadas.push(['from', [tabla]])
    return cadena
  })
  return { llamadas, respuesta, from }
})
vi.mock('@/shared/lib/supabase/server', () => ({ createClient: () => Promise.resolve({ from }) }))

import { leerLatidoDiario } from './latido'

const AHORA = new Date('2026-11-20T12:00:00.000Z')

describe('leerLatidoDiario (C12)', () => {
  beforeEach(() => {
    llamadas.length = 0
    from.mockClear()
    respuesta.valor = { data: null, error: null }
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('lee la fila diario por su clave, con columnas nombradas y maybeSingle', async () => {
    respuesta.valor = {
      data: {
        ultimo_ok: '2026-11-18T00:00:00.000Z',
        ultimo_error: null,
        fallos_seguidos: 0,
        creado_en: '2026-10-01T00:00:00.000Z',
      },
      error: null,
    }
    const r = await leerLatidoDiario(AHORA)
    expect(from).toHaveBeenCalledWith('latidos')
    expect(llamadas.find(([m]) => m === 'eq')?.[1]).toEqual(['tarea', 'diario'])
    expect(llamadas.some(([m]) => m === 'maybeSingle')).toBe(true)
    expect(String(llamadas.find(([m]) => m === 'select')?.[1][0])).not.toContain('*')
    expect(r).toEqual({
      ok: true,
      data: {
        detenida: true,
        desde: '2026-11-18T00:00:00.000Z',
        ultimoError: null,
        fallosSeguidos: 0,
      },
    })
  })

  it('sin fila (o sin permiso: la RLS da 0 filas) no hay banner', async () => {
    expect(await leerLatidoDiario(AHORA)).toEqual({
      ok: true,
      data: { detenida: false, desde: null, ultimoError: null, fallosSeguidos: 0 },
    })
  })

  it('un error de la base devuelve fallo', async () => {
    respuesta.valor = { data: null, error: { code: 'PGRST301', message: 'x' } }
    const r = await leerLatidoDiario(AHORA)
    expect(r.ok).toBe(false)
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('PGRST301'))
  })
})
