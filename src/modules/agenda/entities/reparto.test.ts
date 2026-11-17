import { describe, expect, it } from 'vitest'
import { repartoParejo } from './reparto'

const dias = (n: number) => new Date(Date.UTC(2026, 10, 5) - n * 86_400_000).toISOString()
const cand = (
  id: string,
  conteo: number,
  ultimaEn: string | null = null,
  creadoEn = '2026-01-01T00:00:00Z',
) => ({
  id,
  conteo,
  ultimaEn,
  creadoEn,
})

describe('repartoParejo · ejemplos de §5.6', () => {
  it('V1 con 2 reuniones y V2 con 1 → V2', () => {
    expect(repartoParejo([cand('V1', 2), cand('V2', 1)])).toBe('V2')
  })

  it('V1 y V2 con 1; V1 recibió la última hace 2 días y V2 hace 5 → V2', () => {
    expect(repartoParejo([cand('V1', 1, dias(2)), cand('V2', 1, dias(5))])).toBe('V2')
  })

  it('WhatsApp: V1 con 7 clics y V2 con 3 → V2', () => {
    expect(repartoParejo([cand('V1', 7), cand('V2', 3)])).toBe('V2')
  })
})

describe('repartoParejo · desempates', () => {
  it('quien nunca tuvo (null) gana a quien tuvo hace 5 días', () => {
    expect(repartoParejo([cand('V1', 1, dias(5)), cand('V2', 1, null)])).toBe('V2')
    expect(repartoParejo([cand('V1', 1, null), cand('V2', 1, dias(5))])).toBe('V1')
  })

  it('con todo igual gana el creadoEn más antiguo', () => {
    const viejo = cand('V1', 1, null, '2025-01-01T00:00:00Z')
    const nuevo = cand('V2', 1, null, '2026-01-01T00:00:00Z')
    expect(repartoParejo([nuevo, viejo])).toBe('V1')
    expect(repartoParejo([viejo, nuevo])).toBe('V1')
  })

  it('el conteo manda sobre la antigüedad y sobre el creadoEn', () => {
    const viejo = cand('V1', 3, dias(30), '2020-01-01T00:00:00Z')
    expect(repartoParejo([viejo, cand('V2', 2, dias(1))])).toBe('V2')
  })

  it('con todo igual gana el id menor, sin importar el orden', () => {
    expect(repartoParejo([cand('B', 1), cand('A', 1)])).toBe('A')
    expect(repartoParejo([cand('A', 1), cand('B', 1)])).toBe('A')
  })

  it('compara instantes, no textos: un desfase de zona no engaña', () => {
    // 10:00-04:00 es 14:00Z, más tarde que 12:00Z aunque «10» < «12» como texto.
    const tarde = cand('V1', 1, '2026-11-03T10:00:00-04:00')
    const temprano = cand('V2', 1, '2026-11-03T12:00:00Z')
    expect(repartoParejo([tarde, temprano])).toBe('V2')
  })

  it('la lista vacía da null', () => {
    expect(repartoParejo([])).toBeNull()
  })
})
