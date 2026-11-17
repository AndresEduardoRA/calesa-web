// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { fallo, ok, type Resultado } from '@/shared/lib/errores'
import type { Conteos, LatidoNuevo, PuertosDeLaTarea } from '../entities/tarea-diaria'
import { correrTareaDiaria } from './tarea-diaria'

const SECRETO = 'ana@correo.com en relation "solicitudes"'
type Medida = { bytesDeBase: number; correosDelDia: number }
type Vuelta = Resultado<{ conteos: Conteos; quedanMas: boolean }>

// Puertos falsos que anotan cada llamada; la retención responde las vueltas en orden y, si se acaban, repite la última.
function puertos(
  opciones: {
    vueltas?: Vuelta[]
    correos?: () => Promise<Resultado<Conteos>>
    medida?: () => Promise<Resultado<Medida>>
    latido?: Resultado<null>
  } = {},
) {
  const llamadas: string[] = []
  const latidos: LatidoNuevo[] = []
  const vueltas = opciones.vueltas ?? [ok({ conteos: { solicitudes: 2 }, quedanMas: false })]
  let vuelta = 0
  const p: PuertosDeLaTarea = {
    retencion: () => {
      llamadas.push('retencion')
      if (llamadas.length > 10) {
        return Promise.reject(new Error('guardia: la retención no para'))
      }
      return Promise.resolve(vueltas[Math.min(vuelta++, vueltas.length - 1)] as Vuelta)
    },
    ponerAlDiaLosCorreos: () => {
      llamadas.push('correos')
      return opciones.correos ? opciones.correos() : Promise.resolve(ok({ reintentados: 1 }))
    },
    medirCupos: () => {
      llamadas.push('cupos')
      return opciones.medida
        ? opciones.medida()
        : Promise.resolve(ok({ bytesDeBase: 10, correosDelDia: 3 }))
    },
    registrarLatido: (latido) => {
      llamadas.push('latido')
      latidos.push(latido)
      return Promise.resolve(opciones.latido ?? ok(null))
    },
  }
  return { p, llamadas, latidos }
}

const conMas = (n: number): Vuelta =>
  ok({ conteos: { solicitudes: n, eventos: 1 }, quedanMas: true })
const sinMas = (n: number): Vuelta =>
  ok({ conteos: { solicitudes: n, eventos: 1 }, quedanMas: false })

let errores: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  errores = vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => {
  errores.mockRestore()
})

describe('correrTareaDiaria · orden y retención', () => {
  it('corre retención → correos → cupos y después escribe un latido', async () => {
    const { p, llamadas, latidos } = puertos()
    const resumen = await correrTareaDiaria(p)
    expect(llamadas).toEqual(['retencion', 'correos', 'cupos', 'latido'])
    expect(latidos).toEqual([{ ok: true, error: null, cupos: [] }])
    expect(resumen.ok).toBe(true)
    expect(resumen.latido).toEqual({ ok: true })
  })

  it('vuelve a llamar a la retención mientras quedan más, y suma los conteos', async () => {
    const { p, llamadas } = puertos({ vueltas: [conMas(3), conMas(4), conMas(5), sinMas(1)] })
    const resumen = await correrTareaDiaria(p)
    expect(llamadas.filter((l) => l === 'retencion')).toHaveLength(4)
    expect(resumen.pasos.retencion).toEqual({
      ok: true,
      conteos: { solicitudes: 13, eventos: 4 },
      quedanMas: false,
    })
  })

  it('para a las 5 vueltas y deja quedanMas para la próxima corrida', async () => {
    const { p, llamadas } = puertos({ vueltas: [conMas(1)] })
    const resumen = await correrTareaDiaria(p)
    expect(llamadas.filter((l) => l === 'retencion')).toHaveLength(5)
    expect(resumen.pasos.retencion).toMatchObject({ ok: true, quedanMas: true })
    expect(resumen.ok).toBe(true)
  })

  it('una vuelta que falla corta el bucle con su código', async () => {
    const { p, llamadas } = puertos({
      vueltas: [conMas(1), fallo('sin_permiso', SECRETO), sinMas(1)],
    })
    const resumen = await correrTareaDiaria(p)
    expect(llamadas.filter((l) => l === 'retencion')).toHaveLength(2)
    expect(resumen.pasos.retencion).toEqual({ ok: false, codigo: 'sin_permiso' })
    expect(resumen.ok).toBe(false)
  })
})

describe('correrTareaDiaria · un paso que falla no detiene a los demás', () => {
  it('con los correos en ko y los cupos lanzando, corre todo y el latido lo dice', async () => {
    const { p, llamadas, latidos } = puertos({
      correos: () => Promise.resolve(fallo('inesperado', SECRETO)),
      medida: () => Promise.reject(new Error(SECRETO)),
    })
    const resumen = await correrTareaDiaria(p)
    expect(llamadas).toEqual(['retencion', 'correos', 'cupos', 'latido'])
    expect(latidos).toEqual([
      { ok: false, error: 'correos: inesperado; cupos: inesperado', cupos: null },
    ])
    expect(resumen.pasos.correos).toEqual({ ok: false, codigo: 'inesperado' })
    expect(resumen.pasos.cupos).toEqual({ ok: false, codigo: 'inesperado' })
    expect(resumen.ok).toBe(false)
  })

  it('la retención que lanza tampoco detiene a los demás', async () => {
    const { p, llamadas } = puertos({ vueltas: [] })
    p.retencion = () => {
      llamadas.push('retencion')
      return Promise.reject(new Error(SECRETO))
    }
    const resumen = await correrTareaDiaria(p)
    expect(llamadas).toEqual(['retencion', 'correos', 'cupos', 'latido'])
    expect(resumen.pasos.retencion).toEqual({ ok: false, codigo: 'inesperado' })
  })

  it('ningún log lleva el mensaje del error', async () => {
    const { p } = puertos({
      vueltas: [fallo('regla', SECRETO)],
      correos: () => Promise.reject(new Error(SECRETO)),
      latido: fallo('inesperado', SECRETO),
    })
    await correrTareaDiaria(p)
    const logs = errores.mock.calls.map((c: unknown[]) => c.map(String).join(' '))
    expect(logs.length).toBeGreaterThan(0)
    for (const log of logs) {
      expect(log).toMatch(/^tarea diaria (retencion|correos|cupos|latido): [a-z_]+$/)
    }
  })
})

describe('correrTareaDiaria · cupos y latido', () => {
  it('si medir falla, los cupos quedan «no medido» (null), nunca []', async () => {
    const { p, latidos } = puertos({ medida: () => Promise.resolve(fallo('inesperado', SECRETO)) })
    await correrTareaDiaria(p)
    expect(latidos[0]?.cupos).toBeNull()
  })

  it('evalúa los cupos con lo medido', async () => {
    const { p, latidos } = puertos({
      medida: () => Promise.resolve(ok({ bytesDeBase: 400_000_001, correosDelDia: 80 })),
    })
    const resumen = await correrTareaDiaria(p)
    expect(latidos[0]?.cupos).toEqual(['base'])
    expect(resumen.pasos.cupos).toEqual({
      ok: true,
      conteos: { bytesDeBase: 400_000_001, correosDelDia: 80 },
      cupos: ['base'],
    })
  })

  it('el latido que falla deja el total en ko, con su código', async () => {
    const { p } = puertos({ latido: fallo('inesperado', SECRETO) })
    const resumen = await correrTareaDiaria(p)
    expect(resumen.latido).toEqual({ ok: false, codigo: 'inesperado' })
    expect(resumen.ok).toBe(false)
    expect(JSON.stringify(resumen)).not.toContain('ana@correo.com')
  })
})
