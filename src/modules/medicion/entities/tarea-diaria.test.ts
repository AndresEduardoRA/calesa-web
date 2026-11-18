// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { armarErrorDelLatido, PASOS_DE_LA_TAREA, VUELTAS_DE_RETENCION } from './tarea-diaria'

const MENSAJE_CON_DATOS = 'falló el correo de ana@correo.com: relation "solicitudes"'

describe('armarErrorDelLatido', () => {
  it('sin fallos da null', () => {
    expect(armarErrorDelLatido({ retencion: null, correos: null, cupos: null })).toBeNull()
  })

  it('une los pasos que fallaron, en orden, como «<paso>: <codigo>»', () => {
    const error = { codigo: 'inesperado' as const, mensaje: MENSAJE_CON_DATOS }
    expect(armarErrorDelLatido({ cupos: error, retencion: null, correos: error })).toBe(
      'correos: inesperado; cupos: inesperado',
    )
    expect(
      armarErrorDelLatido({
        retencion: { codigo: 'sin_permiso', mensaje: MENSAJE_CON_DATOS },
        correos: null,
        cupos: null,
      }),
    ).toBe('retencion: sin_permiso')
  })

  it('nunca lleva el mensaje del error', () => {
    const error = { codigo: 'regla' as const, mensaje: MENSAJE_CON_DATOS }
    const texto = armarErrorDelLatido({ retencion: error, correos: error, cupos: error }) ?? ''
    expect(texto).toBe('retencion: regla; correos: regla; cupos: regla')
    expect(texto).not.toContain('ana@correo.com')
    expect(texto).not.toContain('relation')
  })
})

describe('la tarea diaria', () => {
  it('corre retención, correos y cupos, en ese orden', () => {
    expect(PASOS_DE_LA_TAREA).toEqual(['retencion', 'correos', 'cupos'])
  })

  it('llama a la retención a lo sumo 5 veces por corrida', () => {
    expect(VUELTAS_DE_RETENCION).toBe(5)
  })
})
