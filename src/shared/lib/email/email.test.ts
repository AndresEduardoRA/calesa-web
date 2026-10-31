import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type { EntornoDelServidor } from '../../config/servidor'
import { crearAdaptadorMailpit } from './adaptadores/mailpit'
import {
  cancelarEmail,
  enviarEmail,
  programaCorreos,
  programarEmail,
  reprogramarEmail,
} from './index'

const mensaje = {
  para: 'ana@ejemplo.com',
  asunto: 'Hola',
  html: '<p>Hola</p>',
  texto: 'Hola',
  etiquetas: { tipo: 'prueba' },
}
const remitente = { email: 'avisos@correo.ejemplo.com', nombre: 'Mi proyecto' }
const entorno = (extra: Partial<EntornoDelServidor>): EntornoDelServidor =>
  ({ SUPABASE_SECRET_KEY: 's', EMAIL_PROVEEDOR: 'ninguno', ...extra }) as EntornoDelServidor

function pedidoSimulado(respuesta: Response | Error) {
  const llamadas: { url: string; cuerpo: unknown }[] = []
  const cabeceras: unknown[] = []
  const pedir = vi.fn((url: string | URL | Request, init?: RequestInit) => {
    llamadas.push({
      url: String(url),
      cuerpo: init?.body === undefined ? undefined : (JSON.parse(String(init.body)) as unknown),
    })
    cabeceras.push(init?.headers)
    return respuesta instanceof Error ? Promise.reject(respuesta) : Promise.resolve(respuesta)
  }) as unknown as typeof fetch
  return { pedir, llamadas, cabeceras }
}

describe('el adaptador de Mailpit (contrato con su API)', () => {
  it('manda POST /api/v1/send con remitente, destinatarios, asunto, HTML, texto y etiquetas, y devuelve el id', async () => {
    const { pedir, llamadas } = pedidoSimulado(Response.json({ ID: 'abc123' }))
    const r = await crearAdaptadorMailpit('http://127.0.0.1:55324/', pedir)(
      { ...mensaje, para: ['a@b.co', 'c@d.co'] },
      remitente,
    )
    expect(r).toEqual({ ok: true, data: { id: 'abc123' } })
    expect(llamadas).toEqual([
      {
        url: 'http://127.0.0.1:55324/api/v1/send',
        cuerpo: {
          From: { Email: 'avisos@correo.ejemplo.com', Name: 'Mi proyecto' },
          To: [{ Email: 'a@b.co' }, { Email: 'c@d.co' }],
          Subject: 'Hola',
          HTML: '<p>Hola</p>',
          Text: 'Hola',
          Tags: ['tipo:prueba'],
        },
      },
    ])
  })

  it('una respuesta de error o sin id es un valor de error, no una excepción', async () => {
    const malo = await crearAdaptadorMailpit(
      'http://m',
      pedidoSimulado(new Response('x', { status: 500 })).pedir,
    )(mensaje, remitente)
    expect(malo).toMatchObject({ ok: false, error: { codigo: 'inesperado' } })
    const sinId = await crearAdaptadorMailpit('http://m', pedidoSimulado(Response.json({})).pedir)(
      mensaje,
      remitente,
    )
    expect(sinId).toMatchObject({ ok: false })
  })

  it('sin red dice que Mailpit no respondió', async () => {
    const r = await crearAdaptadorMailpit(
      'http://m',
      pedidoSimulado(new Error('ECONNREFUSED')).pedir,
    )(mensaje, remitente)
    expect(r).toEqual({
      ok: false,
      error: { codigo: 'inesperado', mensaje: 'El correo no salió: Mailpit no respondió.' },
    })
  })
})

describe('enviarEmail()', () => {
  it('con EMAIL_PROVEEDOR=ninguno no manda nada y lo dice', async () => {
    const { pedir, llamadas } = pedidoSimulado(Response.json({ ID: 'x' }))
    const r = await enviarEmail(mensaje, { entorno: entorno({}), pedir })
    expect(r).toMatchObject({ ok: false, error: { codigo: 'regla' } })
    expect(llamadas).toEqual([])
  })

  it('con mailpit usa su adaptador y el remitente de la configuración', async () => {
    const { pedir, llamadas } = pedidoSimulado(Response.json({ ID: 'x' }))
    const r = await enviarEmail(mensaje, {
      entorno: entorno({
        EMAIL_PROVEEDOR: 'mailpit',
        MAILPIT_URL: 'http://127.0.0.1:55324',
        EMAIL_REMITENTE: 'avisos@correo.ejemplo.com',
        EMAIL_REMITENTE_NOMBRE: 'Mi proyecto',
      }),
      pedir,
    })
    expect(r).toEqual({ ok: true, data: { id: 'x' } })
    expect(llamadas[0]?.cuerpo).toMatchObject({ From: { Email: 'avisos@correo.ejemplo.com' } })
  })

  it('un mensaje inválido no sale', async () => {
    const { pedir, llamadas } = pedidoSimulado(Response.json({ ID: 'x' }))
    const r = await enviarEmail(
      { ...mensaje, para: 'no-es-correo' },
      { entorno: entorno({ EMAIL_PROVEEDOR: 'mailpit', MAILPIT_URL: 'http://m' }), pedir },
    )
    expect(r).toMatchObject({ ok: false, error: { codigo: 'validacion' } })
    expect(llamadas).toEqual([])
  })

  it('un proveedor sin adaptador no manda nada y lo dice', async () => {
    const r = await enviarEmail(mensaje, { entorno: entorno({ EMAIL_PROVEEDOR: 'cloudflare' }) })
    expect(r).toMatchObject({ ok: false, error: { codigo: 'regla' } })
    expect(r.ok ? '' : r.error.mensaje).toContain('todavía no tiene adaptador')
  })
})

const ID = '49a3999c-0ce1-4ea6-ab68-afcd6dc2e794'
const CUANDO = '2026-11-05T14:00:00-04:00'
const conResend = entorno({
  EMAIL_PROVEEDOR: 'resend',
  RESEND_API_KEY: 're_del_entorno',
  EMAIL_REMITENTE: 'hola@getcalesa.com',
  EMAIL_REMITENTE_NOMBRE: 'Calesa',
})
const conMailpit = entorno({
  EMAIL_PROVEEDOR: 'mailpit',
  MAILPIT_URL: 'http://127.0.0.1:55324',
  EMAIL_REMITENTE: 'hola@getcalesa.com',
  EMAIL_REMITENTE_NOMBRE: 'Calesa',
})

describe('con resend: enviar, programar, cancelar y reprogramar', () => {
  it('enviarEmail y programarEmail usan su adaptador con la clave del entorno', async () => {
    const { pedir, llamadas, cabeceras } = pedidoSimulado(Response.json({ id: ID }))
    expect(await enviarEmail(mensaje, { entorno: conResend, pedir })).toEqual({
      ok: true,
      data: { id: ID },
    })
    await programarEmail({ ...mensaje, referencia: 'recordatorio24:abc' }, CUANDO, {
      entorno: conResend,
      pedir,
    })
    expect(llamadas.map((l) => l.url)).toEqual([
      'https://api.resend.com/emails',
      'https://api.resend.com/emails',
    ])
    expect(cabeceras[0]).toMatchObject({ Authorization: 'Bearer re_del_entorno' })
    expect(llamadas[0]?.cuerpo).toMatchObject({ from: 'Calesa <hola@getcalesa.com>' })
    expect(llamadas[1]?.cuerpo).toMatchObject({ scheduled_at: CUANDO })
    expect(cabeceras[1]).toMatchObject({ 'Idempotency-Key': 'recordatorio24:abc' })
  })

  it('cancelarEmail y reprogramarEmail van al correo por su id', async () => {
    const { pedir, llamadas } = pedidoSimulado(Response.json({ object: 'email', id: ID }))
    expect(await cancelarEmail(ID, { entorno: conResend, pedir })).toEqual({
      ok: true,
      data: { id: ID },
    })
    await reprogramarEmail(ID, CUANDO, { entorno: conResend, pedir })
    expect(llamadas.map((l) => l.url)).toEqual([
      `https://api.resend.com/emails/${ID}/cancel`,
      `https://api.resend.com/emails/${ID}`,
    ])
    expect(llamadas[1]?.cuerpo).toEqual({ scheduled_at: CUANDO })
  })

  it('programaCorreos() es true sólo con resend', () => {
    expect(programaCorreos(conResend)).toBe(true)
    expect(programaCorreos(conMailpit)).toBe(false)
    expect(programaCorreos(entorno({}))).toBe(false)
  })

  it('un cuando sin zona, un id que no es guid o una referencia mala no salen', async () => {
    const { pedir, llamadas } = pedidoSimulado(Response.json({ id: ID }))
    const deps = { entorno: conResend, pedir }
    const resultados = [
      await programarEmail(mensaje, '2026-11-05T14:00:00', deps),
      await reprogramarEmail(ID, 'mañana', deps),
      await cancelarEmail('no-es-un-guid', deps),
      await reprogramarEmail('no-es-un-guid', CUANDO, deps),
      await enviarEmail({ ...mensaje, referencia: 'con espacios' }, deps),
    ]
    for (const r of resultados)
      expect(r).toMatchObject({ ok: false, error: { codigo: 'validacion' } })
    expect(llamadas).toEqual([])
  })
})

describe('sin resend no se programa', () => {
  it('con mailpit, programar, cancelar y reprogramar dicen que Mailpit no programa, sin red', async () => {
    const { pedir, llamadas } = pedidoSimulado(Response.json({ ID: 'x' }))
    const deps = { entorno: conMailpit, pedir }
    const error = {
      codigo: 'regla',
      mensaje: 'Mailpit no programa correos (EMAIL_PROVEEDOR=mailpit).',
    }
    expect(await programarEmail(mensaje, CUANDO, deps)).toEqual({ ok: false, error })
    expect(await cancelarEmail(ID, deps)).toEqual({ ok: false, error })
    expect(await reprogramarEmail(ID, CUANDO, deps)).toEqual({ ok: false, error })
    expect(llamadas).toEqual([])
  })

  it('con ninguno, las tres dicen que el correo está apagado', async () => {
    const { pedir, llamadas } = pedidoSimulado(Response.json({ ID: 'x' }))
    const deps = { entorno: entorno({}), pedir }
    for (const r of [
      await programarEmail(mensaje, CUANDO, deps),
      await cancelarEmail(ID, deps),
      await reprogramarEmail(ID, CUANDO, deps),
    ])
      expect(r).toEqual({
        ok: false,
        error: {
          codigo: 'regla',
          mensaje: 'El envío de correos está apagado (EMAIL_PROVEEDOR=ninguno).',
        },
      })
    expect(llamadas).toEqual([])
  })
})
