import { describe, expect, it } from 'vitest'
import {
  ADMIN,
  V1,
  V2,
  admin,
  bloqueo,
  enLaPaz,
  entrada,
  persona,
  reunion,
} from './ejemplos.soporte'
import { candidatosPara, esElegible } from './elegibilidad'

const v1 = persona(V1)
const elegible = (hora: string, cambios: Parameters<typeof entrada>[0] = {}, quien = v1) =>
  esElegible(quien, enLaPaz(`2026-11-03T${hora}`), entrada({ personas: [quien], ...cambios }))

describe('esElegible · reuniones y descanso (§5.5)', () => {
  const con = (inicio: string) => ({ reuniones: [reunion(V1, `2026-11-03T${inicio}`)] })

  it('reunión 09:00–09:30: no a las 09:00 ni a las 09:30 (descanso hasta 09:45), sí a las 10:00', () => {
    expect(elegible('09:00', con('09:00'))).toBe(false)
    expect(elegible('09:30', con('09:00'))).toBe(false)
    expect(elegible('10:00', con('09:00'))).toBe(true)
  })

  it('reunión a las 10:00: no a las 09:30 ([09:30, 10:15) cruza con [10:00, 10:45))', () => {
    expect(elegible('09:30', con('10:00'))).toBe(false)
    expect(elegible('10:30', con('10:00'))).toBe(false)
    expect(elegible('09:00', con('10:00'))).toBe(true)
    expect(elegible('11:00', con('10:00'))).toBe(true)
  })

  it('con descanso 0 se puede a las 09:30', () => {
    const config = { ...entrada().config, descansoMin: 0 }
    expect(elegible('09:30', { ...con('09:00'), config })).toBe(true)
  })

  it('una reunión cancelada no ocupa', () => {
    const cancelada = reunion(V1, '2026-11-03T09:00', { estado: 'cancelada' })
    expect(elegible('09:00', { reuniones: [cancelada] })).toBe(true)
  })

  it('la reunión que se está reagendando no ocupa', () => {
    const actual = reunion(V1, '2026-11-03T09:00')
    expect(elegible('09:00', { reuniones: [actual], excluirReunionId: actual.id })).toBe(true)
  })

  it('la reunión de otra persona no ocupa', () => {
    expect(elegible('09:00', { reuniones: [reunion(V2, '2026-11-03T09:00')] })).toBe(true)
  })
})

describe('esElegible · máximo por día', () => {
  const cuatro = ['09:00', '10:00', '11:00', '14:00'].map((h) => reunion(V1, `2026-11-03T${h}`))

  it('con 4 reuniones el 3 nov no es elegible a las 16:00; con 3 sí', () => {
    expect(elegible('16:00', { reuniones: cuatro })).toBe(false)
    expect(elegible('16:00', { reuniones: cuatro.slice(0, 3) })).toBe(true)
  })

  it('la excluida no cuenta para el máximo', () => {
    const [primera = cuatro[0]] = cuatro
    expect(elegible('16:00', { reuniones: cuatro, excluirReunionId: primera?.id })).toBe(true)
  })

  it('el día es el de La Paz, no el de UTC', () => {
    const noche = ['20:00', '20:45', '21:30', '22:15'].map((h) => reunion(V1, `2026-11-03T${h}`))
    expect(elegible('09:00', { reuniones: noche })).toBe(false)
    const siguiente = esElegible(v1, enLaPaz('2026-11-04T09:00'), entrada({ reuniones: noche }))
    expect(siguiente).toBe(true)
  })
})

describe('esElegible · bloqueos y condiciones de la persona', () => {
  const bloqueado = { bloqueos: [bloqueo(V1, '2026-11-03T10:00', '2026-11-03T11:00')] }

  it('un bloqueo de 10:00 a 11:00 no suma descanso', () => {
    expect(elegible('09:30', bloqueado)).toBe(true)
    expect(elegible('11:00', bloqueado)).toBe(true)
    expect(elegible('10:00', bloqueado)).toBe(false)
    expect(elegible('10:30', bloqueado)).toBe(false)
    expect(elegible('09:45', bloqueado)).toBe(false)
  })

  it('un bloqueo de otra persona no cuenta', () => {
    expect(
      elegible('10:00', { bloqueos: [bloqueo(V2, '2026-11-03T10:00', '2026-11-03T11:00')] }),
    ).toBe(true)
  })

  it.each([
    ['inactiva', { activo: false }],
    ['fuera de turno', { enTurno: false }],
    ['sin whatsapp', { whatsapp: null }],
    ['con whatsapp vacío', { whatsapp: '' }],
    ['sin enlace de Meet', { enlaceMeet: null }],
    ['con enlace vacío', { enlaceMeet: '' }],
  ])('no es elegible %s', (_nombre, cambios) => {
    expect(elegible('09:00', {}, persona(V1, cambios))).toBe(false)
  })
})

describe('candidatosPara (R1.2, R4.9, R4.1, R4.20)', () => {
  const hora = enLaPaz('2026-11-03T10:00')
  const base = { personas: [persona(V1), persona(V2), admin()] }
  const ocupa = (id: string) => reunion(id, '2026-11-03T10:00')

  it('con vendedores elegibles, sólo ellos (el admin es respaldo)', () => {
    expect(candidatosPara(hora, entrada(base))).toEqual([V1, V2])
  })

  it('sin vendedores elegibles, el admin elegible', () => {
    const reuniones = [ocupa(V1), ocupa(V2)]
    expect(candidatosPara(hora, entrada({ ...base, reuniones }))).toEqual([ADMIN])
  })

  it('el admin fuera de turno no es respaldo', () => {
    const personas = [persona(V1), admin({ enTurno: false })]
    expect(candidatosPara(hora, entrada({ personas, reuniones: [ocupa(V1)] }))).toEqual([])
  })

  it('limitarA: sólo esa persona si está activa y libre', () => {
    expect(candidatosPara(hora, entrada({ ...base, limitarA: V2 }))).toEqual([V2])
    expect(
      candidatosPara(hora, entrada({ ...base, limitarA: V2, reuniones: [ocupa(V2)] })),
    ).toEqual([])
  })

  it('limitarA inactiva o inexistente vuelve a la regla general', () => {
    const inactiva = [persona(V1), persona(V2, { activo: false })]
    expect(candidatosPara(hora, entrada({ personas: inactiva, limitarA: V2 }))).toEqual([V1])
    expect(candidatosPara(hora, entrada({ ...base, limitarA: ADMIN.replace('aa', 'bb') }))).toEqual(
      [V1, V2],
    )
  })
})
