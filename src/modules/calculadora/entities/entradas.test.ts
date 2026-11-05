import { describe, expect, it } from 'vitest'
import { ENTRADAS_E1, ENTRADAS_E2 } from './ejemplos.fixture'
import { esquemaEntradasCalculadora } from './entradas'

const CONSULTAS_MENOS = 'Las consultas no pueden ser menos que los autos vendidos.'

// [campo, mensaje] de cada problema, en orden.
const problemas = (entrada: unknown) =>
  esquemaEntradasCalculadora
    .safeParse(entrada)
    .error?.issues.map((i) => [i.path.join('.'), i.message]) ?? []

describe('esquemaEntradasCalculadora', () => {
  it('acepta las entradas de los ejemplos 1 y 2', () => {
    expect(problemas(ENTRADAS_E1)).toEqual([])
    expect(problemas(ENTRADAS_E2)).toEqual([])
  })

  it.each([
    ['autos', 401, 'Escribe un número entero entre 1 y 400.'],
    ['margen', 30001, 'Escribe un monto entre US$ 100 y US$ 30.000, sin centavos.'],
    ['consultas', 9, 'Escribe un número entero entre 10 y 5.000.'],
    ['administracion', 81, 'Escribe un número entero entre 1 y 80.'],
    ['respuesta', 'semana', 'Elige cuánto tardas en contestar.'],
  ])('con %s = %s da su mensaje en su campo', (campo, valor, mensaje) => {
    expect(problemas({ ...ENTRADAS_E1, [campo]: valor })).toEqual([[campo, mensaje]])
  })

  it('pide que las consultas no sean menos que los autos', () => {
    expect(problemas({ ...ENTRADAS_E1, autos: 25, consultas: 24 })).toEqual([
      ['consultas', CONSULTAS_MENOS],
    ])
    expect(problemas({ ...ENTRADAS_E1, autos: 25, consultas: 25 })).toEqual([])
  })

  it('corre la regla cruzada aunque otro campo haya fallado', () => {
    expect(problemas({ ...ENTRADAS_E1, autos: 25, consultas: 24, margen: 50 })).toEqual([
      ['margen', 'Escribe un monto entre US$ 100 y US$ 30.000, sin centavos.'],
      ['consultas', CONSULTAS_MENOS],
    ])
  })

  it('corre la regla cruzada aunque otro campo no sea un número', () => {
    expect(problemas({ ...ENTRADAS_E1, autos: 25, consultas: 24, margen: 'mucho' })).toEqual([
      ['margen', 'Escribe un monto entre US$ 100 y US$ 30.000, sin centavos.'],
      ['consultas', CONSULTAS_MENOS],
    ])
  })

  it('no corre la regla cruzada si las consultas fallaron su rango', () => {
    expect(problemas({ ...ENTRADAS_E1, autos: 25, consultas: 5 })).toEqual([
      ['consultas', 'Escribe un número entero entre 10 y 5.000.'],
    ])
  })

  it('no corre la regla cruzada si los autos fallaron su rango', () => {
    expect(problemas({ ...ENTRADAS_E1, autos: 401, consultas: 300 })).toEqual([
      ['autos', 'Escribe un número entero entre 1 y 400.'],
    ])
  })

  it.each([null, undefined, 'x', [[]], 25])(
    'con %j, que no es un objeto, da un solo problema sin lanzar',
    (entrada) => {
      const resultado = esquemaEntradasCalculadora.safeParse(entrada)
      expect(resultado.success).toBe(false)
      expect(resultado.error?.issues).toHaveLength(1)
      expect(resultado.error?.issues[0]?.path).toEqual([])
    },
  )
})
