// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { momentosDeRecordatorio } from '@/modules/notificaciones'
import { ok } from '@/shared/lib/errores'
import { TEXTO_LIMITE, firmarTokenDeSolicitud, type ContarEnvio } from '@/shared/lib/seguridad'
import { crearContadorEnMemoria } from '@/shared/lib/seguridad/contador-en-memoria.soporte'
import {
  ENTORNO,
  REUNION,
  SITIO,
  SOLICITUD,
  TOKEN_GESTION,
  correosFalsos,
  datosParaHoras,
  resumen,
  reunionDelToken,
  rpcFalsa,
} from '../pruebas.soporte'
import { cambiarReunion, cancelarReunion, leerReunion } from './gestionar'

const AHORA = new Date('2026-11-02T12:00:00Z')
const VERSION = reunionDelToken().actualizadoEn
const NUEVO_INICIO = '2026-11-04T14:00:00.000Z'
const E7 = 'Esta demo o solicitud cambió mientras la mirabas. Recarga para ver lo último.'

type Respuesta = { data: unknown; error: { code: string; message: string } | null }

function preparar(
  respuestas: { datos?: Respuesta; cambiar?: Respuesta; cancelar?: Respuesta } = {},
  contar?: ContarEnvio,
) {
  const base = rpcFalsa({
    datos_para_horas: respuestas.datos ?? {
      data: datosParaHoras({ reunion: reunionDelToken() }),
      error: null,
    },
    cambiar_reunion: respuestas.cambiar ?? {
      data: resumen({ reunion: { inicio: NUEVO_INICIO } }),
      error: null,
    },
    cancelar_reunion: respuestas.cancelar ?? {
      data: resumen({ reunion: { estado: 'cancelada' } }),
      error: null,
    },
  })
  const correo = correosFalsos()
  const deps = {
    llamar: base.llamar,
    contar: contar ?? crearContadorEnMemoria(() => AHORA),
    correos: correo.correos,
    momentos: momentosDeRecordatorio,
    ip: '203.0.113.7',
    ahora: () => AHORA,
    sitio: SITIO,
    entorno: ENTORNO,
  }
  return { deps, llamadas: base.llamadas, pedidos: correo.pedidos }
}

const conReunion = (cambios: Record<string, unknown>, ahora = '2026-11-02T12:00:00+00:00') => ({
  datos: { data: datosParaHoras({ ahora, reunion: reunionDelToken(cambios) }), error: null },
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('leerReunion (C9)', () => {
  it('devuelve la reunión, el anfitrión y el estado de la gestión; nada más', async () => {
    const { deps, llamadas } = preparar()
    const r = await leerReunion({ t: TOKEN_GESTION }, deps)
    const reunion = reunionDelToken()
    expect(r).toEqual({
      ok: true,
      data: {
        reunion: {
          id: REUNION,
          inicio: reunion.inicio,
          fin: reunion.fin,
          zonaVisitante: 'America/Bogota',
          enlaceMeet: reunion.enlaceMeet,
          estado: 'confirmada',
          actualizadoEn: VERSION,
        },
        anfitrion: { nombre: 'Ana Rojas', whatsapp: '+59170000001' },
        gestion: { estado: 'cambiable', texto: null },
      },
    })
    expect(llamadas.map((l) => l.fn)).toEqual(['datos_para_horas'])
  })

  it('cada estado de la gestión con el reloj de la base', async () => {
    const casos = [
      [conReunion({}, '2026-11-03T12:00:00.001+00:00'), 'fuera_de_plazo'],
      [conReunion({ estado: 'cancelada', puedeVolverAReservar: true }), 'puede_volver_a_reservar'],
      [conReunion({ estado: 'realizada' }), 'cerrada'],
    ] as const
    for (const [respuestas, estado] of casos) {
      const r = await leerReunion({ t: TOKEN_GESTION }, preparar(respuestas).deps)
      expect(r.ok && r.data.gestion.estado).toBe(estado)
    }
  })

  it('un token de solicitud o una respuesta sin reunión: «Este enlace no es válido.»', async () => {
    const firmado = firmarTokenDeSolicitud(SOLICITUD, { entorno: ENTORNO, emitidoEn: AHORA })
    const { deps, llamadas } = preparar()
    const r = await leerReunion({ t: firmado.ok ? firmado.data.token : '' }, deps)
    expect(r).toEqual({
      ok: false,
      error: { codigo: 'regla', mensaje: 'Este enlace no es válido.' },
    })
    expect(llamadas).toEqual([])
    const sinReunion = await leerReunion(
      { t: TOKEN_GESTION },
      preparar({ datos: { data: datosParaHoras(), error: null } }).deps,
    )
    expect(sinReunion.ok === false && sinReunion.error.mensaje).toBe('Este enlace no es válido.')
  })
})

describe('cambiarReunion (C9)', () => {
  it('con una versión vieja es un conflicto, sin llamar a cambiar_reunion', async () => {
    const { deps, llamadas, pedidos } = preparar()
    const r = await cambiarReunion(
      { t: TOKEN_GESTION, inicio: NUEVO_INICIO, actualizadoEn: '2026-11-01T00:00:00Z' },
      deps,
    )
    expect(r).toEqual({ ok: false, error: { codigo: 'conflicto', mensaje: E7 } })
    expect(llamadas.map((l) => l.fn)).toEqual(['datos_para_horas'])
    expect(pedidos).toEqual([])
  })

  it('fuera de plazo (E6) es una regla', async () => {
    const texto = 'Ya no se puede cambiar en línea. Escríbenos por WhatsApp.'
    const { deps } = preparar({ cambiar: { data: null, error: { code: 'P0001', message: texto } } })
    const r = await cambiarReunion(
      { t: TOKEN_GESTION, inicio: NUEVO_INICIO, actualizadoEn: VERSION },
      deps,
    )
    expect(r).toEqual({ ok: false, error: { codigo: 'regla', mensaje: texto } })
  })

  it('cuenta en el límite de reservas de la IP; cancelar no', async () => {
    const agotado: ContarEnvio = () => Promise.resolve(ok(false))
    const cambio = preparar({}, agotado)
    const r = await cambiarReunion(
      { t: TOKEN_GESTION, inicio: NUEVO_INICIO, actualizadoEn: VERSION },
      cambio.deps,
    )
    expect(r).toEqual({ ok: false, error: { codigo: 'regla', mensaje: TEXTO_LIMITE } })
    expect(cambio.llamadas).toEqual([])
    const cancelacion = preparar({}, agotado)
    expect(
      (await cancelarReunion({ t: TOKEN_GESTION, actualizadoEn: VERSION }, cancelacion.deps)).ok,
    ).toBe(true)
  })

  it('cambia con la versión recibida, avisa con la hora anterior leída y devuelve el mismo enlace', async () => {
    const { deps, llamadas, pedidos } = preparar()
    const r = await cambiarReunion(
      { t: TOKEN_GESTION, inicio: NUEVO_INICIO, actualizadoEn: VERSION },
      deps,
    )
    expect(llamadas[1]).toMatchObject({
      fn: 'cambiar_reunion',
      args: { p_inicio: NUEVO_INICIO, p_actualizado_en_esperado: VERSION },
    })
    expect(r.ok && r.data.enlaceGestion).toBe(`${SITIO}/reunion/${TOKEN_GESTION}`)
    expect(r.ok && r.data.reunion.inicio).toBe(NUEVO_INICIO)
    expect(pedidos[0]).toEqual({ metodo: 'cancelarDeReunion', id: REUNION })
    expect(pedidos[1]).toMatchObject({
      datos: { plantilla: 'reunion-cambiada', inicioAnterior: reunionDelToken().inicio },
    })
  })
})

describe('cancelarReunion (C9)', () => {
  it('cancela con la versión recibida y avisa', async () => {
    const { deps, llamadas, pedidos } = preparar()
    const r = await cancelarReunion({ t: TOKEN_GESTION, actualizadoEn: VERSION }, deps)
    expect(r).toEqual({ ok: true, data: { reunionId: REUNION, estado: 'cancelada' } })
    expect(llamadas.map((l) => l.fn)).toEqual(['cancelar_reunion'])
    expect(pedidos.map((p) => p.metodo)).toEqual([
      'cancelarDeReunion',
      'enviarAhora',
      'enviarAhora',
      'enviarAhora',
    ])
  })
})

describe('las entradas de la gestión (C9)', () => {
  it('sin token, con un token vacío o con una versión que no es ISO, no van a la base', async () => {
    const { deps, llamadas } = preparar()
    const enlace = {
      ok: false,
      error: { codigo: 'validacion', mensaje: 'Este enlace no es válido.' },
    }
    expect(await leerReunion({}, deps)).toEqual(enlace)
    expect(await cancelarReunion({ t: '', actualizadoEn: VERSION }, deps)).toEqual(enlace)
    const cambio = await cambiarReunion(
      { t: TOKEN_GESTION, inicio: NUEVO_INICIO, actualizadoEn: 'ayer' },
      deps,
    )
    expect(cambio).toEqual({
      ok: false,
      error: { codigo: 'validacion', mensaje: 'Elige una hora válida.' },
    })
    expect(llamadas).toEqual([])
  })
})
