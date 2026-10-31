import { describe, expect, it } from 'vitest'
import {
  formatearMonto,
  formatearNumero,
  formatearParaEditar,
  formatearPorcentaje,
  formatoRango,
  formatoUSD,
} from './formato'

// Intl separa símbolo y cifra con espacios duros; para comparar se normalizan.
const plano = (texto: string) => texto.replace(/[  ]/g, ' ')

describe('formatearNumero', () => {
  it('usa punto de miles y coma decimal en es-BO, sin ceros de relleno', () => {
    expect(formatearNumero(1234.5)).toBe('1.234,5')
    expect(formatearNumero(1000)).toBe('1.000')
  })

  it('redondea a los decimales pedidos', () => {
    expect(formatearNumero(1234.567)).toBe('1.234,57')
    expect(formatearNumero(1234.567, { decimales: 0 })).toBe('1.235')
  })
})

describe('formatearMonto', () => {
  it('imprime siempre dos decimales con el código o símbolo de la moneda', () => {
    expect(plano(formatearMonto(1234.5, { moneda: 'USD' }))).toBe('USD 1.234,50')
    expect(plano(formatearMonto(1234.5, { moneda: 'BOB' }))).toBe('Bs 1.234,50')
  })

  it('conserva el signo de los negativos', () => {
    expect(plano(formatearMonto(-50, { moneda: 'BOB' }))).toBe('-Bs 50,00')
  })

  it('respeta el locale y los decimales de otro proyecto', () => {
    expect(plano(formatearMonto(1234.5, { moneda: 'USD', locale: 'es-CL', decimales: 0 }))).toBe(
      'US$1.235',
    )
  })
})

describe('formatearPorcentaje', () => {
  it('recibe una fracción', () => {
    expect(plano(formatearPorcentaje(0.125))).toBe('12,5%')
    expect(plano(formatearPorcentaje(0.5, { decimales: 0 }))).toBe('50%')
  })
})

describe('con un locale o una moneda que Intl no conoce', () => {
  it('formatea con lo de fábrica en vez de tumbar la pantalla', () => {
    expect(() => formatearNumero(1234.5, { locale: 'zzz_x' })).not.toThrow()
    expect(formatearNumero(1234.5, { locale: 'zzz_x' })).toBe(formatearNumero(1234.5))
    expect(() => formatearMonto(10, { moneda: 'no', locale: 'es-BO' })).not.toThrow()
  })
})

describe('formatearParaEditar', () => {
  it('abre con la precisión completa, no con los decimales con que se muestra', () => {
    expect(formatearParaEditar(1234.567)).toBe('1234,567')
    expect(formatearNumero(1234.567)).toBe('1.234,57')
  })

  it('no agrupa miles: lo que se abre se vuelve a leer', () => {
    expect(formatearParaEditar(1234567.5)).toBe('1234567,5')
  })

  it('absorbe el ruido binario con 15 cifras significativas', () => {
    expect(formatearParaEditar(0.1 + 0.2)).toBe('0,3')
    expect(formatearParaEditar(14.940000000000001)).toBe('14,94')
  })

  it('usa el decimal del locale del proyecto', () => {
    expect(formatearParaEditar(1.5, { locale: 'en-US' })).toBe('1.5')
    expect(formatearParaEditar(1.5, { locale: 'es-BO' })).toBe('1,5')
  })

  it('escribe el cero y el negativo', () => {
    expect(formatearParaEditar(0)).toBe('0')
    expect(formatearParaEditar(-2.5)).toBe('-2,5')
  })
})

// Semilla §5.1: el texto exacto, con espacio normal después de `US$` y la raya (U+2013) entre los dos montos de un rango.
describe('formatoUSD', () => {
  it('los ejemplos de §5.1: entero, mitad hacia arriba, punto de miles', () => {
    expect(formatoUSD(4451.87)).toBe('US$ 4.452')
    expect(formatoUSD(126000)).toBe('US$ 126.000')
    expect(formatoUSD(1234.5)).toBe('US$ 1.235')
    expect(formatoUSD(0)).toBe('US$ 0')
  })

  it('agrupa también los miles de cuatro cifras', () => {
    expect(formatoUSD(1000)).toBe('US$ 1.000')
  })

  it('un negativo lleva el signo delante, y lo que redondea a cero no lleva signo', () => {
    expect(formatoUSD(-1234.5)).toBe('-US$ 1.235')
    expect(formatoUSD(-0.4)).toBe('US$ 0')
  })

  it('lo que no es un número da una raya', () => {
    expect(formatoUSD(Number.NaN)).toBe('—')
    expect(formatoUSD(Number.POSITIVE_INFINITY)).toBe('—')
  })
})

describe('formatoRango', () => {
  it('une los dos montos con una raya entre espacios, sin reordenarlos', () => {
    expect(formatoRango(4451.87, 8935.2)).toBe('US$ 4.452 – US$ 8.935')
    expect(formatoRango(8935.2, 4451.87)).toBe('US$ 8.935 – US$ 4.452')
  })
})
