// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type { EntornoDelServidor } from '../../config/servidor'
import { TEXTO_TURNSTILE } from './textos'
import { verificarTurnstile } from './turnstile'

const SECRETO = '1x0000000000000000000000000000000AA'
const TOKEN = 'XXXX.DUMMY.TOKEN.XXXX'
const entorno = (extra: Partial<EntornoDelServidor>): EntornoDelServidor =>
  ({ SUPABASE_SECRET_KEY: 's', EMAIL_PROVEEDOR: 'ninguno', ...extra }) as EntornoDelServidor
const conSecreto = entorno({ TURNSTILE_SECRET_KEY: SECRETO })

function siteverify(respuesta: Response | Error) {
  const llamadas: { url: string; cuerpo: Record<string, string>; conTope: boolean }[] = []
  const pedir = vi.fn((url: string | URL | Request, init?: RequestInit) => {
    const cuerpo = Object.fromEntries(new URLSearchParams(init?.body as URLSearchParams))
    llamadas.push({ url: String(url), cuerpo, conTope: init?.signal instanceof AbortSignal })
    return respuesta instanceof Error ? Promise.reject(respuesta) : Promise.resolve(respuesta)
  }) as unknown as typeof fetch
  return { pedir, llamadas }
}

const rechazo = (...codigos: string[]) => Response.json({ success: false, 'error-codes': codigos })

describe('verificarTurnstile: lo que manda', () => {
  it('con success: true da ok y hace el POST de siteverify con secret, response y remoteip', async () => {
    const { pedir, llamadas } = siteverify(Response.json({ success: true, 'error-codes': [] }))
    const r = await verificarTurnstile(TOKEN, { ip: '203.0.113.7', entorno: conSecreto, pedir })
    expect(r).toEqual({ ok: true, data: null })
    expect(llamadas).toEqual([
      {
        url: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        cuerpo: { secret: SECRETO, response: TOKEN, remoteip: '203.0.113.7' },
        conTope: true,
      },
    ])
  })

  it('corta el pedido a siteverify a los 5 s', async () => {
    const tope = vi.spyOn(AbortSignal, 'timeout')
    const { pedir } = siteverify(Response.json({ success: true }))
    await verificarTurnstile(TOKEN, { entorno: conSecreto, pedir })
    expect(tope).toHaveBeenCalledWith(5000)
    tope.mockRestore()
  })

  it('manda una IPv6 completa como remoteip, nunca su /64', async () => {
    const { pedir, llamadas } = siteverify(Response.json({ success: true }))
    await verificarTurnstile(TOKEN, { ip: '2001:db8:a:b::4', entorno: conSecreto, pedir })
    expect(llamadas[0]?.cuerpo['remoteip']).toBe('2001:db8:a:b::4')
  })

  it.each([
    ['sin IP', undefined],
    ['con la IP desconocida', 'desconocida'],
  ])('%s no manda remoteip', async (_caso, ip) => {
    const { pedir, llamadas } = siteverify(Response.json({ success: true }))
    await verificarTurnstile(TOKEN, { ...(ip && { ip }), entorno: conSecreto, pedir })
    expect(llamadas[0]?.cuerpo).toEqual({ secret: SECRETO, response: TOKEN })
  })
})

describe('verificarTurnstile: lo que responde', () => {
  it.each([['invalid-input-response'], ['timeout-or-duplicate']])(
    'con success: false (%s) da validacion con el texto de Turnstile',
    async (codigo) => {
      const { pedir } = siteverify(rechazo(codigo))
      expect(await verificarTurnstile(TOKEN, { entorno: conSecreto, pedir })).toEqual({
        ok: false,
        error: { codigo: 'validacion', mensaje: TEXTO_TURNSTILE },
      })
    },
  )

  it.each([['invalid-input-secret'], ['missing-input-secret']])(
    'con un error del secreto (%s) da inesperado',
    async (codigo) => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const { pedir } = siteverify(rechazo(codigo))
      const r = await verificarTurnstile(TOKEN, { entorno: conSecreto, pedir })
      expect(r).toMatchObject({ ok: false, error: { codigo: 'inesperado' } })
    },
  )

  it.each([
    ['un 500', new Response('caído', { status: 500 })],
    ['un JSON inválido', new Response('<html>', { status: 200 })],
    ['un JSON sin success', Response.json({ ok: true })],
    ['un pedido que se corta', new DOMException('corte', 'AbortError')],
    ['la red caída', new TypeError('fetch failed')],
  ])('falla cerrado con %s: inesperado', async (_caso, respuesta) => {
    const { pedir } = siteverify(respuesta)
    expect(await verificarTurnstile(TOKEN, { entorno: conSecreto, pedir })).toMatchObject({
      ok: false,
      error: { codigo: 'inesperado' },
    })
  })
})

describe('verificarTurnstile: sin red', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([
    ['vacío', ''],
    ['de 2049 caracteres', 'x'.repeat(2049)],
  ])('un token %s da validacion sin llamar a siteverify', async (_caso, token) => {
    const { pedir } = siteverify(Response.json({ success: true }))
    const r = await verificarTurnstile(token, { entorno: conSecreto, pedir })
    expect(r).toMatchObject({ ok: false, error: { codigo: 'validacion' } })
    expect(pedir).not.toHaveBeenCalled()
  })

  it('sin TURNSTILE_SECRET_KEY falla cerrado: inesperado y sin llamar a siteverify', async () => {
    const { pedir } = siteverify(Response.json({ success: true }))
    const r = await verificarTurnstile(TOKEN, { entorno: entorno({}), pedir })
    expect(r).toMatchObject({ ok: false, error: { codigo: 'inesperado' } })
    expect(pedir).not.toHaveBeenCalled()
  })

  it('no registra nunca el token ni el secreto', async () => {
    const espias = (['log', 'info', 'warn', 'error'] as const).map((nivel) =>
      vi.spyOn(console, nivel).mockImplementation(() => undefined),
    )
    for (const respuesta of [rechazo('invalid-input-secret'), new Response('', { status: 500 })]) {
      await verificarTurnstile(TOKEN, { entorno: conSecreto, pedir: siteverify(respuesta).pedir })
    }
    const escrito = JSON.stringify(espias.flatMap((espia) => espia.mock.calls))
    expect(escrito).not.toContain(TOKEN)
    expect(escrito).not.toContain(SECRETO)
  })
})
