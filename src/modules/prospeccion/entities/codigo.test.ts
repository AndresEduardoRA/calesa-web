import { describe, expect, it } from 'vitest'

import {
  MENSAJE_CODIGO_INVALIDO,
  PATRON_CODIGO,
  codigoDeRef,
  esCodigoValido,
  esquemaCodigoDeProspeccion,
  normalizarCodigo,
} from './codigo'

describe('normalizarCodigo (C1)', () => {
  it('pasa a mayúscula', () => {
    expect(normalizarCodigo('gt-02')).toBe('GT-02')
  })
  it('quita los espacios de los lados', () => {
    expect(normalizarCodigo(' GT-02 ')).toBe('GT-02')
  })
  it('sólo pasa a mayúscula las letras a-z ASCII', () => {
    expect(normalizarCodigo('straße')).toBe('STRAßE')
    expect(esCodigoValido(normalizarCodigo('straße'))).toBe(false)
    expect(normalizarCodigo('ıx')).toBe('ıX')
    expect(esCodigoValido(normalizarCodigo('ıx'))).toBe(false)
  })
  it('deja igual lo demás', () => {
    expect(normalizarCodigo('a b_c')).toBe('A B_C')
  })
})

describe('esCodigoValido (C2)', () => {
  it.each(['AB', 'GT-02', 'A'.repeat(20), '0-9'])('acepta %s', (codigo) => {
    expect(esCodigoValido(codigo)).toBe(true)
  })
  it.each(['A', 'A'.repeat(21), 'GT 02', 'GT_02', 'ÑU-1', '', 'gt-02'])(
    'rechaza «%s»',
    (codigo) => {
      expect(esCodigoValido(codigo)).toBe(false)
    },
  )
  it('el patrón es el del check de la tabla', () => {
    expect(PATRON_CODIGO.source).toBe('^[A-Z0-9-]{2,20}$')
  })
})

describe('esquemaCodigoDeProspeccion (C3)', () => {
  it('entrega el código normalizado', () => {
    expect(esquemaCodigoDeProspeccion.parse(' gt-02 ')).toBe('GT-02')
  })
  it('un código inválido lleva el mensaje', () => {
    const resultado = esquemaCodigoDeProspeccion.safeParse('x')
    expect(resultado.success).toBe(false)
    expect(resultado.error?.issues[0]?.message).toBe(MENSAJE_CODIGO_INVALIDO)
  })
  it('rechaza lo que no es texto', () => {
    expect(esquemaCodigoDeProspeccion.safeParse(42).success).toBe(false)
    expect(esquemaCodigoDeProspeccion.safeParse(undefined).success).toBe(false)
  })
})

describe('codigoDeRef (C4)', () => {
  it('normaliza un código bien escrito', () => {
    expect(codigoDeRef('gt-02')).toBe('GT-02')
  })
  it('descarta lo mal formado y lo que no es texto', () => {
    expect(codigoDeRef('x')).toBeNull()
    expect(codigoDeRef(undefined)).toBeNull()
    expect(codigoDeRef(['GT-02'])).toBeNull()
    expect(codigoDeRef(42)).toBeNull()
  })
})
