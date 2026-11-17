// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MENSAJE_INESPERADO } from '@/shared/lib/errores'
import { clienteQueResponde, type RespuestaDeRpc } from './cliente-de-correos.soporte'
import { registroDeSupabase } from './registro-de-supabase'

const ID = '00000000-0000-4000-8000-000000000001'
const FILA = {
  id: ID,
  para: 'ana@ejemplo.com',
  plantilla: 'recordatorio-24h',
  datos: { a: 1 },
  adjuntoIcs: null,
  estado: 'programado',
  resendId: null,
  programadoPara: '2026-11-05T14:00:00+00:00',
  intentos: 0,
  ultimoError: null,
  enviadoEn: null,
  referencia: 'a:1',
  reunionId: null,
  solicitudId: null,
}
const INESPERADO = { ok: false, error: { codigo: 'inesperado', mensaje: MENSAJE_INESPERADO } }
const NUEVA = {
  ...FILA,
  id: undefined,
  programadoPara: '2026-11-05T14:00:00.000Z',
}
const registro = (r: RespuestaDeRpc | (() => PromiseLike<RespuestaDeRpc>)) =>
  registroDeSupabase(clienteQueResponde(r))
const buena = { data: FILA, error: null }

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('la respuesta (C3)', () => {
  it('normaliza las fechas con zona a `toISOString()`', async () => {
    const r = await registro(buena).porId(ID)
    expect(r.ok && r.data?.programadoPara).toBe('2026-11-05T14:00:00.000Z')
    const conOffset = {
      data: { ...FILA, programadoPara: '2026-11-05T10:00:00-04:00' },
      error: null,
    }
    const o = await registro(conOffset).porId(ID)
    expect(o.ok && o.data?.programadoPara).toBe('2026-11-05T14:00:00.000Z')
  })

  it('el `null` de la base: ok(null) en las lecturas, `no_encontrado` en las marcas, error en registrar y las listas', async () => {
    const r = registro({ data: null, error: null })
    expect(await r.porReferencia('a')).toEqual({ ok: true, data: null })
    expect(await r.porId(ID)).toEqual({ ok: true, data: null })
    for (const marca of [
      r.marcarCancelado(ID),
      r.marcarFallido(ID, { intentos: 1, ultimoError: 'x' }),
      r.marcarEnviado(ID, { resendId: null, intentos: 1, enviadoEn: FILA.programadoPara }),
      r.marcarReprogramado(ID, FILA.programadoPara),
    ])
      expect(await marca).toEqual({
        ok: false,
        error: { codigo: 'no_encontrado', mensaje: 'No se encontró el correo.' },
      })
    expect(await r.registrar(NUEVA as never)).toEqual(INESPERADO)
    expect(await r.vencidos(FILA.programadoPara, 5)).toEqual(INESPERADO)
    expect(await r.programadosDe({ reunionId: ID }, 5)).toEqual(INESPERADO)
  })

  it.each([
    ['falta una clave', { ...FILA, referencia: undefined }],
    ['estado desconocido', { ...FILA, estado: 'pendiente' }],
    ['fecha sin zona', { ...FILA, programadoPara: '2026-11-05T14:00:00' }],
    ['intentos negativos', { ...FILA, intentos: -1 }],
    ['id que no es guid', { ...FILA, id: 'x' }],
  ])('%s → inesperado, motivo `respuesta`', async (_nombre, data) => {
    expect(await registro({ data, error: null }).porId(ID)).toEqual(INESPERADO)
    expect(console.error).toHaveBeenCalledExactlyOnceWith('notificaciones: correo_por_id respuesta')
  })

  it('un elemento malo en una lista tumba la lista; una clave de más se ignora', async () => {
    const mala = registro({ data: [FILA, { ...FILA, estado: 'x' }], error: null })
    expect(await mala.vencidos(FILA.programadoPara, 5)).toEqual(INESPERADO)
    const extra = registro({
      data: [{ ...FILA, creadoEn: '2026-01-01T00:00:00+00:00' }],
      error: null,
    })
    const r = await extra.vencidos(FILA.programadoPara, 5)
    expect(r.ok && r.data[0]).not.toHaveProperty('creadoEn')
  })
})

describe('los errores (C4, C5)', () => {
  it('`23505` es duplicado, `22023` y `P0001` son regla con el texto de la RPC; los dos esperados no se registran', async () => {
    const duplicado = {
      code: '23505',
      message: 'Ya existe un correo con esa referencia.',
      hint: 'p_referencia',
    }
    const transicion = { code: 'P0001', message: 'Un correo enviado no pasa a fallido.' }
    const a = await registro({ data: null, error: duplicado }).registrar(NUEVA as never)
    const b = await registro({ data: null, error: transicion }).marcarCancelado(ID)
    expect(a).toEqual({ ok: false, error: { codigo: 'duplicado', mensaje: duplicado.message } })
    expect(b).toEqual({ ok: false, error: { codigo: 'regla', mensaje: transicion.message } })
    expect(console.error).not.toHaveBeenCalled()
  })

  it('`22023` registra el parámetro en `hint`, sin el texto', async () => {
    const error = { code: '22023', message: 'Un dato del correo no es válido.', hint: 'p_estado' }
    const r = await registro({ data: null, error }).registrar(NUEVA as never)
    expect(!r.ok && r.error).toEqual({ codigo: 'regla', mensaje: error.message })
    expect(console.error).toHaveBeenCalledExactlyOnceWith(
      'notificaciones: registrar_correo 22023 hint=p_estado',
    )
  })

  it('un permiso que falta (`42501`) no enseña el texto técnico', async () => {
    const error = { code: '42501', message: 'permission denied for function correo_por_referencia' }
    const r = await registro({ data: null, error }).porReferencia('a:1')
    expect(!r.ok && r.error.codigo).toBe('sin_permiso')
    expect(!r.ok && r.error.mensaje).toBe('No se pudo leer ni escribir el registro de correos.')
    expect(JSON.stringify(r)).not.toContain('permission denied')
    expect(console.error).toHaveBeenCalledExactlyOnceWith(
      'notificaciones: correo_por_referencia 42501',
    )
  })

  it('otro código, o sin código, es inesperado y sólo el código llega al registro', async () => {
    const r = await registro({
      data: null,
      error: { code: '23503', message: 'viola la relación x' },
    }).porId(ID)
    expect(r).toEqual(INESPERADO)
    const sin = await registro({ data: null, error: { message: 'secreto de la base' } }).porId(ID)
    expect(!sin.ok && sin.error.codigo).toBe('inesperado')
    expect(console.error).toHaveBeenNthCalledWith(1, 'notificaciones: correo_por_id 23503')
    expect(console.error).toHaveBeenNthCalledWith(2, 'notificaciones: correo_por_id sin-codigo')
  })

  it('un `rpc` que lanza o rechaza es inesperado, motivo `excepcion`', async () => {
    const lanza = registro(() => {
      throw new Error('boom con datos de ana@ejemplo.com')
    })
    const rechaza = registro(() => Promise.reject(new Error('no')))
    expect(await lanza.porId(ID)).toEqual(INESPERADO)
    expect(await rechaza.porId(ID)).toEqual(INESPERADO)
    expect(console.error).toHaveBeenCalledTimes(2)
    expect(console.error).toHaveBeenCalledWith('notificaciones: correo_por_id excepcion')
  })

  it('un ok no registra nada', async () => {
    await registro(buena).porId(ID)
    expect(console.error).not.toHaveBeenCalled()
  })
})

describe('los datos (C6)', () => {
  it('un `BigInt` no es JSON: `validacion`, sin llamar a la base', async () => {
    const cliente = clienteQueResponde(buena)
    const r = await registroDeSupabase(cliente).registrar({ ...NUEVA, datos: { n: 1n } } as never)
    expect(r).toEqual({
      ok: false,
      error: { codigo: 'validacion', mensaje: 'Los datos del correo no se pueden guardar.' },
    })
    expect(cliente.rpc).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalledExactlyOnceWith('notificaciones: registrar_correo datos')
  })
})
