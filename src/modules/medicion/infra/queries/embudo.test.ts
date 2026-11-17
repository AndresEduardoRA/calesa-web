import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

// Una cadena que registra cada llamada y se resuelve con `respuesta` al esperarla.
const { llamadas, respuesta, from } = vi.hoisted(() => {
  const llamadas: [string, unknown[]][] = []
  const respuesta: { valor: unknown } = { valor: { data: [], error: null } }
  const cadena = {}
  for (const metodo of ['select', 'eq', 'gte', 'lt', 'order', 'limit']) {
    Object.assign(cadena, {
      [metodo]: (...args: unknown[]) => {
        llamadas.push([metodo, args])
        return cadena
      },
    })
  }
  Object.assign(cadena, {
    then: (resolver: (v: unknown) => unknown) => Promise.resolve(respuesta.valor).then(resolver),
  })
  const from = vi.fn((tabla: string) => {
    llamadas.push(['from', [tabla]])
    return cadena
  })
  return { llamadas, respuesta, from }
})
vi.mock('@/shared/lib/supabase/server', () => ({ createClient: () => Promise.resolve({ from }) }))

import { leerEmbudoDelMes } from './embudo'

const PERFIL = '11111111-1111-4111-8111-111111111111'
const llamada = (metodo: string) => llamadas.find(([m]) => m === metodo)?.[1]

describe('leerEmbudoDelMes (C9)', () => {
  beforeEach(() => {
    llamadas.length = 0
    from.mockClear()
    respuesta.valor = { data: [], error: null }
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('equipo: lee metricas_diarias del mes, con tope de 31 y sin perfil_id', async () => {
    respuesta.valor = {
      data: [
        {
          solicitudes: 2,
          reuniones_reservadas: 1,
          reuniones_realizadas: 1,
          ganadas: 0,
          clics_whatsapp: 5,
          calculadoras: 3,
        },
      ],
      error: null,
    }
    const r = await leerEmbudoDelMes({ alcance: 'todos', mes: '2026-12' })
    expect(from).toHaveBeenCalledWith('metricas_diarias')
    expect(llamada('gte')).toEqual(['dia', '2026-12-01'])
    expect(llamada('lt')).toEqual(['dia', '2027-01-01'])
    expect(llamada('limit')).toEqual([31])
    expect(llamadas.some(([m]) => m === 'eq')).toBe(false)
    const columnas = String(llamada('select')?.[0])
    expect(columnas).not.toContain('*')
    expect(r).toEqual({
      ok: true,
      data: {
        fuente: 'equipo',
        mes: '2026-12',
        embudo: {
          solicitudes: 2,
          reunionesReservadas: 1,
          reunionesRealizadas: 1,
          ganadas: 0,
          clicsWhatsapp: 5,
          calculadoras: 3,
        },
      },
    })
  })

  it('propio: lee metricas_persona filtrando por perfil_id', async () => {
    respuesta.valor = {
      data: [
        { solicitudes_asignadas: 4, reuniones_reservadas: 2, reuniones_realizadas: 1, ganadas: 1 },
      ],
      error: null,
    }
    const r = await leerEmbudoDelMes({ alcance: 'propio', perfilId: PERFIL, mes: '2026-11' })
    expect(from).toHaveBeenCalledWith('metricas_persona')
    expect(llamada('eq')).toEqual(['perfil_id', PERFIL])
    expect(llamada('limit')).toEqual([31])
    expect(String(llamada('select')?.[0])).not.toContain('*')
    expect(r).toEqual({
      ok: true,
      data: {
        fuente: 'propio',
        mes: '2026-11',
        embudo: { solicitudes: 4, reunionesReservadas: 2, reunionesRealizadas: 1, ganadas: 1 },
      },
    })
  })
})

describe('leerEmbudoDelMes sin consulta o con error (C9)', () => {
  beforeEach(() => {
    llamadas.length = 0
    from.mockClear()
    respuesta.valor = { data: [], error: null }
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('sin permiso (alcance null) no consulta y da ok(null)', async () => {
    expect(await leerEmbudoDelMes({ alcance: null, mes: '2026-11' })).toEqual({
      ok: true,
      data: null,
    })
    expect(from).not.toHaveBeenCalled()
  })

  it('un error de la base devuelve fallo y registra el código, sin filas', async () => {
    respuesta.valor = { data: null, error: { code: '42501', message: 'permission denied' } }
    const r = await leerEmbudoDelMes({ alcance: 'todos', mes: '2026-11' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.codigo).toBe('sin_permiso')
    }
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('42501'))
  })

  it('un mes inválido no consulta', async () => {
    const r = await leerEmbudoDelMes({ alcance: 'todos', mes: '2026-13' })
    expect(r).toMatchObject({ ok: false, error: { codigo: 'validacion' } })
    expect(from).not.toHaveBeenCalled()
  })

  it('propio sin perfilId (o con uno que no es guid) no consulta', async () => {
    expect(await leerEmbudoDelMes({ alcance: 'propio', mes: '2026-11' })).toMatchObject({
      ok: false,
      error: { codigo: 'validacion' },
    })
    expect(
      await leerEmbudoDelMes({ alcance: 'propio', perfilId: 'no-es-guid', mes: '2026-11' }),
    ).toMatchObject({ ok: false, error: { codigo: 'validacion' } })
    expect(from).not.toHaveBeenCalled()
  })

  it('sin mes usa el mes del ahora inyectado, en La Paz', async () => {
    const r = await leerEmbudoDelMes({
      alcance: 'todos',
      ahora: new Date('2026-12-01T03:59:00Z'),
    })
    expect(llamada('gte')).toEqual(['dia', '2026-11-01'])
    expect(r).toMatchObject({ ok: true, data: { mes: '2026-11' } })
  })
})
