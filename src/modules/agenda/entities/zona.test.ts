import { describe, expect, it } from 'vitest'
import { AHORA, enLaPaz, entrada } from './ejemplos.soporte'
import { horasDisponibles } from './horas'
import { esZonaValida, esquemaZona, horasParaVisitante } from './zona'

describe('horasParaVisitante · ejemplos de §5.5', () => {
  const nueve = enLaPaz('2026-11-03T09:00')

  it('Bogotá (UTC−5): las 09:00 de La Paz son las 08:00', () => {
    expect(horasParaVisitante([nueve], 'America/Bogota')).toEqual([
      { inicio: nueve, dia: '2026-11-03', hora: '08:00' },
    ])
  })

  it('Madrid (fuera de §6.6) se acepta y se muestra convertida', () => {
    expect(esZonaValida('Europe/Madrid')).toBe(true)
    expect(horasParaVisitante([nueve], 'Europe/Madrid')[0]?.hora).toBe('14:00')
  })

  it('Auckland cambia hasta el día', () => {
    expect(horasParaVisitante([nueve], 'Pacific/Auckland')[0]).toMatchObject({
      dia: '2026-11-04',
      hora: '02:00',
    })
  })

  it('Santiago: con su cambio de horario del 4 abr 2027 (00:00)', () => {
    const horas = horasDisponibles(entrada({ ahora: enLaPaz('2027-03-29T08:00') }))
    const del = (dia: string) => horas.find((h) => h === enLaPaz(`${dia}T09:00`))
    const viernes = del('2027-04-02')
    const lunes = del('2027-04-05')
    expect(viernes).toBeDefined()
    expect(lunes).toBeDefined()
    const vistas = horasParaVisitante([viernes ?? '', lunes ?? ''], 'America/Santiago')
    expect(vistas.map((v) => v.hora)).toEqual(['10:00', '09:00'])
  })

  it('conserva el orden y la cantidad', () => {
    const horas = horasDisponibles(entrada({ ahora: AHORA })).slice(0, 5)
    expect(horasParaVisitante(horas, 'America/Bogota').map((v) => v.inicio)).toEqual(horas)
  })
})

describe('esZonaValida y esquemaZona', () => {
  it.each(['America/La_Paz', 'America/Argentina/Buenos_Aires', 'UTC'])('acepta %s', (zona) => {
    expect(esZonaValida(zona)).toBe(true)
  })

  it.each(['Marte/Olimpo', '', '+05:00', '-03:00'])('rechaza «%s»', (zona) => {
    expect(esZonaValida(zona)).toBe(false)
  })

  it('esquemaZona da un mensaje humano', () => {
    const resultado = esquemaZona.safeParse('Marte/Olimpo')
    expect(resultado.success).toBe(false)
    expect(resultado.error?.issues[0]?.message).toBe('Elige una zona horaria válida.')
  })

  it('una zona inválida muestra la hora de La Paz y no lanza', () => {
    const nueve = enLaPaz('2026-11-03T09:00')
    expect(horasParaVisitante([nueve], 'Marte/Olimpo')[0]?.hora).toBe('09:00')
  })
})
