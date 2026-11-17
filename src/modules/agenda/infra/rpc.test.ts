// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MENSAJE_INESPERADO, MENSAJE_SIN_RESPUESTA } from '@/shared/lib/errores'
import { cambiarEnLaBase, cancelarEnLaBase, leerDatosParaHoras, reservarEnLaBase } from './rpc'
import { REUNION, SOLICITUD, datosParaHoras, resumen, rpcFalsa } from './pruebas.soporte'

const HASH = `\\x${'ab'.repeat(32)}`
const HASH_NUEVO = `\\x${'cd'.repeat(32)}`
const INICIO = '2026-11-03T14:00:00.000Z'
const VERSION = '2026-11-02T12:00:00.123456+00:00'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('las llamadas a las RPC (C1): argumentos exactos, el que no va en null', () => {
  it('datos_para_horas con un token de solicitud o con uno de gestión', async () => {
    const { llamar, llamadas } = rpcFalsa({
      datos_para_horas: { data: datosParaHoras(), error: null },
    })
    await leerDatosParaHoras(llamar, { tipo: 'solicitud', solicitudId: SOLICITUD })
    await leerDatosParaHoras(llamar, { tipo: 'gestion', hash: HASH })
    expect(llamadas).toEqual([
      { fn: 'datos_para_horas', args: { p_solicitud_id: SOLICITUD, p_token_hash: null } },
      { fn: 'datos_para_horas', args: { p_solicitud_id: null, p_token_hash: HASH } },
    ])
  })

  it('reservar_reunion con la solicitud, o con el hash del token anterior al volver a reservar', async () => {
    const { llamar, llamadas } = rpcFalsa({ reservar_reunion: { data: resumen(), error: null } })
    const pedido = { inicio: INICIO, zona: 'America/Bogota', tokenHash: HASH_NUEVO }
    await reservarEnLaBase(llamar, {
      ...pedido,
      token: { tipo: 'solicitud', solicitudId: SOLICITUD },
    })
    await reservarEnLaBase(llamar, { ...pedido, token: { tipo: 'gestion', hash: HASH } })
    const comun = { p_inicio: INICIO, p_zona_visitante: 'America/Bogota', p_token_hash: HASH_NUEVO }
    expect(llamadas).toEqual([
      {
        fn: 'reservar_reunion',
        args: { p_solicitud_id: SOLICITUD, p_token_anterior: null, ...comun },
      },
      { fn: 'reservar_reunion', args: { p_solicitud_id: null, p_token_anterior: HASH, ...comun } },
    ])
  })

  it('cambiar_reunion y cancelar_reunion con el hash y la versión esperada', async () => {
    const { llamar, llamadas } = rpcFalsa({
      cambiar_reunion: { data: resumen(), error: null },
      cancelar_reunion: { data: resumen({ reunion: { estado: 'cancelada' } }), error: null },
    })
    await cambiarEnLaBase(llamar, { hash: HASH, inicio: INICIO, actualizadoEn: VERSION })
    await cancelarEnLaBase(llamar, { hash: HASH, actualizadoEn: VERSION })
    expect(llamadas).toEqual([
      {
        fn: 'cambiar_reunion',
        args: { p_token_hash: HASH, p_inicio: INICIO, p_actualizado_en_esperado: VERSION },
      },
      { fn: 'cancelar_reunion', args: { p_token_hash: HASH, p_actualizado_en_esperado: VERSION } },
    ])
  })

  it('devuelve la respuesta validada', async () => {
    const { llamar } = rpcFalsa({ cancelar_reunion: { data: resumen(), error: null } })
    const r = await cancelarEnLaBase(llamar, { hash: HASH, actualizadoEn: VERSION })
    expect(r.ok && r.data.reunion.id).toBe(REUNION)
  })
})

describe('los errores de las RPC (C2, C3)', () => {
  const cancelarCon = (
    error: { code?: string | null; message: string } | null,
    data: unknown = null,
  ) =>
    cancelarEnLaBase(rpcFalsa({ cancelar_reunion: { data, error } }).llamar, {
      hash: HASH,
      actualizadoEn: VERSION,
    })

  it('P0001: una regla con el texto de la RPC', async () => {
    const r = await cancelarCon({
      code: 'P0001',
      message: 'Ya no se puede cambiar en línea. Escríbenos por WhatsApp.',
    })
    expect(r).toEqual({
      ok: false,
      error: {
        codigo: 'regla',
        mensaje: 'Ya no se puede cambiar en línea. Escríbenos por WhatsApp.',
      },
    })
  })

  it('PT409: un conflicto con el texto de la RPC', async () => {
    const texto = 'Esta demo o solicitud cambió mientras la mirabas. Recarga para ver lo último.'
    expect(await cancelarCon({ code: 'PT409', message: texto })).toEqual({
      ok: false,
      error: { codigo: 'conflicto', mensaje: texto },
    })
  })

  it('22023, 42501 u otro código: inesperado, y se registra sólo la función y el código', async () => {
    const registro = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    for (const code of ['22023', '42501', 'XX000']) {
      const r = await cancelarCon({ code, message: `detalle con ${HASH}` })
      expect(r).toEqual({ ok: false, error: { codigo: 'inesperado', mensaje: MENSAJE_INESPERADO } })
    }
    expect(registro.mock.calls).toEqual([
      ['agenda: cancelar_reunion 22023'],
      ['agenda: cancelar_reunion 42501'],
      ['agenda: cancelar_reunion XX000'],
    ])
  })

  it('sin código y con el texto de un fetch que falló: el error de transporte', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const r = await cancelarCon({ code: null, message: 'TypeError: fetch failed' })
    expect(r).toEqual({
      ok: false,
      error: { codigo: 'inesperado', mensaje: MENSAJE_SIN_RESPUESTA },
    })
  })

  it('una respuesta que no valida o una llamada que lanza: inesperado, sin el hash en el registro', async () => {
    const registro = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const invalida = await cancelarCon(null, { reunion: { id: 'x' } })
    expect(invalida).toEqual({
      ok: false,
      error: { codigo: 'inesperado', mensaje: MENSAJE_INESPERADO },
    })
    const lanza = await cancelarEnLaBase(() => Promise.reject(new Error(HASH)), {
      hash: HASH,
      actualizadoEn: VERSION,
    })
    expect(lanza.ok).toBe(false)
    const registrado = JSON.stringify(registro.mock.calls)
    expect(registrado).not.toContain('ab'.repeat(32))
    expect(registrado).toContain('agenda: cancelar_reunion')
  })
})
