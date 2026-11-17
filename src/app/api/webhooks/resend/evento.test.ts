// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { leerEventoDeResend, TEXTOS_DEL_EVENTO } from './evento'

const HORA = '2026-11-03T12:00:00.000Z'
const evento = (type: string, data: Record<string, unknown> = {}, extra = {}) => ({
  type,
  created_at: HORA,
  data: {
    email_id: '4ef9a417-02e9-4d39-ad75-9611e0fcc33c',
    created_at: '2026-11-01T08:00:00.000Z',
    to: ['ana@correo.com'],
    subject: 'Tu demo con Calesa',
    ...data,
  },
  ...extra,
})
const RESEND_ID = '4ef9a417-02e9-4d39-ad75-9611e0fcc33c'
const leer = (json: unknown) => leerEventoDeResend(json)

describe('leerEventoDeResend · los que marcan fallido', () => {
  it('un rebote temporal es reintentable', () => {
    expect(
      leer(evento('email.bounced', { bounce: { type: 'Temporary', subType: 'General' } })),
    ).toEqual({
      ok: true,
      data: {
        tipo: 'fallido',
        resendId: RESEND_ID,
        ultimoError: TEXTOS_DEL_EVENTO.reboteTemporal,
        reintentable: true,
        ocurridoEn: HORA,
      },
    })
    expect(TEXTOS_DEL_EVENTO.reboteTemporal).toBe(
      'Resend: el correo rebotó por un problema temporal.',
    )
  })

  it.each([
    ['permanente', { bounce: { type: 'Permanent', subType: 'Suppressed' } }],
    ['de un tipo desconocido', { bounce: { type: 'Raro' } }],
    ['sin bounce.type', { bounce: { subType: 'General' } }],
    ['sin bounce', {}],
  ])('un rebote %s no es reintentable', (_caso, data) => {
    expect(leer(evento('email.bounced', data))).toMatchObject({
      ok: true,
      data: {
        tipo: 'fallido',
        ultimoError: TEXTOS_DEL_EVENTO.rebotePermanente,
        reintentable: false,
      },
    })
    expect(TEXTOS_DEL_EVENTO.rebotePermanente).toBe(
      'Resend: el correo rebotó; la dirección no lo recibe.',
    )
  })

  it('un email.failed es reintentable y suma un motivo limpio', () => {
    expect(leer(evento('email.failed', { failed: { reason: 'reached_daily_quota' } }))).toEqual({
      ok: true,
      data: {
        tipo: 'fallido',
        resendId: RESEND_ID,
        ultimoError: 'Resend no pudo enviar el correo. (reached_daily_quota)',
        reintentable: true,
        ocurridoEn: HORA,
      },
    })
  })

  it.each([
    ['con espacios', 'quota for ana@correo.com'],
    ['con mayúsculas', 'Reached_Daily_Quota'],
    ['de más de 40 letras', 'a'.repeat(41)],
    ['que no es texto', 42],
  ])('un motivo %s no entra al texto', (_caso, reason) => {
    expect(leer(evento('email.failed', { failed: { reason } }))).toMatchObject({
      ok: true,
      data: { ultimoError: TEXTOS_DEL_EVENTO.fallo, reintentable: true },
    })
    expect(TEXTOS_DEL_EVENTO.fallo).toBe('Resend no pudo enviar el correo.')
  })

  it('un email.suppressed no es reintentable', () => {
    expect(leer(evento('email.suppressed'))).toMatchObject({
      ok: true,
      data: { tipo: 'fallido', ultimoError: TEXTOS_DEL_EVENTO.suprimido, reintentable: false },
    })
    expect(TEXTOS_DEL_EVENTO.suprimido).toBe('Resend no lo envió: la dirección está suprimida.')
  })
})

describe('leerEventoDeResend · enviado e ignorados', () => {
  it.each(['email.sent', 'email.delivered'])('%s marca enviado', (type) => {
    expect(leer(evento(type))).toEqual({
      ok: true,
      data: { tipo: 'enviado', resendId: RESEND_ID, ocurridoEn: HORA },
    })
  })

  it.each([
    'email.delivery_delayed',
    'email.complained',
    'email.opened',
    'email.clicked',
    'email.scheduled',
    'email.received',
    'contact.created',
    'constructor',
    '__proto__',
  ])('%s se ignora', (type) => {
    expect(leer({ type })).toEqual({ ok: true, data: { tipo: 'ignorar' } })
  })
})

describe('leerEventoDeResend · lo que no se toma del cuerpo', () => {
  it('nunca copia el destinatario, el asunto, el mensaje del rebote ni el diagnóstico', () => {
    const json = evento('email.bounced', {
      bounce: {
        type: 'Permanent',
        message: 'ana@correo.com no existe',
        diagnosticCode: ['550 ana'],
      },
    })
    const texto = JSON.stringify(leer(json))
    for (const dato of ['ana@correo.com', 'Tu demo', '550', 'no existe']) {
      expect(texto).not.toContain(dato)
    }
  })

  it('ocurridoEn es el created_at de primer nivel, no el de data', () => {
    const resultado = leer(evento('email.sent'))
    expect(resultado).toMatchObject({ ok: true, data: { ocurridoEn: HORA } })
  })

  it('normaliza a ISO en UTC una hora con zona', () => {
    const json = { ...evento('email.sent'), created_at: '2026-11-03T08:00:00.123456+00:00' }
    expect(leer(json)).toMatchObject({ ok: true, data: { ocurridoEn: '2026-11-03T08:00:00.123Z' } })
  })
})

describe('leerEventoDeResend · lo que es inválido', () => {
  it.each([
    ['sin type', { data: {} }],
    ['un type que no es texto', { type: 7 }],
    ['algo que no es objeto', 'email.sent'],
    ['null', null],
    ['sin email_id', evento('email.sent', { email_id: undefined })],
    ['un email_id vacío', evento('email.bounced', { email_id: '' })],
    ['un email_id de más de 100', evento('email.failed', { email_id: 'x'.repeat(101) })],
    ['un created_at sin zona', { ...evento('email.sent'), created_at: '2026-11-03T12:00:00' }],
    ['un created_at que no es fecha', { ...evento('email.suppressed'), created_at: 'ayer' }],
    ['sin data', { type: 'email.delivered', created_at: HORA }],
  ])('%s → validacion', (_caso, json) => {
    expect(leer(json)).toMatchObject({ ok: false, error: { codigo: 'validacion' } })
  })
})
