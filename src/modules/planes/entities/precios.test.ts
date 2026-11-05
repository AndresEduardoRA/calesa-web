import { describe, expect, it } from 'vitest'
import {
  PLANES,
  ahorroAnual,
  autosDelPlan,
  montoDelPlan,
  pagoAnual,
  semanasDelPlan,
} from './precios'

describe('PLANES (semilla §5.4)', () => {
  it('son los cuatro planes, en orden, con sus constantes', () => {
    expect(PLANES).toStrictEqual([
      {
        id: 'vitrina',
        nombre: 'Vitrina',
        recomendado: false,
        autos: { tipo: 'hasta', tope: 20 },
        cuota: 490,
        implementacion: 4500,
        desde: false,
        semanas: [2, 2],
      },
      {
        id: 'operacion',
        nombre: 'Operación',
        recomendado: true,
        autos: { tipo: 'hasta', tope: 60 },
        cuota: 1290,
        implementacion: 12000,
        desde: false,
        semanas: [3, 4],
      },
      {
        id: 'completo',
        nombre: 'Completo',
        recomendado: false,
        autos: { tipo: 'hasta', tope: 150 },
        cuota: 2900,
        implementacion: 25000,
        desde: false,
        semanas: [4, 6],
      },
      {
        id: 'grupo',
        nombre: 'Grupo',
        recomendado: false,
        autos: { tipo: 'mas_de', tope: 150 },
        cuota: 5500,
        implementacion: 60000,
        desde: true,
        semanas: [8, 12],
      },
    ])
  })
})

describe('pagoAnual y ahorroAnual (12 por 10)', () => {
  it.each([
    ['Vitrina', 490, 4900, 980],
    ['Operación', 1290, 12900, 2580],
    ['Completo', 2900, 29000, 5800],
    ['Grupo', 5500, 55000, 11000],
  ])('%s: cuota %s da anual %s y ahorro %s', (_plan, cuota, anual, ahorro) => {
    expect(pagoAnual(cuota)).toBe(anual)
    expect(ahorroAnual(cuota)).toBe(ahorro)
  })

  it('el anual y el ahorro de cada plan salen de su cuota', () => {
    expect(PLANES.map((p) => [pagoAnual(p.cuota), ahorroAnual(p.cuota)])).toEqual([
      [4900, 980],
      [12900, 2580],
      [29000, 5800],
      [55000, 11000],
    ])
  })
})

describe('los textos de cada plan, desde sus constantes', () => {
  const [vitrina, operacion, , grupo] = PLANES

  it('montoDelPlan antepone «Desde» sólo en Grupo', () => {
    expect(montoDelPlan(operacion, 1290)).toBe('US$ 1.290')
    expect(montoDelPlan(grupo, 5500)).toBe('Desde US$ 5.500')
  })

  it('autosDelPlan dice «Hasta» o «Más de»', () => {
    expect(autosDelPlan(vitrina)).toBe('Hasta 20')
    expect(autosDelPlan(grupo)).toBe('Más de 150')
  })

  it('semanasDelPlan usa la raya sin espacios, o un solo número', () => {
    expect(semanasDelPlan(vitrina)).toBe('2 semanas')
    expect(semanasDelPlan(operacion)).toBe('3–4 semanas')
  })
})
