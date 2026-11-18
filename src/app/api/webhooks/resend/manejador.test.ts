// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { fallo, ok, type Resultado } from '@/shared/lib/errores'
import type { AccionAplicable } from './evento'
import { firmarCuerpoDeResend } from './firma'
import { manejarWebhookDeResend, TOPE_DEL_CUERPO_BYTES } from './manejador'

const SECRETO = 'whsec_c2VjcmV0by1kZWwtd2ViaG9vay1kZS1wcnVlYmE='
const OTRO = 'whsec_b3RybyBzZWNyZXRvIGRlIHBydWViYQ=='
const AHORA = new Date('2026-11-03T12:00:00.000Z')
const TS = String(Math.floor(AHORA.getTime() / 1000))
const ID = 'msg_2pXcPrueba'
const hace = (min: number) => new Date(AHORA.getTime() - min * 60_000).toISOString()
const evento = (type: string, creado = hace(1), data: Record<string, unknown> = {}) =>
  JSON.stringify({ type, created_at: creado, data: { email_id: 're_123', ...data } })

// Un pedido firmado con la firma real (`firma.ts`) sobre los bytes exactos del cuerpo.
function pedido(cuerpo: string | Uint8Array, opciones: { secreto?: string; firma?: string } = {}) {
  const crudo = typeof cuerpo === 'string' ? new TextEncoder().encode(cuerpo) : cuerpo
  const firma =
    opciones.firma ??
    firmarCuerpoDeResend({
      secreto: opciones.secreto ?? SECRETO,
      id: ID,
      timestamp: TS,
      cuerpo: crudo,
    })
  return new Request('http://localhost/api/webhooks/resend', {
    method: 'POST',
    headers: { 'svix-id': ID, 'svix-timestamp': TS, 'svix-signature': firma ?? '' },
    body: new Uint8Array(crudo),
  })
}
const aplicarCon = (r: Resultado<unknown> | Error) =>
  vi.fn((_accion: AccionAplicable) => (r instanceof Error ? Promise.reject(r) : Promise.resolve(r)))
const atender = (req: Request, aplicar = aplicarCon(ok(null))) =>
  manejarWebhookDeResend(req, { secreto: SECRETO, ahora: AHORA, aplicar })

let errores: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  errores = vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => {
  errores.mockRestore()
})

describe('manejarWebhookDeResend · antes del evento', () => {
  it('un cuerpo de más de 64 KB → 413, sin aplicar', async () => {
    const aplicar = aplicarCon(ok(null))
    const grande = evento('email.sent') + ' '.repeat(TOPE_DEL_CUERPO_BYTES)
    const respuesta = await atender(pedido(grande), aplicar)
    expect(respuesta.status).toBe(413)
    expect(aplicar).not.toHaveBeenCalled()
  })

  it('un evento válido con la firma de otro secreto → 401, sin aplicar', async () => {
    const aplicar = aplicarCon(ok(null))
    const respuesta = await atender(pedido(evento('email.bounced'), { secreto: OTRO }), aplicar)
    expect(respuesta.status).toBe(401)
    expect(await respuesta.json()).toEqual({ ok: false })
    expect(aplicar).not.toHaveBeenCalled()
  })

  it('sin firma → 401', async () => {
    expect((await atender(pedido(evento('email.sent'), { firma: '' }))).status).toBe(401)
  })

  it('con la firma inválida no decodifica el JSON: un cuerpo «{» da 401, no 400', async () => {
    expect((await atender(pedido('{', { secreto: OTRO }))).status).toBe(401)
  })

  it('el vector de Svix como cuerpo crudo pasa la firma, y después da 400: no es un evento', async () => {
    const cuerpo = '{"test": 2432232314}'
    expect((await atender(pedido(cuerpo))).status).toBe(400)
  })

  it('firma los bytes exactos: con el cuerpo reserializado → 401', async () => {
    const cuerpo =
      '{"type": "email.sent", "created_at": "2026-11-03T11:59:00.000Z", "data": {"email_id": "re_1"}}'
    const firmaDelReserializado = firmarCuerpoDeResend({
      secreto: SECRETO,
      id: ID,
      timestamp: TS,
      cuerpo: new TextEncoder().encode(JSON.stringify(JSON.parse(cuerpo))),
    })
    expect((await atender(pedido(cuerpo, { firma: firmaDelReserializado ?? '' }))).status).toBe(401)
    expect((await atender(pedido(cuerpo))).status).toBe(200)
  })

  it.each([
    ['UTF-8 inválido', new Uint8Array([0x7b, 0xff, 0xfe, 0x7d])],
    ['JSON inválido', '{"type":'],
    [
      'un evento sin email_id',
      JSON.stringify({ type: 'email.sent', created_at: hace(1), data: {} }),
    ],
  ])('firmado, con %s → 400, sin aplicar', async (_caso, cuerpo) => {
    const aplicar = aplicarCon(ok(null))
    expect((await atender(pedido(cuerpo), aplicar)).status).toBe(400)
    expect(aplicar).not.toHaveBeenCalled()
  })
})

describe('manejarWebhookDeResend · el evento', () => {
  it('un evento que se ignora → 200, sin aplicar', async () => {
    const aplicar = aplicarCon(ok(null))
    const respuesta = await atender(pedido(evento('email.opened')), aplicar)
    expect(respuesta.status).toBe(200)
    expect(await respuesta.json()).toEqual({ ok: true })
    expect(aplicar).not.toHaveBeenCalled()
  })

  it('un rebote aplicado → 200, con la acción de K7', async () => {
    const aplicar = aplicarCon(ok({ cambio: true }))
    const cuerpo = evento('email.bounced', hace(2), { bounce: { type: 'Permanent' } })
    const respuesta = await atender(pedido(cuerpo), aplicar)
    expect(respuesta.status).toBe(200)
    expect(respuesta.headers.get('cache-control')).toBe('no-store')
    expect(aplicar).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'fallido',
        resendId: 're_123',
        reintentable: false,
        ocurridoEn: hace(2),
      }),
    )
  })

  it('no_encontrado de hace 9 min → 500: puede que la fila todavía no esté', async () => {
    const aplicar = aplicarCon(fallo('no_encontrado', 'sin fila'))
    expect((await atender(pedido(evento('email.failed', hace(9))), aplicar)).status).toBe(500)
  })

  it('no_encontrado de hace 11 min → 200: que Resend no reintente', async () => {
    const aplicar = aplicarCon(fallo('no_encontrado', 'sin fila'))
    expect((await atender(pedido(evento('email.failed', hace(11))), aplicar)).status).toBe(200)
  })

  it.each([
    ['otro error', fallo('inesperado', 'relation correos_salientes de ana@correo.com')],
    ['aplicar que lanza', new Error('ana@correo.com')],
  ])('%s → 500, con un log que sólo lleva el código', async (_caso, r) => {
    const respuesta = await atender(pedido(evento('email.sent')), aplicarCon(r))
    expect(respuesta.status).toBe(500)
    expect(await respuesta.json()).toEqual({ ok: false })
    expect(errores.mock.calls).toEqual([['webhook resend: inesperado']])
  })
})
