// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { momentosDeRecordatorio } from '@/modules/notificaciones'
import { fallo, ok } from '@/shared/lib/errores'
import {
  TEXTO_LIMITE,
  TEXTO_TOKEN_VENCIDO,
  firmarTokenDeSolicitud,
  hashDeTokenDeGestion,
  type ContarEnvio,
} from '@/shared/lib/seguridad'
import { crearContadorEnMemoria } from '@/shared/lib/seguridad/contador-en-memoria.soporte'
import { V1 } from '../../entities/ejemplos.soporte'
import {
  ENTORNO,
  REUNION,
  SITIO,
  SOLICITUD,
  TOKEN_GESTION,
  correosFalsos,
  resumen,
  rpcFalsa,
} from '../pruebas.soporte'
import { reservar } from './reservar'

const AHORA = new Date('2026-11-02T12:00:00Z')
const INICIO = '2026-11-03T14:00:00.000Z'

function tokenDeSolicitud(emitidoEn = AHORA): string {
  const firmado = firmarTokenDeSolicitud(SOLICITUD, { entorno: ENTORNO, emitidoEn })
  if (!firmado.ok) {
    throw new Error('no se pudo firmar el token de prueba')
  }
  return firmado.data.token
}

function preparar(
  opciones: {
    respuesta?: { data: unknown; error: { code: string; message: string } | null }
    contar?: ContarEnvio
    falla?: 'fallo' | 'excepcion'
  } = {},
) {
  const base = rpcFalsa({
    reservar_reunion: opciones.respuesta ?? { data: resumen(), error: null },
  })
  const correo = correosFalsos(() => opciones.falla ?? null)
  const deps = {
    llamar: base.llamar,
    contar: opciones.contar ?? crearContadorEnMemoria(() => AHORA),
    correos: correo.correos,
    momentos: momentosDeRecordatorio,
    ip: '203.0.113.7',
    ahora: () => AHORA,
    sitio: SITIO,
    entorno: ENTORNO,
  }
  return { deps, llamadas: base.llamadas, pedidos: correo.pedidos }
}

const entrada = (t: string) => ({ t, inicio: INICIO, zona: 'America/Bogota' })

afterEach(() => {
  vi.restoreAllMocks()
})

describe('reservar (C8): las defensas, antes de la base', () => {
  it('con el límite de la IP agotado no lee el token, no llama a la base ni manda correos', async () => {
    const { deps, llamadas, pedidos } = preparar({ contar: () => Promise.resolve(ok(false)) })
    const r = await reservar(entrada('no-es-un-token'), deps)
    expect(r).toEqual({ ok: false, error: { codigo: 'regla', mensaje: TEXTO_LIMITE } })
    expect(llamadas).toEqual([])
    expect(pedidos).toEqual([])
  })

  it('si el contador falla, falla cerrado', async () => {
    const { deps, llamadas } = preparar({ contar: () => Promise.resolve(fallo('inesperado', 'x')) })
    const r = await reservar(entrada(tokenDeSolicitud()), deps)
    expect(r.ok === false && r.error.codigo).toBe('inesperado')
    expect(llamadas).toEqual([])
  })

  it('con el token de solicitud vencido no llama a la base', async () => {
    const { deps, llamadas } = preparar()
    const r = await reservar(entrada(tokenDeSolicitud(new Date('2026-11-02T09:00:00Z'))), deps)
    expect(r.ok === false && r.error.mensaje).toBe(TEXTO_TOKEN_VENCIDO)
    expect(llamadas).toEqual([])
  })
})

describe('reservar (C8): la reserva', () => {
  it('devuelve sólo la reunión, el anfitrión y el enlace de gestión del token nuevo', async () => {
    const { deps, llamadas } = preparar()
    const r = await reservar(entrada(tokenDeSolicitud()), deps)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const datos = resumen()
    expect(r.data).toEqual({
      reunion: {
        id: REUNION,
        inicio: datos.reunion.inicio,
        fin: datos.reunion.fin,
        zonaVisitante: 'America/Bogota',
        enlaceMeet: 'https://meet.google.com/abc-defg-hij',
        actualizadoEn: datos.reunion.actualizadoEn,
      },
      anfitrion: { nombre: 'Ana Rojas', whatsapp: '+59170000001' },
      enlaceGestion: expect.stringMatching(
        /^https:\/\/calesa\.test\/reunion\/[A-Za-z0-9_-]{43}$/,
      ) as unknown,
    })
    expect(JSON.stringify(r.data)).not.toContain(V1)
    const token = r.data.enlaceGestion.split('/').pop() ?? ''
    expect(llamadas[0]?.args).toMatchObject({
      p_solicitud_id: SOLICITUD,
      p_token_hash: hashDeTokenDeGestion(token),
    })
  })

  it('volver a reservar con el token de gestión manda su hash como anterior y un hash nuevo distinto', async () => {
    const { deps, llamadas } = preparar()
    await reservar(entrada(TOKEN_GESTION), deps)
    const args = llamadas[0]?.args ?? {}
    expect(args['p_solicitud_id']).toBeNull()
    expect(args['p_token_anterior']).toBe(hashDeTokenDeGestion(TOKEN_GESTION))
    expect(args['p_token_hash']).toMatch(/^\\x[0-9a-f]{64}$/)
    expect(args['p_token_hash']).not.toBe(args['p_token_anterior'])
  })

  it('una hora ocupada (E1) es una regla y no manda correos', async () => {
    const texto = 'Esa hora se acaba de ocupar. Elige otra.'
    const { deps, pedidos } = preparar({
      respuesta: { data: null, error: { code: 'P0001', message: texto } },
    })
    expect(await reservar(entrada(tokenDeSolicitud()), deps)).toEqual({
      ok: false,
      error: { codigo: 'regla', mensaje: texto },
    })
    expect(pedidos).toEqual([])
  })

  it('manda los correos de la reserva, y uno que falla o lanza no cambia el resultado', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    for (const falla of ['fallo', 'excepcion'] as const) {
      const { deps, pedidos } = preparar({ falla })
      const r = await reservar(entrada(tokenDeSolicitud()), deps)
      expect(r.ok).toBe(true)
      expect(pedidos[0]).toEqual({ metodo: 'cancelarDeSolicitud', id: SOLICITUD })
      expect(pedidos).toHaveLength(6)
    }
  })
})
