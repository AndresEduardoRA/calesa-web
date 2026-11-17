// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  firmarTokenDeSolicitud,
  hashDeTokenDeGestion,
  TEXTO_TOKEN_VENCIDO,
} from '@/shared/lib/seguridad'
import { ENTORNO, SOLICITUD, TOKEN_GESTION } from './pruebas.soporte'
import { TEXTO_ENLACE_INVALIDO, leerToken, leerTokenDeGestion } from './tokens'

const EMITIDO = new Date('2026-11-03T10:00:00-04:00')
const a = (hora: string) => ({ entorno: ENTORNO, ahora: new Date(`2026-11-03T${hora}-04:00`) })

function tokenDeSolicitud(): string {
  const firmado = firmarTokenDeSolicitud(SOLICITUD, { entorno: ENTORNO, emitidoEn: EMITIDO })
  if (!firmado.ok) {
    throw new Error('no se pudo firmar el token de prueba')
  }
  return firmado.data.token
}

describe('leerToken (C4): el de solicitud lleva puntos; el de gestión, no', () => {
  it('un token de solicitud vigente da la solicitud', () => {
    expect(leerToken(tokenDeSolicitud(), a('11:59:00'))).toEqual({
      ok: true,
      data: { tipo: 'solicitud', solicitudId: SOLICITUD },
    })
  })

  it('vencido o manipulado dice lo mismo: el enlace venció', () => {
    const vencido = leerToken(tokenDeSolicitud(), a('12:01:00'))
    expect(vencido).toEqual({ ok: false, error: { codigo: 'regla', mensaje: TEXTO_TOKEN_VENCIDO } })
    const token = tokenDeSolicitud()
    const manipulado = `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`
    const r = leerToken(manipulado, a('11:00:00'))
    expect(r.ok === false && r.error.mensaje).toBe(TEXTO_TOKEN_VENCIDO)
  })

  it('un token de gestión bien formado da su hash, sin ir a la base', () => {
    const r = leerToken(TOKEN_GESTION, a('11:00:00'))
    expect(r).toEqual({
      ok: true,
      data: { tipo: 'gestion', hash: hashDeTokenDeGestion(TOKEN_GESTION) },
    })
    expect(r.ok && r.data.tipo === 'gestion' && r.data.hash).toMatch(/^\\x[0-9a-f]{64}$/)
  })

  it('uno de gestión mal formado: «Este enlace no es válido.»', () => {
    expect(TEXTO_ENLACE_INVALIDO).toBe('Este enlace no es válido.')
    for (const malo of ['abc', `${TOKEN_GESTION}x`, '']) {
      expect(leerToken(malo, a('11:00:00'))).toEqual({
        ok: false,
        error: { codigo: 'regla', mensaje: TEXTO_ENLACE_INVALIDO },
      })
    }
  })
})

describe('leerTokenDeGestion (C4)', () => {
  it('acepta sólo el de gestión', () => {
    expect(leerTokenDeGestion(TOKEN_GESTION)).toEqual({
      ok: true,
      data: { tipo: 'gestion', hash: hashDeTokenDeGestion(TOKEN_GESTION) },
    })
  })

  it('uno de solicitud no abre la gestión de una reunión', () => {
    expect(leerTokenDeGestion(tokenDeSolicitud())).toEqual({
      ok: false,
      error: { codigo: 'regla', mensaje: TEXTO_ENLACE_INVALIDO },
    })
  })
})
