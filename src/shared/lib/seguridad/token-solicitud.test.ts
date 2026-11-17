// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('./cripto', async (importOriginal) => {
  const real = await importOriginal<typeof cripto>()
  return { ...real, igualesEnTiempoConstante: vi.fn(real.igualesEnTiempoConstante) }
})

import type { EntornoDelServidor } from '../../config/servidor'
import type * as cripto from './cripto'
import { igualesEnTiempoConstante } from './cripto'
import { TEXTO_TOKEN_VENCIDO } from './textos'
import { firmarTokenDeSolicitud, verificarTokenDeSolicitud } from './token-solicitud'

// Vector fijo sacado con `openssl dgst -sha256 -hmac … -binary | basenc --base64url` (bitácora de P06).
const SECRETO = 'secreto-de-prueba-para-firmar-tokens-0123456789'
const ID = '0b9f7c1e-2d4a-4c3b-9e8f-1a2b3c4d5e6f'
const EMITIDO = new Date('2026-11-03T10:00:00-04:00')
const EXP = 1793721600
const FIRMA = 'vR_ah_rhUAtv-QrWqlPBNezFfnbg-U7q1vWKpwGauRQ'
const TOKEN = `${ID}.${String(EXP)}.${FIRMA}`

const entorno = (extra: Partial<EntornoDelServidor>): EntornoDelServidor =>
  ({ SUPABASE_SECRET_KEY: 's', EMAIL_PROVEEDOR: 'ninguno', ...extra }) as EntornoDelServidor
const conSecreto = entorno({ TOKEN_FIRMA_SECRETO: SECRETO })
const a = (hora: string) => ({ entorno: conSecreto, ahora: new Date(`2026-11-03T${hora}-04:00`) })

describe('firmarTokenDeSolicitud', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('arma <id>.<exp>.<firma> con la firma del vector fijo y vence 2 h después de emitido', () => {
    const r = firmarTokenDeSolicitud(ID, { entorno: conSecreto, emitidoEn: EMITIDO })
    expect(r).toEqual({
      ok: true,
      data: { token: TOKEN, venceEn: new Date('2026-11-03T12:00:00-04:00').toISOString() },
    })
  })

  it('pasa el id a minúscula: la firma es la misma', () => {
    const r = firmarTokenDeSolicitud(ID.toUpperCase(), { entorno: conSecreto, emitidoEn: EMITIDO })
    expect(r.ok && r.data.token).toBe(TOKEN)
  })

  it('sin emitidoEn toma la hora actual (no solicitudes.creado_en)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(EMITIDO)
    const r = firmarTokenDeSolicitud(ID, { entorno: conSecreto })
    expect(r.ok && r.data.token).toBe(TOKEN)
  })

  it('con un id que no es guid o una fecha inválida da validacion', () => {
    const conFecha = { entorno: conSecreto, emitidoEn: EMITIDO }
    expect(firmarTokenDeSolicitud('no-es-un-id', conFecha)).toMatchObject({
      ok: false,
      error: { codigo: 'validacion' },
    })
    const sinFecha = { entorno: conSecreto, emitidoEn: new Date('no') }
    expect(firmarTokenDeSolicitud(ID, sinFecha)).toMatchObject({
      ok: false,
      error: { codigo: 'validacion' },
    })
  })

  it('sin TOKEN_FIRMA_SECRETO da inesperado', () => {
    const r = firmarTokenDeSolicitud(ID, { entorno: entorno({}), emitidoEn: EMITIDO })
    expect(r).toMatchObject({ ok: false, error: { codigo: 'inesperado' } })
  })
})

describe('verificarTokenDeSolicitud: vencimiento (emitido 10:00)', () => {
  it('a las 11:59:59 vale y devuelve el id y el vencimiento', () => {
    expect(verificarTokenDeSolicitud(TOKEN, a('11:59:59'))).toEqual({
      ok: true,
      data: { solicitudId: ID, venceEn: new Date('2026-11-03T12:00:00-04:00').toISOString() },
    })
  })

  it('firmado a las 10:00, verificado a las 11:59:59 vale (ida y vuelta)', () => {
    const r = firmarTokenDeSolicitud(ID, { entorno: conSecreto, emitidoEn: EMITIDO })
    const token = r.ok ? r.data.token : ''
    expect(verificarTokenDeSolicitud(token, a('11:59:59'))).toMatchObject({ ok: true })
  })

  it('a las 12:00:00 ya venció', () => {
    expect(verificarTokenDeSolicitud(TOKEN, a('12:00:00'))).toMatchObject({
      ok: false,
      error: { codigo: 'regla' },
    })
  })

  it('a las 12:01 dice «El enlace venció. Vuelve a llenar el formulario.»', () => {
    expect(verificarTokenDeSolicitud(TOKEN, a('12:01:00'))).toEqual({
      ok: false,
      error: { codigo: 'regla', mensaje: 'El enlace venció. Vuelve a llenar el formulario.' },
    })
  })

  it('sin TOKEN_FIRMA_SECRETO da inesperado', () => {
    const r = verificarTokenDeSolicitud(TOKEN, { entorno: entorno({}), ahora: EMITIDO })
    expect(r).toMatchObject({ ok: false, error: { codigo: 'inesperado' } })
  })
})

const cambiarUno = (texto: string, i: number) =>
  texto.slice(0, i) + (texto[i] === 'a' ? 'b' : 'a') + texto.slice(i + 1)

describe('verificarTokenDeSolicitud: manipulación', () => {
  const vencido = { codigo: 'validacion', mensaje: TEXTO_TOKEN_VENCIDO }

  it.each([
    ['un carácter del id', `${cambiarUno(ID, 3)}.${String(EXP)}.${FIRMA}`],
    ['el exp subido', `${ID}.${String(EXP + 3600)}.${FIRMA}`],
    ['el exp bajado al pasado', `${ID}.${String(EXP - 7200)}.${FIRMA}`],
    ['un carácter de la firma', `${ID}.${String(EXP)}.${cambiarUno(FIRMA, 10)}`],
    ['la firma con relleno', `${TOKEN}=`],
    ['dos segmentos', `${ID}.${FIRMA}`],
    ['cuatro segmentos', `${TOKEN}.x`],
    ['un id que no es guid', `abc.${String(EXP)}.${FIRMA}`],
    ['el exp con letras', `${ID}.17937a1600.${FIRMA}`],
    ['el id en mayúsculas', `${ID.toUpperCase()}.${String(EXP)}.${FIRMA}`],
    ['vacío', ''],
  ])('%s → validacion con el mismo texto que vencido', (_caso, token) => {
    expect(verificarTokenDeSolicitud(token, a('10:30:00'))).toEqual({ ok: false, error: vencido })
  })

  it('un token firmado con otro secreto → validacion', () => {
    const otro = entorno({ TOKEN_FIRMA_SECRETO: `${SECRETO}-otro` })
    const r = firmarTokenDeSolicitud(ID, { entorno: otro, emitidoEn: EMITIDO })
    const token = r.ok ? r.data.token : ''
    expect(verificarTokenDeSolicitud(token, a('10:30:00'))).toEqual({ ok: false, error: vencido })
  })

  it('mira la firma antes que el vencimiento: un exp del pasado manipulado da validacion, no regla', () => {
    const token = `${ID}.${String(EXP - 7200)}.${FIRMA}`
    expect(verificarTokenDeSolicitud(token, a('11:00:00'))).toMatchObject({
      ok: false,
      error: { codigo: 'validacion' },
    })
  })
})

describe('verificarTokenDeSolicitud: tiempo constante', () => {
  beforeEach(() => {
    vi.mocked(igualesEnTiempoConstante).mockClear()
  })

  it('compara la firma recibida con la recalculada por igualesEnTiempoConstante', () => {
    verificarTokenDeSolicitud(TOKEN, a('10:30:00'))
    const cambiada = cambiarUno(FIRMA, 0)
    verificarTokenDeSolicitud(`${ID}.${String(EXP)}.${cambiada}`, a('10:30:00'))
    expect(igualesEnTiempoConstante).toHaveBeenCalledWith(FIRMA, FIRMA)
    expect(igualesEnTiempoConstante).toHaveBeenCalledWith(cambiada, FIRMA)
  })
})
