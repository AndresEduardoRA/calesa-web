import { describe, expect, it, vi } from 'vitest'

import { crearAdaptadorResend } from './resend-api'

// Rutas, cuerpos y respuestas copiados de la documentación de Resend (send-email, update-email, cancel-email, errors e
// idempotency-keys, consultadas el 2026-10-31; las URL están en docs/pasos/P01/decisiones.md). La documentación no muestra el cuerpo
// de un error: se arma con su `name` y su `message` documentados.
const ID = '49a3999c-0ce1-4ea6-ab68-afcd6dc2e794'
const CLAVE = 're_prueba_clave'
const CUANDO = '2026-08-05T11:52:01.858Z'
const mensaje = {
  para: 'ana@ejemplo.com',
  asunto: 'Tu demo',
  html: '<p>Hola</p>',
  texto: 'Hola',
  etiquetas: { tipo: 'recordatorio', version: 'v1.2' },
}
const remitente = { email: 'hola@getcalesa.com', nombre: 'Calesa' }

type Llamada = { url: string; metodo?: string; cabeceras: unknown; cuerpo: unknown }

function pedidoSimulado(respuesta: Response | Error) {
  const llamadas: Llamada[] = []
  const pedir = vi.fn((url: string | URL | Request, init?: RequestInit) => {
    llamadas.push({
      url: String(url),
      metodo: init?.method,
      cabeceras: init?.headers,
      cuerpo: init?.body === undefined ? undefined : (JSON.parse(String(init.body)) as unknown),
    })
    return respuesta instanceof Error ? Promise.reject(respuesta) : Promise.resolve(respuesta)
  }) as unknown as typeof fetch
  return { pedir, llamadas }
}

const errorDeResend = (status: number, name: string, message: string) =>
  Response.json({ statusCode: status, name, message }, { status })

const cuerpoDeEnvio = {
  from: 'Calesa <hola@getcalesa.com>',
  to: ['ana@ejemplo.com'],
  subject: 'Tu demo',
  html: '<p>Hola</p>',
  text: 'Hola',
  tags: [
    { name: 'tipo', value: 'recordatorio' },
    { name: 'version', value: 'v1_2' },
  ],
}

describe('el adaptador de Resend (contrato con su API)', () => {
  it('enviar: POST /emails con la clave, sin Idempotency-Key si no hay referencia, y devuelve el id', async () => {
    const { pedir, llamadas } = pedidoSimulado(Response.json({ id: ID }))
    const r = await crearAdaptadorResend(CLAVE, pedir).enviar(mensaje, remitente)
    expect(r).toEqual({ ok: true, data: { id: ID } })
    expect(llamadas).toEqual([
      {
        url: 'https://api.resend.com/emails',
        metodo: 'POST',
        cabeceras: { Authorization: `Bearer ${CLAVE}`, 'Content-Type': 'application/json' },
        cuerpo: cuerpoDeEnvio,
      },
    ])
  })

  it('programar: lo mismo con scheduled_at y la referencia como Idempotency-Key', async () => {
    const { pedir, llamadas } = pedidoSimulado(Response.json({ id: ID }))
    const r = await crearAdaptadorResend(CLAVE, pedir).programar(
      { ...mensaje, referencia: 'recordatorio24:9f1c' },
      remitente,
      CUANDO,
    )
    expect(r).toEqual({ ok: true, data: { id: ID } })
    expect(llamadas).toEqual([
      {
        url: 'https://api.resend.com/emails',
        metodo: 'POST',
        cabeceras: {
          Authorization: `Bearer ${CLAVE}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': 'recordatorio24:9f1c',
        },
        cuerpo: { ...cuerpoDeEnvio, scheduled_at: CUANDO },
      },
    ])
  })

  it('cancelar: POST /emails/{id}/cancel sin cuerpo', async () => {
    const { pedir, llamadas } = pedidoSimulado(Response.json({ object: 'email', id: ID }))
    const r = await crearAdaptadorResend(CLAVE, pedir).cancelar(ID)
    expect(r).toEqual({ ok: true, data: { id: ID } })
    expect(llamadas).toEqual([
      {
        url: `https://api.resend.com/emails/${ID}/cancel`,
        metodo: 'POST',
        cabeceras: { Authorization: `Bearer ${CLAVE}` },
        cuerpo: undefined,
      },
    ])
  })

  it('reprogramar: PATCH /emails/{id} con scheduled_at y sin Idempotency-Key', async () => {
    const { pedir, llamadas } = pedidoSimulado(Response.json({ object: 'email', id: ID }))
    const r = await crearAdaptadorResend(CLAVE, pedir).reprogramar(ID, CUANDO)
    expect(r).toEqual({ ok: true, data: { id: ID } })
    expect(llamadas).toEqual([
      {
        url: `https://api.resend.com/emails/${ID}`,
        metodo: 'PATCH',
        cabeceras: { Authorization: `Bearer ${CLAVE}`, 'Content-Type': 'application/json' },
        cuerpo: { scheduled_at: CUANDO },
      },
    ])
  })
})

describe('el adaptador de Resend: cuerpo y referencia', () => {
  it('sin etiquetas no manda tags; el nombre del remitente pierde < > y comillas', async () => {
    const { pedir, llamadas } = pedidoSimulado(Response.json({ id: ID }))
    await crearAdaptadorResend(CLAVE, pedir).enviar(
      { para: ['a@b.co', 'c@d.co'], asunto: 'X', html: '<p>X</p>', texto: 'X' },
      { email: 'hola@getcalesa.com', nombre: 'Calesa "Ventas" <equipo>' },
    )
    expect(llamadas[0]?.cuerpo).toEqual({
      from: 'Calesa Ventas equipo <hola@getcalesa.com>',
      to: ['a@b.co', 'c@d.co'],
      subject: 'X',
      html: '<p>X</p>',
      text: 'X',
    })
  })

  it('la misma referencia con el mismo cuerpo: Resend devuelve el id original y es un éxito', async () => {
    const { pedir } = pedidoSimulado(Response.json({ id: ID }))
    const r = await crearAdaptadorResend(CLAVE, pedir).enviar(
      { ...mensaje, referencia: 'bienvenida/123' },
      remitente,
    )
    expect(r).toEqual({ ok: true, data: { id: ID } })
  })
})

// Cada status de la tabla de errores de Resend, con un `name` documentado.
// prettier-ignore
const ERRORES: [number, string, string, string, string][] = [
  [400, 'validation_error', 'An error was found with one or more fields in the request.', 'validacion', 'Resend no aceptó el correo (400 validation_error).'],
  [400, 'invalid_idempotency_key', 'Idempotency keys, if present, must have between 1 and 256 characters.', 'validacion', 'Resend no aceptó el correo (400 invalid_idempotency_key).'],
  [422, 'missing_required_field', 'The request body is missing one or more required fields.', 'validacion', 'Resend no aceptó el correo (422 missing_required_field).'],
  [401, 'missing_api_key', 'Missing API Key', 'inesperado', 'Resend rechazó la clave (401 missing_api_key).'],
  [401, 'restricted_api_key', 'This API key is restricted to only send emails.', 'inesperado', 'Resend rechazó la clave (401 restricted_api_key).'],
  [403, 'validation_error', 'The `getcalesa.com` domain is not verified. Please, add and verify your domain.', 'inesperado', 'Resend no lo permite (403 validation_error): revisa la clave y el dominio.'],
  [404, 'not_found', 'The requested endpoint does not exist.', 'no_encontrado', 'Resend no encuentra ese correo.'],
  [409, 'invalid_idempotent_request', "the request body was modified and doesn't match the original request.", 'conflicto', 'Resend no lo hizo: choca con otro pedido con la misma referencia o sobre el mismo correo (409 invalid_idempotent_request).'],
  [409, 'concurrent_idempotent_requests', 'There is another request in progress with the same idempotency key.', 'conflicto', 'Resend no lo hizo: choca con otro pedido con la misma referencia o sobre el mismo correo (409 concurrent_idempotent_requests).'],
  [409, 'resource_locked', 'Another request is already updating this resource.', 'conflicto', 'Resend no lo hizo: choca con otro pedido con la misma referencia o sobre el mismo correo (409 resource_locked).'],
  [429, 'daily_quota_exceeded', 'You have exceeded your daily email sending quota.', 'inesperado', 'Resend no acepta más correos por ahora (429 daily_quota_exceeded).'],
  [429, 'monthly_quota_exceeded', 'You have exceeded your monthly email sending quota.', 'inesperado', 'Resend no acepta más correos por ahora (429 monthly_quota_exceeded).'],
  [429, 'rate_limit_exceeded', 'Too many requests. Please limit the number of requests per second.', 'inesperado', 'Resend no acepta más correos por ahora (429 rate_limit_exceeded).'],
  [405, 'method_not_allowed', 'Method is not allowed for the requested path.', 'inesperado', 'El correo no salió: Resend respondió 405 method_not_allowed.'],
  [500, 'application_error', 'An unexpected error occurred.', 'inesperado', 'El correo no salió: Resend respondió 500 application_error.'],
  [503, 'service_unavailable', 'API is temporarily unavailable', 'inesperado', 'El correo no salió: Resend respondió 503 service_unavailable.'],
]

const CASOS = ERRORES.map(([status, name, message, codigo, esperado]) => ({
  status,
  name,
  message,
  codigo,
  esperado,
}))

describe('los errores de Resend son valores, sin la clave ni el cuerpo', () => {
  it.each(CASOS)('$status $name', async ({ status, name, message, codigo, esperado }) => {
    const { pedir } = pedidoSimulado(errorDeResend(status, name, message))
    const r = await crearAdaptadorResend(CLAVE, pedir).enviar(mensaje, remitente)
    expect(r).toEqual({ ok: false, error: { codigo, mensaje: esperado } })
  })

  it('sin red dice que Resend no respondió', async () => {
    const r = await crearAdaptadorResend(
      CLAVE,
      pedidoSimulado(new Error('ECONNREFUSED')).pedir,
    ).cancelar(ID)
    expect(r).toEqual({
      ok: false,
      error: { codigo: 'inesperado', mensaje: 'El correo no salió: Resend no respondió.' },
    })
  })

  it('un 2xx sin id es un error', async () => {
    const r = await crearAdaptadorResend(CLAVE, pedidoSimulado(Response.json({})).pedir).enviar(
      mensaje,
      remitente,
    )
    expect(r).toEqual({
      ok: false,
      error: { codigo: 'inesperado', mensaje: 'Resend no devolvió el id del correo.' },
    })
  })

  it('nunca copia el message, un name que no es un código, ni la clave', async () => {
    const respuestas = [
      errorDeResend(
        422,
        'missing_required_field',
        `Falta el campo para ana@ejemplo.com (${CLAVE})`,
      ),
      errorDeResend(403, 'ana@ejemplo.com', 'ana@ejemplo.com'),
      new Response('texto plano con ana@ejemplo.com', { status: 422 }),
    ]
    const mensajes: string[] = []
    for (const respuesta of respuestas) {
      const r = await crearAdaptadorResend(CLAVE, pedidoSimulado(respuesta).pedir).enviar(
        mensaje,
        remitente,
      )
      mensajes.push(r.ok ? '' : r.error.mensaje)
    }
    expect(mensajes).toEqual([
      'Resend no aceptó el correo (422 missing_required_field).',
      'Resend no lo permite (403): revisa la clave y el dominio.',
      'Resend no aceptó el correo (422).',
    ])
    for (const m of mensajes) {
      expect(m).not.toContain('ana@ejemplo.com')
      expect(m).not.toContain(CLAVE)
    }
  })
})

describe('el adaptador de Resend con adjuntos (attachments de send-email)', () => {
  const ics = 'BEGIN:VCALENDAR\r\nMETHOD:CANCEL\r\nEND:VCALENDAR\r\n'
  const adjunto = {
    nombre: 'demo.ics',
    tipo: 'text/calendar; method=CANCEL',
    contenido: Buffer.from(ics).toString('base64'),
  }
  const esperado = [
    {
      filename: 'demo.ics',
      content: Buffer.from(ics).toString('base64'),
      content_type: 'text/calendar; method=CANCEL',
    },
  ]

  it('enviar manda attachments con filename, content en base64 y content_type', async () => {
    const { pedir, llamadas } = pedidoSimulado(Response.json({ id: ID }))
    await crearAdaptadorResend(CLAVE, pedir).enviar({ ...mensaje, adjuntos: [adjunto] }, remitente)
    expect(llamadas[0]?.cuerpo).toEqual({ ...cuerpoDeEnvio, attachments: esperado })
  })

  it('programar manda lo mismo, con scheduled_at', async () => {
    const { pedir, llamadas } = pedidoSimulado(Response.json({ id: ID }))
    await crearAdaptadorResend(CLAVE, pedir).programar(
      { ...mensaje, adjuntos: [adjunto] },
      remitente,
      CUANDO,
    )
    expect(llamadas[0]?.cuerpo).toEqual({
      ...cuerpoDeEnvio,
      attachments: esperado,
      scheduled_at: CUANDO,
    })
  })

  it('sin adjuntos (o con la lista vacía) el cuerpo no lleva attachments', async () => {
    const { pedir, llamadas } = pedidoSimulado(Response.json({ id: ID }))
    const adaptador = crearAdaptadorResend(CLAVE, pedir)
    await adaptador.enviar(mensaje, remitente)
    await adaptador.enviar({ ...mensaje, adjuntos: [] }, remitente)
    expect(llamadas[0]?.cuerpo).not.toHaveProperty('attachments')
    expect(llamadas[1]?.cuerpo).not.toHaveProperty('attachments')
  })
})
