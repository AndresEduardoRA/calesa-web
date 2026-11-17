// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { esquemaDatos, momentosDeRecordatorio } from '@/modules/notificaciones'
import { enLaPaz } from '../entities/ejemplos.soporte'
import { esquemaResumenReunion } from '../entities/respuestas'
import {
  accionesDeCambio,
  accionesDeCancelacion,
  accionesDeReserva,
  despacharCorreos,
  type AccionDeCorreo,
} from './correos'
import { ANTERIOR, REUNION, SOLICITUD, correosFalsos, resumen } from './pruebas.soporte'

const ENLACE = 'https://calesa.test/reunion/tok'
const VISITANTE = 'luis@importadora.test'
const ANFITRION = 'ana@calesa.test'
const resumenDe = (cambios: Parameters<typeof resumen>[0] = {}) =>
  esquemaResumenReunion.parse(resumen(cambios))
const contexto = (ahora: string, cambios: Parameters<typeof resumen>[0] = {}) => ({
  resumen: resumenDe(cambios),
  enlaceGestion: ENLACE,
  ahora,
  momentos: momentosDeRecordatorio,
})

// Lo que importa del orden: qué, a quién y cuándo.
const forma = (acciones: AccionDeCorreo[]) =>
  acciones.map((a) =>
    a.tipo === 'cancelar-reunion' || a.tipo === 'cancelar-solicitud'
      ? [a.tipo, a.id]
      : [a.tipo, a.datos.plantilla, a.para ?? 'equipo', a.tipo === 'programar' ? a.cuando : null],
  )

function expectValidan(acciones: AccionDeCorreo[]) {
  for (const accion of acciones) {
    if (accion.tipo === 'enviar' || accion.tipo === 'programar') {
      expect(esquemaDatos.safeParse(accion.datos).error).toBeUndefined()
    }
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('accionesDeReserva (C10)', () => {
  it('reservada lun 08:00 para mar 10:00: cancela el aviso de 15 min, confirma y programa 24 h y los dos de 1 h', () => {
    const acciones = accionesDeReserva(contexto(enLaPaz('2026-11-02T08:00')))
    expect(forma(acciones)).toEqual([
      ['cancelar-solicitud', SOLICITUD],
      ['enviar', 'reunion-confirmada', VISITANTE, null],
      ['enviar', 'reunion-nueva-anfitrion', ANFITRION, null],
      ['programar', 'recordatorio-24h', VISITANTE, enLaPaz('2026-11-02T10:00')],
      ['programar', 'recordatorio-1h', VISITANTE, enLaPaz('2026-11-03T09:00')],
      ['programar', 'recordatorio-1h', ANFITRION, enLaPaz('2026-11-03T09:00')],
    ])
    expectValidan(acciones)
    expect(acciones[1]).toMatchObject({ datos: { enlaceGestion: ENLACE } })
    expect(acciones[2]).toMatchObject({ datos: { motivo: 'reserva' } })
    expect(acciones[3]).toMatchObject({ datos: { enlaceGestion: ENLACE } })
    expect(acciones[4]).toMatchObject({ datos: { destinatario: 'visitante' } })
    expect(acciones[5]).toMatchObject({ datos: { destinatario: 'anfitrion' } })
  })

  it('reservada lun 22:00 para mar 10:00 (12 h antes): sin recordatorio de 24 h', () => {
    const acciones = accionesDeReserva(contexto(enLaPaz('2026-11-02T22:00')))
    expect(forma(acciones).map((a) => a[1])).toEqual([
      SOLICITUD,
      'reunion-confirmada',
      'reunion-nueva-anfitrion',
      'recordatorio-1h',
      'recordatorio-1h',
    ])
  })

  it('arma la reunión de cada correo desde el resumen de la base', () => {
    const [, confirmada] = accionesDeReserva(contexto(enLaPaz('2026-11-02T08:00')))
    expect(confirmada).toMatchObject({
      datos: {
        reunion: {
          reunionId: REUNION,
          solicitudId: SOLICITUD,
          inicio: enLaPaz('2026-11-03T10:00'),
          zonaVisitante: 'America/Bogota',
          secuencia: 0,
          visitante: { nombre: 'Luis Pérez', email: VISITANTE },
          importadora: 'Autos del Sur',
          anfitrion: { nombre: 'Ana Rojas', email: ANFITRION },
        },
      },
    })
  })
})

describe('accionesDeCambio (C10)', () => {
  const ANTES = enLaPaz('2026-11-03T10:00')
  const cambio = (cambios: Parameters<typeof resumen>[0] = {}) =>
    accionesDeCambio({
      ...contexto(enLaPaz('2026-11-02T08:00'), {
        reunion: { inicio: enLaPaz('2026-11-04T10:00') },
        ...cambios,
      }),
      inicioAnterior: ANTES,
    })

  it('con el mismo anfitrión: cancela lo programado, avisa al visitante, al anfitrión y al equipo, y reprograma', () => {
    const acciones = cambio()
    expect(forma(acciones).map((a) => [a[1], a[2]])).toEqual([
      [REUNION, undefined],
      ['reunion-cambiada', VISITANTE],
      ['reunion-cambiada-equipo', ANFITRION],
      ['aviso-equipo', 'equipo'],
      ['recordatorio-24h', VISITANTE],
      ['recordatorio-1h', VISITANTE],
      ['recordatorio-1h', ANFITRION],
    ])
    expectValidan(acciones)
    expect(acciones[0]).toEqual({ tipo: 'cancelar-reunion', id: REUNION })
    expect(acciones[1]).toMatchObject({ datos: { inicioAnterior: ANTES, enlaceGestion: ENLACE } })
    expect(acciones[2]).toMatchObject({ datos: { destinatario: 'nuevo', motivo: 'reagenda' } })
    expect(acciones[2]?.tipo === 'enviar' && 'anfitrionAnterior' in acciones[2].datos).toBe(false)
    expect(acciones[3]).toMatchObject({
      datos: {
        tipo: 'reunion-cambiada',
        inicio: enLaPaz('2026-11-04T10:00'),
        ocurridoEn: enLaPaz('2026-11-02T08:00'),
      },
    })
  })

  it('con otro anfitrión: el nuevo sabe quién la tenía y el anterior recibe su aviso', () => {
    const acciones = cambio({ anfitrionAnterior: ANTERIOR })
    expectValidan(acciones)
    expect(
      forma(acciones)
        .slice(2, 5)
        .map((a) => [a[1], a[2]]),
    ).toEqual([
      ['reunion-cambiada-equipo', ANFITRION],
      ['reunion-cambiada-equipo', ANTERIOR.email],
      ['aviso-equipo', 'equipo'],
    ])
    expect(acciones[2]).toMatchObject({
      datos: { destinatario: 'nuevo', anfitrionAnterior: { nombre: 'Bruno Díaz' } },
    })
    expect(acciones[3]).toMatchObject({ datos: { destinatario: 'anterior', motivo: 'reagenda' } })
  })
})

describe('accionesDeCancelacion (C10)', () => {
  it('cancela lo programado y avisa al visitante, al anfitrión y al equipo', () => {
    const acciones = accionesDeCancelacion({
      resumen: resumenDe({ reunion: { estado: 'cancelada' } }),
      ahora: enLaPaz('2026-11-02T08:00'),
    })
    expect(forma(acciones).map((a) => [a[1], a[2]])).toEqual([
      [REUNION, undefined],
      ['reunion-cancelada', VISITANTE],
      ['reunion-cancelada', ANFITRION],
      ['aviso-equipo', 'equipo'],
    ])
    expectValidan(acciones)
    expect(acciones[1]).toMatchObject({
      datos: { destinatario: 'visitante', canceladaPor: 'visitante' },
    })
    expect(acciones[2]).toMatchObject({
      datos: { destinatario: 'anfitrion', canceladaPor: 'visitante' },
    })
    expect(acciones[3]).toMatchObject({ datos: { tipo: 'reunion-cancelada' } })
  })

  it('una solicitud sin importadora: el aviso al equipo va sin el campo y valida', () => {
    const acciones = accionesDeCancelacion({
      resumen: resumenDe({ solicitud: { importadora: null } }),
      ahora: enLaPaz('2026-11-02T08:00'),
    })
    expectValidan(acciones)
    const aviso = acciones[3]
    expect(aviso?.tipo === 'enviar' && 'importadora' in aviso.datos).toBe(false)
    expect(acciones[1]).toMatchObject({ datos: { reunion: { importadora: null } } })
  })
})

describe('despacharCorreos (C10)', () => {
  it('corre las acciones una tras otra, y un fallo o una excepción no frenan las siguientes', async () => {
    const registro = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { correos, pedidos } = correosFalsos((p) =>
      p.metodo === 'cancelarDeSolicitud'
        ? 'excepcion'
        : p.metodo === 'enviarAhora'
          ? 'fallo'
          : null,
    )
    const acciones = accionesDeReserva(contexto(enLaPaz('2026-11-02T08:00')))
    await despacharCorreos(acciones, correos)
    expect(pedidos.map((p) => p.metodo)).toEqual([
      'cancelarDeSolicitud',
      'enviarAhora',
      'enviarAhora',
      'programar',
      'programar',
      'programar',
    ])
    expect(registro.mock.calls).toEqual([
      ['agenda: correo cancelar excepcion'],
      ['agenda: correo reunion-confirmada inesperado'],
      ['agenda: correo reunion-nueva-anfitrion inesperado'],
    ])
  })
})
