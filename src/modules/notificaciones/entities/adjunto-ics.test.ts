import { describe, expect, it } from 'vitest'

import { esquemaDeAdjunto } from '@/shared/lib/email/tipos'
import { adjuntoDeIcs, NOMBRE_DEL_ICS } from './adjunto-ics'
import { armarIcs } from './ics'
import { CONTEXTO, REUNION } from './ejemplos.soporte'

const ICS = armarIcs({
  metodo: 'REQUEST',
  reunion: { ...REUNION, visitante: { nombre: 'Ana Muñoz', email: 'ana@ejemplo.com' } },
  ahora: CONTEXTO.ahora,
  organizador: CONTEXTO.organizador,
})

describe('adjuntoDeIcs', () => {
  it('lleva el método en el tipo, sin charset, y un nombre fijo', () => {
    expect(adjuntoDeIcs(ICS, 'REQUEST')).toMatchObject({
      nombre: NOMBRE_DEL_ICS,
      tipo: 'text/calendar; method=REQUEST',
    })
    expect(adjuntoDeIcs(ICS, 'CANCEL').tipo).toBe('text/calendar; method=CANCEL')
  })

  it('el contenido es el .ics en UTF-8 y base64, con «ñ» y «reunión» intactas', () => {
    const texto = `${ICS}\r\nX-NOTA:reunión\r\n`
    const { contenido } = adjuntoDeIcs(texto, 'REQUEST')
    expect(Buffer.from(contenido, 'base64').toString('utf8')).toBe(texto)
    expect(
      Buffer.from(adjuntoDeIcs(ICS, 'REQUEST').contenido, 'base64').toString('utf8'),
    ).toContain('Muñoz')
  })

  it('pasa el esquema de adjunto del kit', () => {
    expect(esquemaDeAdjunto.safeParse(adjuntoDeIcs(ICS, 'CANCEL')).success).toBe(true)
  })
})
