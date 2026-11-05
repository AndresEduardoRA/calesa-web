import type { Volatilidad } from './config'
import type { TiempoRespuesta } from './entradas'

// Los supuestos fijos de la calculadora y de la escala (semilla §5.2 y §5.3, B4.1), literales. Cada rango es [mínimo, máximo]: el
// índice 0 es el escenario mínimo y el 1, el máximo.

export const SUPUESTOS = {
  caida: [0.08, 0.15],
  dias_coord: [2, 4],
  no_ajusta: 0.5,
  olvido_frec: [0.08, 0.15],
  olvido_monto: [150, 200],
  preguntas: [1, 1.5], // por semana
  min_mensaje: 5,
  pct_cotiza: 0.4,
  min_cotiza: [12, 20],
  h_papeles: [3, 6], // por semana por persona
  atraso: [4, 8], // días
  semanas_mes: 4.33,
  horas_mes: 176,
} as const

// Probabilidad de contestar después de 1 hora (`s`).
export const PROBABILIDAD_TARDE: Readonly<Record<TiempoRespuesta, number>> = {
  h1: 0.15,
  h4: 0.5,
  dia: 0.7,
  sig: 0.9,
}

export const VOLATILIDAD: Readonly<Record<Volatilidad, readonly [number, number]>> = {
  baja: [0.002, 0.005],
  media: [0.005, 0.01],
  alta: [0.01, 0.03],
}

// Capacidad extra por persona con Calesa (§5.3, B8).
export const CAPACIDAD_EXTRA = { ventas: [0.1, 0.2], operacion: [0.3, 0.6] } as const
