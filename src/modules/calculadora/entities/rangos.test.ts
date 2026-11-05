import { describe, expect, it } from 'vitest'
import { campoEntero, campoMonto, cuandoPasaron } from './rangos'

const mensajesDe = (resultado: { success: boolean; error?: { issues: { message: string }[] } }) =>
  resultado.error?.issues.map((i) => i.message) ?? []

describe('campoEntero', () => {
  const autos = campoEntero(1, 400)
  const mensaje = 'Escribe un número entero entre 1 y 400.'

  it.each([1, 400])('acepta %s, un extremo del rango', (valor) => {
    expect(autos.safeParse(valor)).toEqual({ success: true, data: valor })
  })

  it.each([0, 401, 2.5, Number.NaN, '25', undefined, null])(
    'con %s da un solo mensaje, siempre el mismo',
    (valor) => {
      expect(mensajesDe(autos.safeParse(valor))).toEqual([mensaje])
    },
  )

  it('escribe los extremos con punto de miles', () => {
    expect(mensajesDe(campoEntero(10, 5000).safeParse(9))).toEqual([
      'Escribe un número entero entre 10 y 5.000.',
    ])
  })
})

describe('campoMonto', () => {
  const margen = campoMonto(100, 30000)

  it('acepta los extremos', () => {
    expect(margen.safeParse(100).success).toBe(true)
    expect(margen.safeParse(30000).success).toBe(true)
  })

  it.each([99, 30001, 150.5, 'x'])('con %s da el mensaje en dólares, sin centavos', (valor) => {
    expect(mensajesDe(margen.safeParse(valor))).toEqual([
      'Escribe un monto entre US$ 100 y US$ 30.000, sin centavos.',
    ])
  })
})

describe('cuandoPasaron', () => {
  const cuando = cuandoPasaron('autos', 'consultas')
  const con = (...rutas: string[]) => ({
    value: {},
    issues: rutas.map((ruta) => ({
      code: 'custom' as const,
      input: 0,
      message: 'x',
      path: [ruta],
    })),
  })

  it('deja correr la regla si esos campos no tienen problemas, aunque otro sí', () => {
    expect(cuando(con())).toBe(true)
    expect(cuando(con('margen'))).toBe(true)
  })

  it('la frena si uno de esos campos ya falló', () => {
    expect(cuando(con('autos'))).toBe(false)
    expect(cuando(con('margen', 'consultas'))).toBe(false)
  })
})
