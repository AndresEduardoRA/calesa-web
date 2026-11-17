import { describe, expect, it } from 'vitest'
import { formatoUSD } from '@/shared/lib/formato'
import { calcularFugas, type Escenario } from './calculadora'
import { CONFIG_E3, CONFIG_INICIAL, ENTRADAS_E1, ENTRADAS_E2 } from './ejemplos.fixture'

type Fila = Exclude<keyof Escenario, 'total' | 'horas'>

// Las filas de los ejemplos de §5.2, [mínimo, máximo], como se muestran.
const FILAS_E1: [Fila, string, string][] = [
  ['ventas', 'US$ 2.669', 'US$ 5.279'],
  ['dias', 'US$ 333', 'US$ 666'],
  ['cambio', 'US$ 450', 'US$ 900'],
  ['olvidos', 'US$ 300', 'US$ 750'],
  ['saldos', 'US$ 395', 'US$ 789'],
  ['tiempo', 'US$ 305', 'US$ 551'],
]

const FILAS_E2: [Fila, string, string][] = [
  ['ventas', 'US$ 146', 'US$ 276'],
  ['dias', 'US$ 138', 'US$ 276'],
  ['cambio', 'US$ 180', 'US$ 360'],
  ['olvidos', 'US$ 120', 'US$ 300'],
  ['saldos', 'US$ 158', 'US$ 316'],
  ['tiempo', 'US$ 173', 'US$ 319'],
]

describe('calcularFugas · ejemplo 1 de §5.2', () => {
  const r = calcularFugas(ENTRADAS_E1, CONFIG_INICIAL)

  it.each(FILAS_E1)('%s da %s y %s', (fila, minimo, maximo) => {
    expect([formatoUSD(r.minimo[fila]), formatoUSD(r.maximo[fila])]).toEqual([minimo, maximo])
  })

  it('el total sin redondear es 4451,87 y 8935,01', () => {
    expect(r.minimo.total).toBeCloseTo(4451.87, 2)
    expect(r.maximo.total).toBeCloseTo(8935.01, 2)
  })
})

describe('calcularFugas · ejemplo 2 de §5.2', () => {
  const r = calcularFugas(ENTRADAS_E2, CONFIG_INICIAL)

  it.each(FILAS_E2)('%s da %s y %s', (fila, minimo, maximo) => {
    expect([formatoUSD(r.minimo[fila]), formatoUSD(r.maximo[fila])]).toEqual([minimo, maximo])
  })

  it('el total sin redondear es 914,51 y 1846,92', () => {
    expect(r.minimo.total).toBeCloseTo(914.51, 2)
    expect(r.maximo.total).toBeCloseTo(1846.92, 2)
  })
})

describe('calcularFugas · ejemplo 3 de §5.2 (sin moneda local)', () => {
  const r = calcularFugas(ENTRADAS_E1, CONFIG_E3)

  it('el cambio es 0 exacto y el total da US$ 4.002 y US$ 8.035', () => {
    expect([r.minimo.cambio, r.maximo.cambio]).toEqual([0, 0])
    expect([formatoUSD(r.minimo.total), formatoUSD(r.maximo.total)]).toEqual([
      'US$ 4.002',
      'US$ 8.035',
    ])
  })
})

// Derivados de §5.2: ramas de la fórmula que los ejemplos no tocan, recalculadas desde la fórmula literal.
describe('calcularFugas · derivados de §5.2', () => {
  it('D1: sin costo (margen mayor que el precio) no hay días perdidos', () => {
    const r = calcularFugas({ ...ENTRADAS_E1, margen: 5000 }, { ...CONFIG_INICIAL, precio: 3000 })
    expect([r.minimo.dias, r.maximo.dias]).toEqual([0, 0])
  })

  it('D2: con una seña mayor que el precio no hay saldos', () => {
    const r = calcularFugas(ENTRADAS_E1, { ...CONFIG_INICIAL, sena: 30000 })
    expect([r.minimo.saldos, r.maximo.saldos]).toEqual([0, 0])
  })

  it.each([
    ['baja', 'US$ 180', 'US$ 450'],
    ['alta', 'US$ 900', 'US$ 2.700'],
  ] as const)('D3: con volatilidad %s el cambio da %s y %s', (volatilidad, minimo, maximo) => {
    const r = calcularFugas(ENTRADAS_E1, { ...CONFIG_INICIAL, volatilidad })
    expect([formatoUSD(r.minimo.cambio), formatoUSD(r.maximo.cambio)]).toEqual([minimo, maximo])
  })

  it.each([
    ['h4', 'US$ 1.875', 'US$ 3.649'],
    ['sig', 'US$ 3.491', 'US$ 7.023'],
  ] as const)('D4: respondiendo %s las ventas dan %s y %s', (respuesta, minimo, maximo) => {
    const r = calcularFugas({ ...ENTRADAS_E1, respuesta }, CONFIG_INICIAL)
    expect([formatoUSD(r.minimo.ventas), formatoUSD(r.maximo.ventas)]).toEqual([minimo, maximo])
  })
})
