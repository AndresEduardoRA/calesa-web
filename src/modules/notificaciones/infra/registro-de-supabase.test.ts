// @vitest-environment node
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'

import type { ClienteSupabase } from '@/shared/lib/supabase/server'
import { CASOS_DEL_REGISTRO } from './casos-del-registro.soporte'
import { clienteSobreMemoria } from './cliente-de-correos.soporte'
import { registroDeSupabase, type ClienteDeCorreos } from './registro-de-supabase'

const ID = '00000000-0000-4000-8000-000000000001'
const REUNION = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b'
const SOLICITUD = '7a9d0e2c-1b3f-4c5d-8e6a-0f1b2c3d4e5f'

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ClienteDeCorreos', () => {
  it('el cliente de Supabase del proyecto entra sin cast', () => {
    expectTypeOf<ClienteSupabase>().toExtend<ClienteDeCorreos>()
  })
})

describe('registroDeSupabase corre la tabla de casos del registro', () => {
  it.each(CASOS_DEL_REGISTRO)('$nombre', async (caso) => {
    const { rpc } = clienteSobreMemoria()
    expect(await caso.correr(registroDeSupabase({ rpc }))).toEqual(caso.esperado)
    if (caso.registra) expect(console.error).toHaveBeenCalledExactlyOnceWith(caso.registra)
    else expect(console.error).not.toHaveBeenCalled()
  })
})

describe('los argumentos de cada RPC', () => {
  const llamada = async (usar: (r: ReturnType<typeof registroDeSupabase>) => Promise<unknown>) => {
    const { rpc } = clienteSobreMemoria()
    await usar(registroDeSupabase({ rpc }))
    return rpc
  }

  it('porReferencia y porId', async () => {
    const rpc = await llamada(async (r) => {
      await r.porReferencia('a:1')
      await r.porId(ID)
    })
    expect(rpc).toHaveBeenNthCalledWith(1, 'correo_por_referencia', { p_referencia: 'a:1' })
    expect(rpc).toHaveBeenNthCalledWith(2, 'correo_por_id', { p_id: ID })
  })

  it('registrar manda los cinco obligatorios y omite los opcionales nulos', async () => {
    const rpc = await llamada((r) =>
      r.registrar({
        para: 'ana@ejemplo.com',
        plantilla: 'recordatorio-24h',
        datos: { a: 1, b: undefined },
        adjuntoIcs: null,
        estado: 'programado',
        resendId: null,
        programadoPara: '2026-11-05T14:00:00.000Z',
        intentos: 0,
        ultimoError: null,
        enviadoEn: null,
        referencia: 'a:1',
        reunionId: REUNION,
        solicitudId: null,
      }),
    )
    expect(rpc).toHaveBeenCalledExactlyOnceWith('registrar_correo', {
      p_para: 'ana@ejemplo.com',
      p_plantilla: 'recordatorio-24h',
      p_datos: { a: 1 },
      p_estado: 'programado',
      p_intentos: 0,
      p_programado_para: '2026-11-05T14:00:00.000Z',
      p_referencia: 'a:1',
      p_reunion_id: REUNION,
    })
  })

  it('marcarEnviado: p_resend_id sólo si no es null', async () => {
    const enviadoEn = '2026-11-05T14:00:00.000Z'
    const rpc = await llamada(async (r) => {
      await r.marcarEnviado(ID, { resendId: 're_1', intentos: 2, enviadoEn })
      await r.marcarEnviado(ID, { resendId: null, intentos: 1, enviadoEn })
    })
    expect(rpc).toHaveBeenNthCalledWith(1, 'marcar_correo_enviado', {
      p_id: ID,
      p_intentos: 2,
      p_enviado_en: enviadoEn,
      p_resend_id: 're_1',
    })
    expect(rpc).toHaveBeenNthCalledWith(2, 'marcar_correo_enviado', {
      p_id: ID,
      p_intentos: 1,
      p_enviado_en: enviadoEn,
    })
  })
})

describe('los argumentos de las marcas y las listas', () => {
  const llamada = async (usar: (r: ReturnType<typeof registroDeSupabase>) => Promise<unknown>) => {
    const { rpc } = clienteSobreMemoria()
    await usar(registroDeSupabase({ rpc }))
    return rpc
  }

  it('marcarFallido y marcarCancelado', async () => {
    const rpc = await llamada(async (r) => {
      await r.marcarFallido(ID, { intentos: 3, ultimoError: 'sin red' })
      await r.marcarCancelado(ID)
    })
    expect(rpc).toHaveBeenNthCalledWith(1, 'marcar_correo_fallido', {
      p_id: ID,
      p_intentos: 3,
      p_ultimo_error: 'sin red',
    })
    expect(rpc).toHaveBeenNthCalledWith(2, 'marcar_correo_cancelado', { p_id: ID })
  })

  it('marcarReprogramado tiene tres formas', async () => {
    const hora = '2026-11-05T18:00:00.000Z'
    const rpc = await llamada(async (r) => {
      await r.marcarReprogramado(ID, hora)
      await r.marcarReprogramado(ID, hora, null)
      await r.marcarReprogramado(ID, hora, 're_2')
    })
    const base = { p_id: ID, p_programado_para: hora }
    expect(rpc).toHaveBeenNthCalledWith(1, 'marcar_correo_reprogramado', base)
    expect(rpc).toHaveBeenNthCalledWith(2, 'marcar_correo_reprogramado', {
      ...base,
      p_cambiar_resend_id: true,
    })
    expect(rpc).toHaveBeenNthCalledWith(3, 'marcar_correo_reprogramado', {
      ...base,
      p_resend_id: 're_2',
      p_cambiar_resend_id: true,
    })
  })

  it('programadosDe y vencidos', async () => {
    const rpc = await llamada(async (r) => {
      await r.programadosDe({ reunionId: REUNION }, 50)
      await r.programadosDe({ solicitudId: SOLICITUD }, 20)
      await r.vencidos('2026-11-05T14:00:00.000Z', 50)
    })
    expect(rpc).toHaveBeenNthCalledWith(1, 'correos_programados_de', {
      p_reunion_id: REUNION,
      p_tope: 50,
    })
    expect(rpc).toHaveBeenNthCalledWith(2, 'correos_programados_de', {
      p_solicitud_id: SOLICITUD,
      p_tope: 20,
    })
    expect(rpc).toHaveBeenNthCalledWith(3, 'correos_vencidos', {
      p_ahora: '2026-11-05T14:00:00.000Z',
      p_tope: 50,
    })
  })

  it('un id que no es guid no llama a la base', async () => {
    const { rpc } = clienteSobreMemoria()
    const r = registroDeSupabase({ rpc })
    expect(await r.porId('x')).toEqual({ ok: true, data: null })
    expect((await r.marcarCancelado('x')).ok).toBe(false)
    expect(await r.programadosDe({ reunionId: 'x' }, 5)).toEqual({ ok: true, data: [] })
    expect(await r.programadosDe({ solicitudId: 'x' }, 5)).toEqual({ ok: true, data: [] })
    expect(rpc).not.toHaveBeenCalled()
  })
})
