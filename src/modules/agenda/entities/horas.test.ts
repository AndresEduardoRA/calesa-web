import { describe, expect, it } from 'vitest'
import { V1, V2, enLaPaz, entrada, persona, reunion } from './ejemplos.soporte'
import { horasDisponibles } from './horas'

const DIA = (iso: string, dia: string) => iso.startsWith(dia)
const locales = (horas: string[], dia: string) =>
  horas
    .filter((h) => DIA(new Date(Date.parse(h) - 4 * 3_600_000).toISOString(), dia))
    .map((h) => new Date(Date.parse(h) - 4 * 3_600_000).toISOString().slice(11, 16))

describe('horasDisponibles · ejemplo de §5.5 (lun 2 nov 2026, 08:00 La Paz)', () => {
  const horas = horasDisponibles(entrada())

  it('la primera hora es mar 3 nov 09:00 (el lunes 20:00 en adelante no tiene horario)', () => {
    expect(horas[0]).toBe(enLaPaz('2026-11-03T09:00'))
  })

  it('un día completo tiene los 14 inicios', () => {
    expect(locales(horas, '2026-11-03')).toEqual([
      '09:00',
      '09:30',
      '10:00',
      '10:30',
      '11:00',
      '11:30',
      '14:00',
      '14:30',
      '15:00',
      '15:30',
      '16:00',
      '16:30',
      '17:00',
      '17:30',
    ])
  })

  it('la última es vie 20 nov 17:30 y en total son 196 (14 días × 14)', () => {
    expect(horas.at(-1)).toBe(enLaPaz('2026-11-20T17:30'))
    expect(horas).toHaveLength(196)
  })

  it('los fines de semana no tienen horas y salen ordenadas y sin repetir', () => {
    expect(locales(horas, '2026-11-07')).toEqual([])
    expect(horas).toEqual([...new Set(horas)].sort())
  })
})

describe('horasDisponibles · bordes de la ventana', () => {
  const primera = (ahora: string, config = {}) =>
    horasDisponibles(
      entrada({ ahora: enLaPaz(ahora), config: { ...entrada().config, ...config } }),
    )[0]
  const ultima = (ahora: string) => horasDisponibles(entrada({ ahora: enLaPaz(ahora) })).at(-1)

  it('anticipación: con ahora lun 21:00 la primera es mar 09:00 (borde incluido)', () => {
    expect(primera('2026-11-02T21:00')).toBe(enLaPaz('2026-11-03T09:00'))
    expect(primera('2026-11-02T21:01')).toBe(enLaPaz('2026-11-03T09:30'))
  })

  it('anticipación: con ahora mar 00:00 la primera es mar 14:00 (no 11:00)', () => {
    expect(primera('2026-11-03T00:00')).toBe(enLaPaz('2026-11-03T14:00'))
  })

  it('anticipación 0 sale de la configuración', () => {
    expect(primera('2026-11-03T10:10', { anticipacionMinHoras: 0 })).toBe(
      enLaPaz('2026-11-03T10:30'),
    )
  })

  it('horizonte: con ahora lun 09:00 la última es lun 23 nov 09:00 (borde incluido)', () => {
    expect(ultima('2026-11-02T09:00')).toBe(enLaPaz('2026-11-23T09:00'))
    expect(ultima('2026-11-02T08:59')).toBe(enLaPaz('2026-11-20T17:30'))
  })
})

describe('horasDisponibles · duración, reuniones y personas', () => {
  it('con duración 45 el paso sigue siendo de 30 min (11:30 y 17:30 ya no)', () => {
    const config = { ...entrada().config, duracionMin: 45 }
    expect(locales(horasDisponibles(entrada({ config })), '2026-11-03')).toEqual([
      '09:00',
      '09:30',
      '10:00',
      '10:30',
      '11:00',
      '14:00',
      '14:30',
      '15:00',
      '15:30',
      '16:00',
      '16:30',
      '17:00',
    ])
  })

  it('reunión de V1 mar 3 nov 09:00: ese día no ofrece 09:00 ni 09:30 y sí 10:00', () => {
    const horas = horasDisponibles(entrada({ reuniones: [reunion(V1, '2026-11-03T09:00')] }))
    const del3 = locales(horas, '2026-11-03')
    expect(del3).not.toContain('09:00')
    expect(del3).not.toContain('09:30')
    expect(del3).toContain('10:00')
  })

  it('con 4 reuniones el 3 nov no se ofrece ese día y sí el 4', () => {
    const reuniones = ['09:00', '10:00', '11:00', '14:00'].map((h) =>
      reunion(V1, `2026-11-03T${h}`),
    )
    const horas = horasDisponibles(entrada({ reuniones }))
    expect(locales(horas, '2026-11-03')).toEqual([])
    expect(locales(horas, '2026-11-04')).toHaveLength(14)
  })

  it('con V1 ocupado y V2 libre las 09:00 se ofrecen', () => {
    const personas = [persona(V1), persona(V2)]
    const horas = horasDisponibles(
      entrada({ personas, reuniones: [reunion(V1, '2026-11-03T09:00')] }),
    )
    expect(locales(horas, '2026-11-03')).toContain('09:00')
  })

  it('sin personas elegibles no hay horas', () => {
    expect(horasDisponibles(entrada({ personas: [] }))).toEqual([])
  })
})
