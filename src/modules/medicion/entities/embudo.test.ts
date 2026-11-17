import { describe, expect, it } from 'vitest'

import {
  fuenteDelEmbudo,
  mesEnZona,
  rangoDelMes,
  sumarEmbudoDelEquipo,
  sumarEmbudoPropio,
} from './embudo'

describe('mesEnZona y rangoDelMes (C6)', () => {
  it('mesEnZona usa el día de La Paz (−4)', () => {
    expect(mesEnZona('2026-12-01T03:59:00Z')).toBe('2026-11')
    expect(mesEnZona('2026-12-01T04:00:00Z')).toBe('2026-12')
  })

  it('rangoDelMes da el primer día y el primer día del mes siguiente (exclusivo)', () => {
    expect(rangoDelMes('2026-11')).toEqual({ desde: '2026-11-01', hasta: '2026-12-01' })
    expect(rangoDelMes('2026-12')).toEqual({ desde: '2026-12-01', hasta: '2027-01-01' })
    expect(rangoDelMes('2026-01')).toEqual({ desde: '2026-01-01', hasta: '2026-02-01' })
  })

  it('un mes que no es YYYY-MM con mes 01–12 da null', () => {
    expect(rangoDelMes('2026-13')).toBeNull()
    expect(rangoDelMes('2026-00')).toBeNull()
    expect(rangoDelMes('26-01')).toBeNull()
    expect(rangoDelMes('2026-1')).toBeNull()
    expect(rangoDelMes('')).toBeNull()
  })
})

describe('sumarEmbudoDelEquipo y sumarEmbudoPropio (C7)', () => {
  it('suma las filas de metricas_diarias', () => {
    expect(
      sumarEmbudoDelEquipo([
        {
          solicitudes: 3,
          reuniones_reservadas: 2,
          reuniones_realizadas: 1,
          ganadas: 1,
          clics_whatsapp: 7,
          calculadoras: 4,
        },
        {
          solicitudes: 2,
          reuniones_reservadas: 1,
          reuniones_realizadas: 1,
          ganadas: 0,
          clics_whatsapp: 3,
          calculadoras: 1,
        },
      ]),
    ).toEqual({
      solicitudes: 5,
      reunionesReservadas: 3,
      reunionesRealizadas: 2,
      ganadas: 1,
      clicsWhatsapp: 10,
      calculadoras: 5,
    })
  })

  it('sin filas, todo da 0', () => {
    expect(sumarEmbudoDelEquipo([])).toEqual({
      solicitudes: 0,
      reunionesReservadas: 0,
      reunionesRealizadas: 0,
      ganadas: 0,
      clicsWhatsapp: 0,
      calculadoras: 0,
    })
    expect(sumarEmbudoPropio([])).toEqual({
      solicitudes: 0,
      reunionesReservadas: 0,
      reunionesRealizadas: 0,
      ganadas: 0,
    })
  })

  it('el propio toma solicitudes de solicitudes_asignadas', () => {
    expect(
      sumarEmbudoPropio([
        {
          solicitudes_asignadas: 4,
          reuniones_reservadas: 3,
          reuniones_realizadas: 2,
          ganadas: 1,
        },
        {
          solicitudes_asignadas: 1,
          reuniones_reservadas: 0,
          reuniones_realizadas: 0,
          ganadas: 0,
        },
      ]),
    ).toEqual({ solicitudes: 5, reunionesReservadas: 3, reunionesRealizadas: 2, ganadas: 1 })
  })
})

describe('fuenteDelEmbudo (C8)', () => {
  it('decide de dónde se lee según el alcance', () => {
    expect(fuenteDelEmbudo('todos')).toBe('equipo')
    expect(fuenteDelEmbudo('propio')).toBe('propio')
    expect(fuenteDelEmbudo(null)).toBeNull()
  })
})
