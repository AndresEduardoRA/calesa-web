// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type { EntornoDelServidor } from '@/shared/config/servidor'
import { verificarSecretoDelCron } from '@/shared/lib/seguridad'
import { manejarCron } from './manejador'

const SECRETO = 'secreto-del-cron-de-prueba-0123456789'
const entorno = (extra: Partial<EntornoDelServidor>): EntornoDelServidor =>
  ({ SUPABASE_SECRET_KEY: 's', EMAIL_PROVEEDOR: 'ninguno', ...extra }) as EntornoDelServidor
// El entorno entra literal: la prueba no depende del caché de `entornoDelServidor()`.
const conSecreto = (a: string | null) =>
  verificarSecretoDelCron(a, { entorno: entorno({ CRON_SECRET: SECRETO }) })
const sinSecreto = (a: string | null) => verificarSecretoDelCron(a, { entorno: entorno({}) })

const pedido = (autorizacion?: string) =>
  new Request('http://localhost/api/cron/diario', {
    headers: autorizacion ? { authorization: autorizacion } : {},
  })
const RESUMEN_OK = { ok: true, pasos: { retencion: { ok: true } } }

let errores: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  errores = vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => {
  errores.mockRestore()
})

describe('manejarCron · el secreto', () => {
  it.each([
    ['sin cabecera', undefined, conSecreto],
    ['con otro secreto', 'Bearer otro', conSecreto],
    ['sin CRON_SECRET configurado', `Bearer ${SECRETO}`, sinSecreto],
  ])('%s → 401 y no corre', async (_caso, autorizacion, verificar) => {
    const correr = vi.fn(() => Promise.resolve(RESUMEN_OK))
    const respuesta = await manejarCron(pedido(autorizacion), { correr, verificar })
    expect(respuesta.status).toBe(401)
    expect(await respuesta.json()).toEqual({ ok: false })
    expect(correr).not.toHaveBeenCalled()
  })

  it('si verificar lanza (entorno inválido) → 500, sin correr y con un log sin mensaje', async () => {
    const correr = vi.fn(() => Promise.resolve(RESUMEN_OK))
    const verificar = () => {
      throw new Error('CRON_SECRET: falta en ana@correo.com')
    }
    const respuesta = await manejarCron(pedido(`Bearer ${SECRETO}`), { correr, verificar })
    expect(respuesta.status).toBe(500)
    expect(await respuesta.json()).toEqual({ ok: false })
    expect(correr).not.toHaveBeenCalled()
    expect(errores.mock.calls).toEqual([['tarea diaria: entorno']])
  })
})

describe('manejarCron · la corrida', () => {
  it('con el secreto corre y responde 200 con el resumen', async () => {
    const correr = vi.fn(() => Promise.resolve(RESUMEN_OK))
    const respuesta = await manejarCron(pedido(`Bearer ${SECRETO}`), {
      correr,
      verificar: conSecreto,
    })
    expect(respuesta.status).toBe(200)
    expect(await respuesta.json()).toEqual({ ok: true, resumen: RESUMEN_OK })
    expect(correr).toHaveBeenCalledTimes(1)
    expect(respuesta.headers.get('cache-control')).toBe('no-store')
  })

  it('un resumen en ko responde 500 con el resumen, para que quede en los logs', async () => {
    const resumen = { ok: false, pasos: { correos: { ok: false, codigo: 'inesperado' } } }
    const respuesta = await manejarCron(pedido(`Bearer ${SECRETO}`), {
      correr: () => Promise.resolve(resumen),
      verificar: conSecreto,
    })
    expect(respuesta.status).toBe(500)
    expect(await respuesta.json()).toEqual({ ok: false, resumen })
  })

  it('si correr lanza → 500 y un log sin mensaje', async () => {
    const respuesta = await manejarCron(pedido(`Bearer ${SECRETO}`), {
      correr: () => Promise.reject(new Error('ana@correo.com')),
      verificar: conSecreto,
    })
    expect(respuesta.status).toBe(500)
    expect(await respuesta.json()).toEqual({ ok: false })
    expect(respuesta.headers.get('cache-control')).toBe('no-store')
    expect(errores.mock.calls).toEqual([['tarea diaria: inesperado']])
  })
})
