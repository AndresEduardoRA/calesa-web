import { describe, expect, it } from 'vitest'

import { esquemaDeMensaje } from '@/shared/lib/email/tipos'
import { PLANTILLAS } from './datos'
import { DATOS_DE_EJEMPLO, REUNION } from './ejemplos.soporte'
import { hashCorto, referenciaDe } from './referencia'

describe('referenciaDe', () => {
  it('cada una de las 12 empieza con su plantilla y la acepta el contrato del kit', () => {
    for (const plantilla of PLANTILLAS) {
      const referencia = referenciaDe(DATOS_DE_EJEMPLO[plantilla])
      expect(referencia.startsWith(`${plantilla}:`)).toBe(true)
      const mensaje = { para: 'a@b.com', asunto: 'x', html: 'x', texto: 'x', referencia }
      expect(esquemaDeMensaje.safeParse(mensaje).success).toBe(true)
    }
  })

  it('sigue la tabla de la reunión de ejemplo', () => {
    expect(referenciaDe(DATOS_DE_EJEMPLO['reunion-confirmada'])).toBe(
      `reunion-confirmada:${REUNION.reunionId}:0`,
    )
    expect(referenciaDe(DATOS_DE_EJEMPLO['reunion-cancelada'])).toBe(
      `reunion-cancelada:${REUNION.reunionId}:visitante`,
    )
    expect(referenciaDe(DATOS_DE_EJEMPLO['solicitud-sin-reunion'])).toBe(
      `solicitud-sin-reunion:${REUNION.solicitudId}`,
    )
  })

  it('la secuencia 0 y la 1 dan referencias distintas', () => {
    const cambiada = DATOS_DE_EJEMPLO['reunion-cambiada']
    const otra = { ...cambiada, reunion: { ...cambiada.reunion, secuencia: 2 } }
    expect(referenciaDe(cambiada)).not.toBe(referenciaDe(otra))
  })

  it('dos recordatorios con otro enlace de Meet dan referencias distintas', () => {
    for (const plantilla of ['recordatorio-24h', 'recordatorio-1h'] as const) {
      const base = DATOS_DE_EJEMPLO[plantilla]
      const otro = {
        ...base,
        reunion: { ...base.reunion, enlaceMeet: 'https://meet.google.com/xyz-xxxx-xxx' },
      }
      expect(referenciaDe(base)).not.toBe(referenciaDe(otro))
    }
  })

  it('el mismo dato da siempre la misma referencia', () => {
    const datos = DATOS_DE_EJEMPLO['recordatorio-1h']
    expect(referenciaDe(datos)).toBe(referenciaDe({ ...datos }))
  })
})

describe('hashCorto', () => {
  it('da 8 hex estables y distintos para textos distintos', () => {
    expect(hashCorto('a')).toMatch(/^[0-9a-f]{8}$/)
    expect(hashCorto('a')).toBe(hashCorto('a'))
    expect(hashCorto('a')).not.toBe(hashCorto('b'))
    expect(hashCorto('')).toBe('811c9dc5')
  })
})
