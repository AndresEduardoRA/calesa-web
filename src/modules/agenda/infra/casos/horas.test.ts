// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { firmarTokenDeSolicitud, hashDeTokenDeGestion } from '@/shared/lib/seguridad'
import { CONFIG_INICIAL } from '../../entities/ejemplos.soporte'
import { esZonaValida } from '../../entities/zona'
import {
  ENTORNO,
  SOLICITUD,
  TOKEN_GESTION,
  datosParaHoras,
  reunionDelToken,
  rpcFalsa,
} from '../pruebas.soporte'
import { horasParaSemana } from './horas'

// `ahora` de la base en `datosParaHoras()`: lun 2 nov 2026 08:00 en La Paz.
const AHORA = new Date('2026-11-02T12:00:00Z')

function tokenDeSolicitud(): string {
  const firmado = firmarTokenDeSolicitud(SOLICITUD, { entorno: ENTORNO, emitidoEn: AHORA })
  if (!firmado.ok) {
    throw new Error('no se pudo firmar el token de prueba')
  }
  return firmado.data.token
}

const conBase = (datos: unknown) => rpcFalsa({ datos_para_horas: { data: datos, error: null } })
const deps = (llamar: ReturnType<typeof rpcFalsa>['llamar']) => ({
  llamar,
  ahora: () => AHORA,
  entorno: ENTORNO,
})

describe('horasParaSemana (C7): qué token lee qué', () => {
  it('con un token de solicitud lee por la solicitud y devuelve la semana agrupada por día', async () => {
    const { llamar, llamadas } = conBase(datosParaHoras())
    const r = await horasParaSemana(
      { t: tokenDeSolicitud(), semana: '2026-11-04', zona: 'America/La_Paz' },
      deps(llamar),
    )
    expect(llamadas).toEqual([
      { fn: 'datos_para_horas', args: { p_solicitud_id: SOLICITUD, p_token_hash: null } },
    ])
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data).toMatchObject({
      zona: 'America/La_Paz',
      desde: '2026-11-02',
      hasta: '2026-11-08',
      haySiguiente: true,
      vacio: null,
    })
    // Con 12 h de anticipación la primera hora es el martes; L–V con 14 inicios por día (B11).
    expect(r.data.dias.map((d) => [d.dia, d.horas.length])).toEqual([
      ['2026-11-03', 14],
      ['2026-11-04', 14],
      ['2026-11-05', 14],
      ['2026-11-06', 14],
    ])
    expect(r.data.dias[0]?.horas[0]).toEqual({ inicio: '2026-11-03T13:00:00.000Z', hora: '09:00' })
  })

  it('con un token de gestión lee por su hash', async () => {
    const { llamar, llamadas } = conBase(datosParaHoras({ reunion: reunionDelToken() }))
    const r = await horasParaSemana(
      { t: TOKEN_GESTION, semana: '2026-11-04', zona: 'Europe/Madrid' },
      deps(llamar),
    )
    expect(r.ok).toBe(true)
    expect(llamadas).toEqual([
      {
        fn: 'datos_para_horas',
        args: { p_solicitud_id: null, p_token_hash: hashDeTokenDeGestion(TOKEN_GESTION) },
      },
    ])
  })
})

describe('horasParaSemana (C7): la entrada', () => {
  it('una zona que Intl acepta pero la base no (sin «Región/Ciudad») se rechaza sin ir a la base', async () => {
    expect(esZonaValida('GMT')).toBe(true)
    const { llamar, llamadas } = conBase(datosParaHoras())
    const r = await horasParaSemana(
      { t: TOKEN_GESTION, semana: '2026-11-04', zona: 'GMT' },
      deps(llamar),
    )
    expect(r).toEqual({
      ok: false,
      error: { codigo: 'validacion', mensaje: 'Elige una zona horaria válida.' },
    })
    expect(llamadas).toEqual([])
  })

  it('una semana que no es una fecha real se rechaza sin ir a la base', async () => {
    const { llamar, llamadas } = conBase(datosParaHoras())
    const r = await horasParaSemana(
      { t: TOKEN_GESTION, semana: '2026-02-30', zona: 'America/La_Paz' },
      deps(llamar),
    )
    expect(r.ok === false && r.error.codigo).toBe('validacion')
    expect(llamadas).toEqual([])
  })
})

describe('horasParaSemana (C7): el peso de la respuesta', () => {
  it('con un horario de 7 × 24 la semana trae 336 horas agrupadas por día y pesa menos de 20 KB', async () => {
    const todoElDia = [1, 2, 3, 4, 5, 6, 7].map((diaSemana) => ({
      diaSemana,
      desde: '00:00',
      hasta: '23:59',
    }))
    const config = {
      ...CONFIG_INICIAL,
      duracionMin: 15,
      descansoMin: 0,
      anticipacionMinHoras: 0,
      maxReunionesDia: 12,
    }
    const { llamar } = conBase(datosParaHoras({ config, horarioBase: todoElDia }))
    const zona = 'America/Argentina/Buenos_Aires'
    const r = await horasParaSemana({ t: TOKEN_GESTION, semana: '2026-11-11', zona }, deps(llamar))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.dias).toHaveLength(7)
    expect(r.data.dias.flatMap((d) => d.horas)).toHaveLength(336)
    expect(Object.keys(r.data.dias[0]?.horas[0] ?? {})).toEqual(['inicio', 'hora'])
    expect(new TextEncoder().encode(JSON.stringify(r.data)).length).toBeLessThanOrEqual(20_000)
  })
})
