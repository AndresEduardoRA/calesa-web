// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type { EntornoDelServidor } from '../../config/servidor'
import { fallo, ok } from '../errores'
import { crearContadorEnMemoria } from './contador-en-memoria.soporte'
import { claveDeLimite, LIMITES, limitar, VENTANA_SEGUNDOS, type ContarEnvio } from './limites'
import { TEXTO_LIMITE } from './textos'

const SAL = 'sal-de-prueba-para-las-ip-0123456789abcdef'
const entorno = (extra: Partial<EntornoDelServidor>): EntornoDelServidor =>
  ({ SUPABASE_SECRET_KEY: 's', EMAIL_PROVEEDOR: 'ninguno', ...extra }) as EntornoDelServidor
const conSal = { entorno: entorno({ IP_SAL_SECRETO: SAL }) }
const permite = (valor: boolean): ContarEnvio => vi.fn(() => Promise.resolve(ok(valor)))

describe('LIMITES', () => {
  it('son los de la semilla (C7, F8): por hora y por acción', () => {
    expect(LIMITES).toEqual({ formulario: 5, detalle: 5, reservas: 10, whatsapp: 30, eventos: 60 })
    expect(VENTANA_SEGUNDOS).toBe(3600)
  })
})

describe('claveDeLimite', () => {
  it('es la acción y el sha256 de la IP con la sal: nunca la IP en claro', () => {
    const clave = claveDeLimite('formulario', '203.0.113.7', SAL)
    expect(clave).toMatch(/^formulario:[0-9a-f]{64}$/)
    expect(clave).not.toContain('203.0.113.7')
    expect(clave.length).toBeLessThanOrEqual(200)
    expect(claveDeLimite('formulario', '203.0.113.7', `${SAL}x`)).not.toBe(clave)
    expect(claveDeLimite('detalle', '203.0.113.7', SAL)).not.toBe(clave)
  })

  it('cuenta dos IPv6 de la misma /64 con la misma clave, y una de otra /64 aparte', () => {
    const una = claveDeLimite('reservas', '2001:db8:a:b::4', SAL)
    expect(claveDeLimite('reservas', '2001:db8:a:b::9', SAL)).toBe(una)
    expect(claveDeLimite('reservas', '2001:db8:a:c::4', SAL)).not.toBe(una)
  })
})

describe('limitar', () => {
  it('pide al contador la clave, el máximo de la acción y la ventana', async () => {
    const contar = permite(true)
    await limitar('reservas', '203.0.113.7', contar, conSal)
    expect(contar).toHaveBeenCalledWith({
      clave: claveDeLimite('reservas', '203.0.113.7', SAL),
      maximo: 10,
      ventanaSegundos: 3600,
    })
  })

  it('permitido → ok; no permitido → regla con el texto del límite', async () => {
    expect(await limitar('formulario', '203.0.113.7', permite(true), conSal)).toEqual(ok(null))
    expect(await limitar('formulario', '203.0.113.7', permite(false), conSal)).toEqual({
      ok: false,
      error: { codigo: 'regla', mensaje: TEXTO_LIMITE },
    })
  })

  it('falla cerrado: un error del contador se devuelve tal cual, y si lanza da inesperado', async () => {
    const conError: ContarEnvio = () => Promise.resolve(fallo('inesperado', 'la base no respondió'))
    expect(await limitar('eventos', '203.0.113.7', conError, conSal)).toEqual(
      fallo('inesperado', 'la base no respondió'),
    )
    const lanza: ContarEnvio = () => Promise.reject(new Error('caída'))
    expect(await limitar('eventos', '203.0.113.7', lanza, conSal)).toMatchObject({
      ok: false,
      error: { codigo: 'inesperado' },
    })
  })

  it('sin IP_SAL_SECRETO da inesperado y no llama al contador', async () => {
    const contar = permite(true)
    const r = await limitar('formulario', '203.0.113.7', contar, { entorno: entorno({}) })
    expect(r).toMatchObject({ ok: false, error: { codigo: 'inesperado' } })
    expect(contar).not.toHaveBeenCalled()
  })
})

describe('limitar con el contador en memoria', () => {
  const contarHasta = async (accion: keyof typeof LIMITES, veces: number, contar: ContarEnvio) => {
    const resultados = []
    for (let i = 0; i < veces; i++)
      resultados.push(await limitar(accion, '198.51.100.1', contar, conSal))
    return resultados
  }

  it('5 envíos de formulario pasan y el 6.º da regla; detalle y otra IP siguen', async () => {
    const contar = crearContadorEnMemoria(() => new Date('2026-11-03T10:00:00Z'))
    const resultados = await contarHasta('formulario', 6, contar)
    expect(resultados.slice(0, 5).every((r) => r.ok)).toBe(true)
    expect(resultados[5]).toEqual({ ok: false, error: { codigo: 'regla', mensaje: TEXTO_LIMITE } })
    expect(await limitar('detalle', '198.51.100.1', contar, conSal)).toEqual(ok(null))
    expect(await limitar('formulario', '198.51.100.2', contar, conSal)).toEqual(ok(null))
  })

  it.each([
    ['reservas', 10],
    ['whatsapp', 30],
    ['eventos', 60],
  ] as const)('%s deja pasar %i y frena el siguiente', async (accion, maximo) => {
    const contar = crearContadorEnMemoria(() => new Date('2026-11-03T10:00:00Z'))
    const resultados = await contarHasta(accion, maximo + 1, contar)
    expect(resultados.slice(0, maximo).every((r) => r.ok)).toBe(true)
    expect(resultados[maximo]).toMatchObject({ ok: false, error: { codigo: 'regla' } })
  })
})
