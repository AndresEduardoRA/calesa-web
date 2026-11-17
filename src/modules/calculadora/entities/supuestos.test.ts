import { describe, expect, it } from 'vitest'
import { CAPACIDAD_EXTRA, PROBABILIDAD_TARDE, SUPUESTOS, VOLATILIDAD } from './supuestos'

// Los literales de la semilla (§5.2 y §5.3): si cambia uno, cambia aquí y en la semilla.
describe('supuestos fijos', () => {
  it('son los de §5.2, con [mínimo, máximo]', () => {
    expect(SUPUESTOS).toStrictEqual({
      caida: [0.08, 0.15],
      dias_coord: [2, 4],
      no_ajusta: 0.5,
      olvido_frec: [0.08, 0.15],
      olvido_monto: [150, 200],
      preguntas: [1, 1.5],
      min_mensaje: 5,
      pct_cotiza: 0.4,
      min_cotiza: [12, 20],
      h_papeles: [3, 6],
      atraso: [4, 8],
      semanas_mes: 4.33,
      horas_mes: 176,
    })
  })

  it('la probabilidad de contestar después de 1 hora', () => {
    expect(PROBABILIDAD_TARDE).toStrictEqual({ h1: 0.15, h4: 0.5, dia: 0.7, sig: 0.9 })
  })

  it('la volatilidad del tipo de cambio', () => {
    expect(VOLATILIDAD).toStrictEqual({
      baja: [0.002, 0.005],
      media: [0.005, 0.01],
      alta: [0.01, 0.03],
    })
  })

  it('la capacidad extra por persona de §5.3', () => {
    expect(CAPACIDAD_EXTRA).toStrictEqual({ ventas: [0.1, 0.2], operacion: [0.3, 0.6] })
  })
})
