import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type { EntornoDelServidor } from '../../config/servidor'
import { crearAdaptadorMailpit } from './adaptadores/mailpit'
import { enviarEmail, programarEmail } from './index'

// Los adjuntos de `esquemaDeMensaje` y cómo los pasa cada adaptador a su API.
const mensaje = {
  para: 'ana@ejemplo.com',
  asunto: 'Hola',
  html: '<p>Hola</p>',
  texto: 'Hola',
  etiquetas: { tipo: 'prueba' },
}
const remitente = { email: 'avisos@correo.ejemplo.com', nombre: 'Mi proyecto' }
const entorno = (extra: Partial<EntornoDelServidor>): EntornoDelServidor =>
  ({ EMAIL_PROVEEDOR: 'ninguno', ...extra }) as EntornoDelServidor

function pedidoSimulado(respuesta: Response | Error) {
  const llamadas: { url: string; cuerpo: unknown }[] = []
  const pedir = vi.fn((url: string | URL | Request, init?: RequestInit) => {
    llamadas.push({
      url: String(url),
      cuerpo: init?.body === undefined ? undefined : (JSON.parse(String(init.body)) as unknown),
    })
    return respuesta instanceof Error ? Promise.reject(respuesta) : Promise.resolve(respuesta)
  }) as unknown as typeof fetch
  return { pedir, llamadas }
}

const ICS = 'BEGIN:VCALENDAR\r\nMETHOD:REQUEST\r\nEND:VCALENDAR\r\n'
const ICS_BASE64 = Buffer.from(ICS).toString('base64')
const adjuntoIcs = {
  nombre: 'demo.ics',
  tipo: 'text/calendar; method=REQUEST',
  contenido: ICS_BASE64,
}

describe('los adjuntos que salen', () => {
  it('Mailpit los manda en Attachments con su contenido en base64', async () => {
    const { pedir, llamadas } = pedidoSimulado(Response.json({ ID: 'abc123' }))
    const r = await crearAdaptadorMailpit('http://m', pedir)(
      { ...mensaje, adjuntos: [adjuntoIcs] },
      remitente,
    )
    expect(r).toEqual({ ok: true, data: { id: 'abc123' } })
    expect(llamadas[0]?.cuerpo).toMatchObject({
      Attachments: [
        { Filename: 'demo.ics', ContentType: 'text/calendar; method=REQUEST', Content: ICS_BASE64 },
      ],
    })
  })

  it('Mailpit no manda Attachments si no hay adjuntos', async () => {
    const { pedir, llamadas } = pedidoSimulado(Response.json({ ID: 'abc123' }))
    await crearAdaptadorMailpit('http://m', pedir)(mensaje, remitente)
    expect(llamadas[0]?.cuerpo).not.toHaveProperty('Attachments')
  })

  it('enviarEmail los acepta y los pasa al adaptador', async () => {
    const { pedir, llamadas } = pedidoSimulado(Response.json({ ID: 'x' }))
    const r = await enviarEmail(
      { ...mensaje, adjuntos: [adjuntoIcs] },
      {
        entorno: entorno({
          EMAIL_PROVEEDOR: 'mailpit',
          MAILPIT_URL: 'http://m',
          EMAIL_REMITENTE: remitente.email,
          EMAIL_REMITENTE_NOMBRE: remitente.nombre,
        }),
        pedir,
      },
    )
    expect(r.ok).toBe(true)
    expect(llamadas[0]?.cuerpo).toMatchObject({ Attachments: [{ Filename: 'demo.ics' }] })
  })
})

describe('los adjuntos que no salen', () => {
  it.each([
    ['sin nombre', { ...adjuntoIcs, nombre: '' }],
    ['con una ruta en el nombre', { ...adjuntoIcs, nombre: '../etc/passwd' }],
    ['con una barra invertida en el nombre', { ...adjuntoIcs, nombre: 'a\\b.ics' }],
    ['con un salto de línea en el nombre', { ...adjuntoIcs, nombre: 'a\r\nBcc: x@y.co' }],
    ['con un tipo que no es MIME', { ...adjuntoIcs, tipo: 'calendario' }],
    ['con un tipo con salto de línea', { ...adjuntoIcs, tipo: 'text/calendar\r\nX: y' }],
    ['con un contenido que no es base64', { ...adjuntoIcs, contenido: 'no es base64!' }],
    ['sin contenido', { ...adjuntoIcs, contenido: '' }],
  ])('un adjunto %s no sale', async (_caso, adjunto) => {
    const { pedir, llamadas } = pedidoSimulado(Response.json({ ID: 'x' }))
    const r = await enviarEmail(
      { ...mensaje, adjuntos: [adjunto] },
      { entorno: entorno({ EMAIL_PROVEEDOR: 'mailpit', MAILPIT_URL: 'http://m' }), pedir },
    )
    expect(r).toMatchObject({ ok: false, error: { codigo: 'validacion' } })
    expect(llamadas).toEqual([])
  })

  it('más de 5 adjuntos, o uno de más de 5 MB, no salen', async () => {
    const { pedir, llamadas } = pedidoSimulado(Response.json({ ID: 'x' }))
    const dependencias = {
      entorno: entorno({ EMAIL_PROVEEDOR: 'mailpit', MAILPIT_URL: 'http://m' }),
      pedir,
    }
    const muchos = await enviarEmail(
      { ...mensaje, adjuntos: Array.from({ length: 6 }, () => adjuntoIcs) },
      dependencias,
    )
    const pesado = await enviarEmail(
      {
        ...mensaje,
        adjuntos: [
          { ...adjuntoIcs, contenido: Buffer.alloc(5 * 1024 * 1024 + 1).toString('base64') },
        ],
      },
      dependencias,
    )
    expect(muchos).toMatchObject({ ok: false, error: { codigo: 'validacion' } })
    expect(pesado).toMatchObject({ ok: false, error: { codigo: 'validacion' } })
    expect(llamadas).toEqual([])
  })

  it('programarEmail también valida los adjuntos', async () => {
    const { pedir, llamadas } = pedidoSimulado(Response.json({ id: 'x' }))
    const r = await programarEmail(
      { ...mensaje, adjuntos: [{ ...adjuntoIcs, nombre: '../x' }] },
      '2026-11-05T14:00:00-04:00',
      { entorno: entorno({ EMAIL_PROVEEDOR: 'resend', RESEND_API_KEY: 're_x' }), pedir },
    )
    expect(r).toMatchObject({ ok: false, error: { codigo: 'validacion' } })
    expect(llamadas).toEqual([])
  })
})
