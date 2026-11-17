import { describe, expect, it } from 'vitest'

import { CONTEXTO, ENLACE_DE_GESTION, REUNION, REUNION_CAMBIADA } from './ejemplos.soporte'
import { armarIcs, escaparTextoIcs, instanteIcs, plegarLinea } from './ics'

const base = { ahora: CONTEXTO.ahora, organizador: CONTEXTO.organizador }
const octetos = (linea: string) => new TextEncoder().encode(linea).length
// Desplegar (RFC 5545 §3.1): quitar CRLF seguido de un espacio.
const desplegar = (ics: string) => ics.replace(/\r\n /g, '')

describe('armarIcs · REQUEST de la reunión de ejemplo', () => {
  const ics = armarIcs({ metodo: 'REQUEST', reunion: REUNION, ...base })

  it('lleva método, UID estable, secuencia, horas en UTC y estado', () => {
    expect(ics).toContain('METHOD:REQUEST\r\n')
    expect(ics).toContain(`UID:${REUNION.reunionId}@calesa.app\r\n`)
    expect(ics).toContain('SEQUENCE:0\r\n')
    expect(ics).toContain('DTSTART:20261103T140000Z\r\n')
    expect(ics).toContain('DTEND:20261103T143000Z\r\n')
    expect(ics).toContain('DTSTAMP:20261102T120000Z\r\n')
    expect(ics).toContain('STATUS:CONFIRMED\r\n')
    expect(ics).toContain('PRODID:-//Calesa//Agenda//ES\r\n')
  })

  it('nombra al organizador y al visitante', () => {
    const desplegado = desplegar(ics)
    expect(desplegado).toContain('ORGANIZER;CN="Calesa":mailto:hola@getcalesa.com\r\n')
    expect(desplegado).toContain(
      'ATTENDEE;CN="Ana Pérez";ROLE=REQ-PARTICIPANT;RSVP=FALSE:mailto:ana@ejemplo.com\r\n',
    )
  })

  it('todas las líneas terminan en CRLF, sin LF sueltos', () => {
    expect(ics.endsWith('\r\n')).toBe(true)
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
  })

  it('empieza y termina como un VCALENDAR con un VEVENT', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true)
    expect(ics.endsWith('END:VEVENT\r\nEND:VCALENDAR\r\n')).toBe(true)
  })
})

describe('armarIcs · cambio y cancelación', () => {
  it('el cambio conserva el UID y sube SEQUENCE', () => {
    const ics = armarIcs({ metodo: 'REQUEST', reunion: REUNION_CAMBIADA, ...base })
    expect(ics).toContain(`UID:${REUNION.reunionId}@calesa.app\r\n`)
    expect(ics).toContain('SEQUENCE:1\r\n')
    expect(ics).toContain('DTSTART:20261104T150000Z\r\n')
  })

  it('el CANCEL lleva METHOD:CANCEL, STATUS:CANCELLED, el mismo UID y la secuencia vigente', () => {
    const ics = armarIcs({ metodo: 'CANCEL', reunion: REUNION_CAMBIADA, ...base })
    expect(ics).toContain('METHOD:CANCEL\r\n')
    expect(ics).toContain('STATUS:CANCELLED\r\n')
    expect(ics).not.toContain('METHOD:REQUEST')
    expect(ics).not.toContain('STATUS:CONFIRMED')
    expect(ics).toContain(`UID:${REUNION.reunionId}@calesa.app\r\n`)
    expect(ics).toContain('SEQUENCE:1\r\n')
  })
})

describe('armarIcs · texto largo y escapes', () => {
  const largo = {
    ...REUNION,
    anfitrion: { ...REUNION.anfitrion, nombre: 'Ñandú; el, grande\\ ' + 'ñ'.repeat(80) },
  }
  const ics = armarIcs({ metodo: 'REQUEST', reunion: largo, ...base })

  it('ninguna línea pasa de 75 octetos', () => {
    for (const linea of ics.split('\r\n')) expect(octetos(linea)).toBeLessThanOrEqual(75)
  })

  it('al desplegar vuelve el texto, con ;, , y \\ escapados', () => {
    const desplegado = desplegar(ics)
    expect(desplegado).toContain(String.raw`Ñandú\; el\, grande\\ ` + 'ñ'.repeat(80))
  })

  it('nunca lleva el enlace de gestión ni /reunion/', () => {
    const conGestion = armarIcs({ metodo: 'REQUEST', reunion: REUNION, ...base })
    expect(conGestion).not.toContain('/reunion/')
    expect(conGestion).not.toContain(ENLACE_DE_GESTION)
  })

  it('un nombre con comillas no rompe el parámetro CN', () => {
    const raro = { ...REUNION, visitante: { ...REUNION.visitante, nombre: 'Ana "la" Pérez' } }
    expect(armarIcs({ metodo: 'REQUEST', reunion: raro, ...base })).toContain('CN="Ana  la  Pérez"')
  })
})

describe('plegarLinea', () => {
  it('una línea corta queda igual', () => {
    expect(plegarLinea('SUMMARY:Demo')).toEqual(['SUMMARY:Demo'])
  })

  it('pliega a 75 octetos y las continuaciones empiezan con un espacio', () => {
    const partes = plegarLinea('X:' + 'a'.repeat(200))
    expect(partes.length).toBeGreaterThan(2)
    expect(octetos(partes[0] ?? '')).toBe(75)
    for (const parte of partes.slice(1)) {
      expect(parte.startsWith(' ')).toBe(true)
      expect(octetos(parte)).toBeLessThanOrEqual(75)
    }
    expect(partes.join('\r\n').replace(/\r\n /g, '')).toBe('X:' + 'a'.repeat(200))
  })

  it('no parte un carácter de varios bytes', () => {
    const linea = 'X:' + '€'.repeat(60)
    const partes = plegarLinea(linea)
    expect(partes.join('\r\n').replace(/\r\n /g, '')).toBe(linea)
    for (const parte of partes) expect(octetos(parte)).toBeLessThanOrEqual(75)
  })
})

describe('escaparTextoIcs e instanteIcs', () => {
  it('escapa \\, ;, , y los saltos de línea', () => {
    expect(escaparTextoIcs('a\\b;c,d\ne')).toBe(String.raw`a\\b\;c\,d\ne`)
  })

  it('escribe el instante en UTC sin separadores', () => {
    expect(instanteIcs('2026-11-03T10:00:00-04:00')).toBe('20261103T140000Z')
    expect(instanteIcs('2026-11-03T14:00:00.123Z')).toBe('20261103T140000Z')
  })
})
