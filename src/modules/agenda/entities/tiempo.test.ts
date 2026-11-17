import { describe, expect, it } from 'vitest'
import { enLaPaz } from './ejemplos.soporte'
import { diaIsoDeSemana, minutosDe, semanaIso, seCruzan } from './tiempo'

describe('seCruzan', () => {
  it('cruce parcial y contenido sí; tocarse en un borde no', () => {
    expect(seCruzan({ inicio: 0, fin: 10 }, { inicio: 5, fin: 15 })).toBe(true)
    expect(seCruzan({ inicio: 0, fin: 10 }, { inicio: 2, fin: 4 })).toBe(true)
    expect(seCruzan({ inicio: 0, fin: 10 }, { inicio: 10, fin: 20 })).toBe(false)
    expect(seCruzan({ inicio: 10, fin: 20 }, { inicio: 0, fin: 10 })).toBe(false)
  })
})

describe('minutosDe y diaIsoDeSemana', () => {
  it('minutosDe cuenta desde las 00:00', () => {
    expect(minutosDe('00:00')).toBe(0)
    expect(minutosDe('17:30')).toBe(1050)
  })

  it('diaIsoDeSemana: lunes 1 … domingo 7', () => {
    expect(diaIsoDeSemana('2026-11-02')).toBe(1)
    expect(diaIsoDeSemana('2026-11-08')).toBe(7)
  })
})

describe('semanaIso', () => {
  it('va del lunes 00:00 al lunes siguiente en la zona', () => {
    const semana = semanaIso(enLaPaz('2026-11-08T20:30'), 'America/La_Paz')
    expect(semana.inicio).toBe(Date.parse(enLaPaz('2026-11-02T00:00')))
    expect(semana.fin).toBe(Date.parse(enLaPaz('2026-11-09T00:00')))
  })

  it('el domingo de La Paz que ya es lunes en UTC sigue en la semana anterior', () => {
    const semana = semanaIso('2026-11-09T00:30:00Z', 'America/La_Paz')
    expect(semana.inicio).toBe(Date.parse(enLaPaz('2026-11-02T00:00')))
  })
})
