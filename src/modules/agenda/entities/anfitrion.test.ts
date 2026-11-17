import { describe, expect, it } from 'vitest'
import { ADMIN, V1, V2, admin, enLaPaz, entrada, persona, reunion } from './ejemplos.soporte'
import { HORA_OCUPADA, elegirAnfitrion } from './anfitrion'

const H = enLaPaz('2026-11-04T10:00') // miércoles
const elegir = (cambios: Parameters<typeof entrada>[0], asignadoA: string | null = null, h = H) =>
  elegirAnfitrion({ ...entrada(cambios), h, asignadoA })

const ambos = [persona(V1), persona(V2)]
const dosEnLaSemana = (id: string) => [
  reunion(id, '2026-11-02T09:00'),
  reunion(id, '2026-11-05T09:00'),
]

describe('elegirAnfitrion · reparto parejo (§5.6)', () => {
  it('V1 con 2 reuniones esa semana y V2 con 1 → V2, y la solicitud pasa a V2', () => {
    const reuniones = [...dosEnLaSemana(V1), reunion(V2, '2026-11-03T09:00')]
    expect(elegir({ personas: ambos, reuniones })).toEqual({
      ok: true,
      anfitrionId: V2,
      cambiaAsignado: true,
    })
  })

  it('V1 y V2 con 1; V1 recibió la última hace 2 días y V2 hace 5 → V2', () => {
    const reuniones = [reunion(V1, '2026-11-03T09:00'), reunion(V2, '2026-11-03T11:00')]
    const personas = [
      persona(V1, { ultimaReunionEn: enLaPaz('2026-11-02T09:00') }),
      persona(V2, { ultimaReunionEn: enLaPaz('2026-10-30T09:00') }),
    ]
    expect(elegir({ personas, reuniones })).toMatchObject({ ok: true, anfitrionId: V2 })
  })

  it('la semana es la de La Paz: el domingo 20:30 (lunes en UTC) cuenta en la semana anterior', () => {
    const viernes = enLaPaz('2026-11-06T10:00')
    const reuniones = [reunion(V1, '2026-11-08T20:30')]
    const personas = [persona(V1, { creadoEn: '2025-01-01T00:00:00Z' }), persona(V2)]
    expect(elegir({ personas, reuniones }, null, viernes)).toMatchObject({ anfitrionId: V2 })
  })

  it('una reunión cancelada no cuenta en la semana', () => {
    const cancelada = reunion(V2, '2026-11-03T09:00', { estado: 'cancelada' })
    const personas = [persona(V1, { creadoEn: '2025-01-01T00:00:00Z' }), persona(V2)]
    const reuniones = [reunion(V1, '2026-11-03T11:00'), cancelada]
    expect(elegir({ personas, reuniones })).toMatchObject({ anfitrionId: V2 })
  })

  it('la reunión que se reagenda no cuenta en la semana (excluirReunionId)', () => {
    const actual = reunion(V1, '2026-11-03T09:00')
    const reuniones = [actual, reunion(V2, '2026-11-03T11:00')]
    // V1 es más nueva: sólo gana si su reunión excluida no suma.
    const personas = [persona(V1, { creadoEn: '2026-06-01T00:00:00Z' }), persona(V2)]
    expect(elegir({ personas, reuniones, excluirReunionId: actual.id })).toMatchObject({
      anfitrionId: V1,
    })
    expect(elegir({ personas, reuniones })).toMatchObject({ anfitrionId: V2 })
  })

  it('las reuniones de la semana anterior y de la siguiente no cuentan', () => {
    const reuniones = [reunion(V1, '2026-10-30T09:00'), reunion(V1, '2026-11-09T09:00')]
    const personas = [persona(V1, { creadoEn: '2025-01-01T00:00:00Z' }), persona(V2)]
    expect(elegir({ personas, reuniones })).toMatchObject({ anfitrionId: V1 })
  })
})

describe('elegirAnfitrion · preferir al asignado (X5)', () => {
  it('el asignado elegible gana aunque tenga más reuniones, y no cambia el asignado', () => {
    const reuniones = [...dosEnLaSemana(V1), reunion(V2, '2026-11-03T09:00')]
    expect(elegir({ personas: ambos, reuniones }, V1)).toEqual({
      ok: true,
      anfitrionId: V1,
      cambiaAsignado: false,
    })
  })

  it('el asignado ocupado a esa hora: reparto parejo y cambia el asignado', () => {
    const reuniones = [reunion(V1, '2026-11-04T10:00')]
    expect(elegir({ personas: ambos, reuniones }, V1)).toEqual({
      ok: true,
      anfitrionId: V2,
      cambiaAsignado: true,
    })
  })

  it('un admin asignado no le gana a un vendedor elegible (el admin es respaldo)', () => {
    expect(elegir({ personas: [persona(V1), admin()] }, ADMIN)).toMatchObject({
      anfitrionId: V1,
      cambiaAsignado: true,
    })
  })

  it('limitarA reduce los candidatos a esa persona', () => {
    expect(elegir({ personas: ambos, limitarA: V2 })).toMatchObject({ anfitrionId: V2 })
  })
})

describe('elegirAnfitrion · la hora ya no se puede', () => {
  const ocupada = { ok: false, error: 'Esa hora se acaba de ocupar. Elige otra.' }

  it('sin candidatos responde que la hora se ocupó', () => {
    const reuniones = [reunion(V1, '2026-11-04T10:00')]
    expect(elegir({ personas: [persona(V1)], reuniones })).toEqual(ocupada)
    expect(HORA_OCUPADA).toBe(ocupada.error)
  })

  it('acepta la hora como instante en cualquier formato ISO válido', () => {
    for (const h of [
      '2026-11-04T14:00:00Z',
      '2026-11-04T14:00:00.000+00:00',
      '2026-11-04T10:00:00-04:00',
    ]) {
      expect(elegir({ personas: ambos }, null, h)).toMatchObject({ ok: true })
    }
  })

  it('una hora fuera del horario o de la ventana también', () => {
    expect(elegir({}, null, enLaPaz('2026-11-04T08:30'))).toEqual(ocupada)
    expect(elegir({}, null, enLaPaz('2026-11-04T10:15'))).toEqual(ocupada)
    expect(elegir({}, null, enLaPaz('2026-12-04T10:00'))).toEqual(ocupada)
    expect(elegir({}, null, enLaPaz('2026-11-02T10:00'))).toEqual(ocupada)
  })
})
