import { describe, expect, it } from 'vitest'
import { esquemaBloqueo, esquemaConfigAgenda, esquemaPersona, esquemaTramo } from './config'
import { CONFIG_INICIAL, HORARIO_INICIAL, V1, bloqueo, enLaPaz, persona } from './ejemplos.soporte'

describe('esquemaConfigAgenda', () => {
  it('acepta la configuración inicial (30/15/12/21/4/2, La Paz)', () => {
    expect(esquemaConfigAgenda.safeParse(CONFIG_INICIAL).success).toBe(true)
  })

  it.each([
    ['duración 10', { duracionMin: 10 }],
    ['descanso 61', { descansoMin: 61 }],
    ['anticipación 169', { anticipacionMinHoras: 169 }],
    ['horizonte 0', { horizonteDias: 0 }],
    ['máximo diario 13', { maxReunionesDia: 13 }],
    ['zona inválida', { zonaHoraria: 'Marte/Olimpo' }],
  ])('rechaza %s', (_nombre, cambio) => {
    expect(esquemaConfigAgenda.safeParse({ ...CONFIG_INICIAL, ...cambio }).success).toBe(false)
  })
})

describe('esquemaTramo', () => {
  it('acepta el horario L–V inicial', () => {
    expect(HORARIO_INICIAL.every((tramo) => esquemaTramo.safeParse(tramo).success)).toBe(true)
  })

  it.each([
    ['tramo 12:00–09:00', { diaSemana: 1, desde: '12:00', hasta: '09:00' }],
    ['tramo vacío', { diaSemana: 1, desde: '09:00', hasta: '09:00' }],
    ['día 8', { diaSemana: 8, desde: '09:00', hasta: '12:00' }],
    ['hora mal escrita', { diaSemana: 1, desde: '9:00', hasta: '12:00' }],
  ])('rechaza %s', (_nombre, tramo) => {
    expect(esquemaTramo.safeParse(tramo).success).toBe(false)
  })
})

describe('esquemaPersona y esquemaBloqueo', () => {
  it('acepta una persona y rechaza un id que no es guid', () => {
    expect(esquemaPersona.safeParse(persona(V1)).success).toBe(true)
    expect(esquemaPersona.safeParse(persona('v1')).success).toBe(false)
  })

  it('rechaza un instante sin zona', () => {
    expect(esquemaPersona.safeParse(persona(V1, { creadoEn: '2026-01-01T00:00:00' })).success).toBe(
      false,
    )
  })

  it('acepta un instante con desfase', () => {
    expect(
      esquemaPersona.safeParse(persona(V1, { creadoEn: '2026-01-01T00:00:00-04:00' })).success,
    ).toBe(true)
  })

  it('rechaza un bloqueo con fin ≤ inicio', () => {
    const bueno = bloqueo(V1, '2026-11-03T10:00', '2026-11-03T11:00')
    expect(esquemaBloqueo.safeParse(bueno).success).toBe(true)
    expect(esquemaBloqueo.safeParse({ ...bueno, fin: bueno.inicio }).success).toBe(false)
    expect(esquemaBloqueo.safeParse({ ...bueno, fin: enLaPaz('2026-11-03T09:00') }).success).toBe(
      false,
    )
  })
})
