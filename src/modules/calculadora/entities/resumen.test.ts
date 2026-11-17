import { describe, expect, it } from 'vitest'
import { calcularFugas } from './calculadora'
import { CONFIG_E3, CONFIG_INICIAL, ENTRADAS_E1, ENTRADAS_E2 } from './ejemplos.fixture'
import { resumenDeFugas } from './resumen'

const FILAS_E1 = [
  {
    fila: 'ventas',
    etiqueta: 'Ventas por contestar tarde',
    minimo: 'US$ 2.669',
    maximo: 'US$ 5.279',
  },
  { fila: 'dias', etiqueta: 'Días perdidos coordinando', minimo: 'US$ 333', maximo: 'US$ 666' },
  {
    fila: 'cambio',
    etiqueta: 'Diferencia de tipo de cambio',
    minimo: 'US$ 450',
    maximo: 'US$ 900',
  },
  { fila: 'olvidos', etiqueta: 'Costos que no se cobraron', minimo: 'US$ 300', maximo: 'US$ 750' },
  { fila: 'saldos', etiqueta: 'Saldos cobrados tarde', minimo: 'US$ 395', maximo: 'US$ 789' },
  { fila: 'tiempo', etiqueta: 'Horas del equipo', minimo: 'US$ 305', maximo: 'US$ 551' },
]

describe('resumenDeFugas · ejemplo 1 de §5.2', () => {
  const resumen = resumenDeFugas(calcularFugas(ENTRADAS_E1, CONFIG_INICIAL))

  it('el titular es el mínimo y el rango va del mínimo al máximo', () => {
    expect(resumen.titular).toBe('US$ 4.452')
    expect(resumen.rango).toBe('US$ 4.452 – US$ 8.935')
  })

  it('las horas a mano van redondeadas al final, como «77 a 139»', () => {
    expect(resumen.horas).toBe('77 a 139')
  })

  it('las seis filas, en orden, con su etiqueta y sus montos', () => {
    expect(resumen.filas).toStrictEqual(FILAS_E1)
  })
})

describe('resumenDeFugas · ejemplos 2 y 3 de §5.2', () => {
  it('el ejemplo 2 da US$ 915 – US$ 1.847 y 43 a 80 horas', () => {
    const resumen = resumenDeFugas(calcularFugas(ENTRADAS_E2, CONFIG_INICIAL))
    expect([resumen.rango, resumen.horas]).toEqual(['US$ 915 – US$ 1.847', '43 a 80'])
  })

  it('el ejemplo 3 da US$ 4.002 – US$ 8.035 y la fila de cambio en cero', () => {
    const resumen = resumenDeFugas(calcularFugas(ENTRADAS_E1, CONFIG_E3))
    expect(resumen.rango).toBe('US$ 4.002 – US$ 8.035')
    expect(resumen.filas.find((f) => f.fila === 'cambio')).toMatchObject({
      minimo: 'US$ 0',
      maximo: 'US$ 0',
    })
  })
})
