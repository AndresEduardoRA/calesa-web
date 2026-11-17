import { describe, expect, it } from 'vitest'
import { instanteDeLocal } from '@/shared/lib/fechas'
import { TEXTO_SIN_HORAS, TEXTO_SIN_HORAS_SEMANA, agruparPorDia, horasDeLaSemana } from './semana'
import { horasParaVisitante } from './zona'

const en = (zona: string, local: string): string => {
  const instante = instanteDeLocal(local, { zona })
  if (instante === null) {
    throw new Error(`Fecha de prueba inválida: ${local}`)
  }
  return instante
}

describe('horasDeLaSemana (C5): la semana ISO en la zona del visitante', () => {
  it('toma la semana de lunes a domingo que contiene el día pedido, en Bogotá', () => {
    const horas = [
      en('America/Bogota', '2026-11-04T09:00'),
      en('America/Bogota', '2026-11-10T09:00'),
    ]
    const semana = horasDeLaSemana(horas, '2026-11-04', 'America/Bogota')
    expect(semana).toEqual({
      desde: '2026-11-02',
      hasta: '2026-11-08',
      horas: [horas[0]],
      haySiguiente: true,
      vacio: null,
    })
  })

  it('el lunes 00:00 entra y el lunes siguiente 00:00 ya es de la otra semana', () => {
    const lunes = en('America/Bogota', '2026-11-02T00:00')
    const siguiente = en('America/Bogota', '2026-11-09T00:00')
    const semana = horasDeLaSemana([lunes, siguiente], '2026-11-08', 'America/Bogota')
    expect(semana.horas).toEqual([lunes])
    expect(semana.haySiguiente).toBe(true)
  })

  it('usa la zona del visitante, no la de La Paz: el lunes 00:30 de Madrid todavía es domingo en La Paz', () => {
    // Lunes 9 nov 00:30 en Madrid = domingo 8 nov 19:30 en La Paz.
    const hora = en('Europe/Madrid', '2026-11-09T00:30')
    expect(horasDeLaSemana([hora], '2026-11-09', 'Europe/Madrid').horas).toEqual([hora])
    expect(horasDeLaSemana([hora], '2026-11-04', 'Europe/Madrid').horas).toEqual([])
  })

  it('en la semana del cambio de horario de Santiago (5 abr 2026) la semana sigue siendo de lunes a lunes', () => {
    const antes = en('America/Santiago', '2026-03-30T00:00')
    const domingo = en('America/Santiago', '2026-04-05T23:30')
    const siguiente = en('America/Santiago', '2026-04-06T00:00')
    const semana = horasDeLaSemana([antes, domingo, siguiente], '2026-04-01', 'America/Santiago')
    expect(semana).toMatchObject({
      desde: '2026-03-30',
      hasta: '2026-04-05',
      horas: [antes, domingo],
    })
  })

  it('vacío: «semana» si hay horas en otra semana y «horizonte» si no hay ninguna', () => {
    const otra = en('America/La_Paz', '2026-11-12T09:00')
    expect(horasDeLaSemana([otra], '2026-11-04', 'America/La_Paz')).toMatchObject({
      horas: [],
      vacio: 'semana',
      haySiguiente: true,
    })
    expect(horasDeLaSemana([], '2026-11-04', 'America/La_Paz')).toMatchObject({
      vacio: 'horizonte',
      haySiguiente: false,
    })
  })

  it('los textos del vacío son los de §6.5', () => {
    expect(TEXTO_SIN_HORAS_SEMANA).toBe('No hay horas libres esta semana. Mira la siguiente.')
    expect(TEXTO_SIN_HORAS).toBe('Ahora no tenemos horas libres. Escríbenos por WhatsApp.')
  })
})

describe('agruparPorDia (C5)', () => {
  it('junta las horas por día en orden, con el día una sola vez y sin días vacíos', () => {
    const horas = [
      en('America/La_Paz', '2026-11-05T09:00'),
      en('America/La_Paz', '2026-11-03T14:00'),
      en('America/La_Paz', '2026-11-03T09:30'),
    ]
    expect(agruparPorDia(horasParaVisitante(horas, 'America/La_Paz'))).toEqual([
      {
        dia: '2026-11-03',
        horas: [
          { inicio: horas[2], hora: '09:30' },
          { inicio: horas[1], hora: '14:00' },
        ],
      },
      { dia: '2026-11-05', horas: [{ inicio: horas[0], hora: '09:00' }] },
    ])
  })

  it('sin horas devuelve una lista vacía', () => {
    expect(agruparPorDia([])).toEqual([])
  })
})
