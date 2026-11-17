// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { firmarCuerpoDeResend, TOLERANCIA_DE_FIRMA_S, verificarFirmaDeResend } from './firma'

// El vector de la guía manual de Svix (docs.svix.com/receiving/verifying-payloads/how-manual), con un cuerpo que lleva un espacio:
// así un JSON reserializado ya no casa. Su HMAC se comprobó con node:crypto el 2026-11-17.
const SVIX = {
  secreto: 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw',
  id: 'msg_p5jXN8AQM9LWM0D4loKWxJek',
  timestamp: '1614265330',
  cuerpo: '{"test": 2432232314}',
  firma: 'v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=',
}
const bytes = (texto: string) => new TextEncoder().encode(texto)
const EN_HORA = new Date(Number(SVIX.timestamp) * 1000)
const conVector = (cambios: Partial<Parameters<typeof verificarFirmaDeResend>[0]> = {}) =>
  verificarFirmaDeResend({
    id: SVIX.id,
    timestamp: SVIX.timestamp,
    firmas: SVIX.firma,
    cuerpo: bytes(SVIX.cuerpo),
    secreto: SVIX.secreto,
    ahora: EN_HORA,
    ...cambios,
  })
const segundos = (s: number) => new Date(EN_HORA.getTime() + s * 1000)

describe('verificarFirmaDeResend · lo que pasa', () => {
  it('el vector de Svix da true', () => {
    expect(conVector()).toBe(true)
  })

  it('firmarCuerpoDeResend arma la misma firma que el vector', () => {
    const { secreto, id, timestamp } = SVIX
    expect(firmarCuerpoDeResend({ secreto, id, timestamp, cuerpo: bytes(SVIX.cuerpo) })).toBe(
      SVIX.firma,
    )
  })

  it('con varias firmas, vale si alguna casa', () => {
    expect(conVector({ firmas: `v1,AAAA ${SVIX.firma}` })).toBe(true)
  })

  it(`acepta el timestamp a ${TOLERANCIA_DE_FIRMA_S} s, de los dos lados`, () => {
    expect(conVector({ ahora: segundos(TOLERANCIA_DE_FIRMA_S) })).toBe(true)
    expect(conVector({ ahora: segundos(-TOLERANCIA_DE_FIRMA_S) })).toBe(true)
  })
})

describe('verificarFirmaDeResend · lo que no pasa', () => {
  it.each([
    ['el cuerpo reserializado, sin el espacio', { cuerpo: bytes('{"test":2432232314}') }],
    ['un byte de más en el cuerpo', { cuerpo: bytes(`${SVIX.cuerpo} `) }],
    ['otro id', { id: 'msg_otro' }],
    ['el timestamp a 301 s hacia atrás', { ahora: segundos(301) }],
    ['el timestamp a 301 s hacia adelante', { ahora: segundos(-301) }],
    ['otra versión', { firmas: SVIX.firma.replace('v1,', 'v1a,') }],
    ['la firma sin versión', { firmas: SVIX.firma.slice(3) }],
    ['un secreto sin whsec_', { secreto: SVIX.secreto.slice('whsec_'.length) }],
    ['otro secreto', { secreto: 'whsec_b3RybyBzZWNyZXRvIGRlIHBydWViYQ==' }],
    ['sin id', { id: null }],
    ['sin timestamp', { timestamp: '' }],
    ['sin firmas', { firmas: null }],
    ['sin secreto', { secreto: undefined }],
  ])('%s → false', (_caso, cambios) => {
    expect(conVector(cambios)).toBe(false)
  })

  it('la firma buena en la 11.ª entrada → false', () => {
    const relleno = Array.from({ length: 10 }, () => 'v1,AAAA').join(' ')
    expect(conVector({ firmas: `${relleno} ${SVIX.firma}` })).toBe(false)
    const nueve = Array.from({ length: 9 }, () => 'v1,AAAA').join(' ')
    expect(conVector({ firmas: `${nueve} ${SVIX.firma}` })).toBe(true)
  })

  it.each([
    ['un timestamp que no son dígitos', { timestamp: 'abc' }],
    ['un timestamp con decimales', { timestamp: '1614265330.5' }],
    ['un secreto con base64 roto', { secreto: 'whsec_%%%' }],
    ['un secreto vacío tras whsec_', { secreto: 'whsec_' }],
  ])('nunca lanza: %s → false', (_caso, cambios) => {
    expect(() => conVector(cambios)).not.toThrow()
    expect(conVector(cambios)).toBe(false)
  })

  it('firmarCuerpoDeResend sin un secreto válido da null', () => {
    const { id, timestamp } = SVIX
    expect(
      firmarCuerpoDeResend({ secreto: 'sin-prefijo', id, timestamp, cuerpo: bytes('x') }),
    ).toBeNull()
  })
})
