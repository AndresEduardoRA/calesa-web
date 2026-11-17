import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { fallo } from '@/shared/lib/errores'
import { DATOS_DE_EJEMPLO, REUNION } from '../entities/ejemplos.soporte'
import { momentosDeRecordatorio } from '../entities/recordatorios'
import { referenciaDe } from '../entities/referencia'
import { AHORA, armarPrueba } from './pruebas.soporte'

const PARA = 'ana@ejemplo.com'
const r24 = DATOS_DE_EJEMPLO['recordatorio-24h']
// Reservada hoy lun 08:00 para mar 10:00: el de 24 h sale hoy a las 10:00 (14:00 UTC).
const { r24: CUANDO_24, r1: CUANDO_1 } = momentosDeRecordatorio({
  reservadaEn: AHORA,
  inicio: REUNION.inicio,
})

describe('programar', () => {
  it('con Resend: programa en el proveedor con la hora y registra `programado` con su resendId', async () => {
    const { notificador, correo, registro } = armarPrueba()
    const resultado = await notificador.programar({
      para: PARA,
      datos: r24,
      cuando: CUANDO_24 ?? '',
    })
    expect(resultado.ok && resultado.data).toMatchObject({ estado: 'programado', yaEstaba: false })
    expect(correo.de('programar')[0]?.cuando).toBe('2026-11-02T14:00:00.000Z')
    expect(correo.de('enviar')).toHaveLength(0)
    expect(registro.porPlantilla('recordatorio-24h')[0]).toMatchObject({
      estado: 'programado',
      programadoPara: '2026-11-02T14:00:00.000Z',
      referencia: referenciaDe(r24),
    })
    expect(registro.porPlantilla('recordatorio-24h')[0]?.resendId).toMatch(/^1000/)
  })

  it('sin Resend (local, e2e): sin llamada y `programado` con resendId null', async () => {
    const { notificador, correo, registro } = armarPrueba({ programa: false })
    await notificador.programar({ para: PARA, datos: r24, cuando: CUANDO_24 ?? '' })
    expect(correo.llamadas).toHaveLength(0)
    expect(registro.porPlantilla('recordatorio-24h')[0]).toMatchObject({
      estado: 'programado',
      resendId: null,
    })
  })

  it('un momento que ya pasó: `omitido`, sin llamada ni fila', async () => {
    const { notificador, correo, registro } = armarPrueba()
    for (const cuando of ['2026-11-02T11:59:59.000Z', AHORA]) {
      const resultado = await notificador.programar({ para: PARA, datos: r24, cuando })
      expect(resultado.ok && resultado.data).toMatchObject({ estado: 'omitido', id: null })
    }
    expect(correo.llamadas).toHaveLength(0)
    expect(registro.filas.size).toBe(0)
  })

  it('una hora sin zona es `validacion`', async () => {
    const { notificador } = armarPrueba()
    const resultado = await notificador.programar({
      para: PARA,
      datos: r24,
      cuando: '2026-11-02T14:00:00',
    })
    expect(!resultado.ok && resultado.error.codigo).toBe('validacion')
  })

  it('la misma referencia otra vez: `yaEstaba`, sin llamar al proveedor', async () => {
    const { notificador, correo } = armarPrueba()
    await notificador.programar({ para: PARA, datos: r24, cuando: CUANDO_24 ?? '' })
    const otra = await notificador.programar({ para: PARA, datos: r24, cuando: CUANDO_24 ?? '' })
    expect(otra.ok && otra.data.yaEstaba).toBe(true)
    expect(correo.de('programar')).toHaveLength(1)
  })

  it('si el proveedor falla 3 veces: `fallido` con su hora y aviso al equipo', async () => {
    const { notificador, correo, registro } = armarPrueba()
    const mal = () =>
      fallo('inesperado', 'No pudimos llegar al servidor. Revisa tu conexión y vuelve a intentar.')
    correo.guion.programar = [mal(), mal(), mal()]
    const resultado = await notificador.programar({
      para: PARA,
      datos: r24,
      cuando: CUANDO_24 ?? '',
    })
    expect(resultado.ok && resultado.data.estado).toBe('fallido')
    expect(registro.porPlantilla('recordatorio-24h')[0]).toMatchObject({
      estado: 'fallido',
      programadoPara: '2026-11-02T14:00:00.000Z',
      intentos: 3,
    })
    expect(registro.porPlantilla('correo-fallido')).toHaveLength(1)
  })
})

describe('cancelar', () => {
  async function conTresProgramados() {
    const prueba = armarPrueba()
    const { notificador, registro } = prueba
    await notificador.programar({ para: PARA, datos: r24, cuando: CUANDO_24 ?? '' })
    await notificador.programar({
      para: PARA,
      datos: { ...DATOS_DE_EJEMPLO['recordatorio-1h'] },
      cuando: CUANDO_1,
    })
    const sinProveedor = registro.sembrar({
      plantilla: 'recordatorio-1h',
      datos: {},
      reunionId: REUNION.reunionId,
      solicitudId: REUNION.solicitudId,
      programadoPara: CUANDO_1,
    })
    return { ...prueba, sinProveedor }
  }

  it('cancelarDeReunion: llama al proveedor sólo con resendId y deja todas `cancelado`', async () => {
    const { notificador, correo, registro, sinProveedor } = await conTresProgramados()
    const resultado = await notificador.cancelarDeReunion(REUNION.reunionId)
    expect(resultado.ok && resultado.data).toEqual({ cancelados: 3, yaSalieron: 0, fallidos: [] })
    expect(correo.de('cancelar')).toHaveLength(2)
    expect(registro.filas.get(sinProveedor.id)?.estado).toBe('cancelado')
    expect([...registro.filas.values()].every((f) => f.estado === 'cancelado')).toBe(true)
  })

  it('una que falla en el proveedor queda en `fallidos` y sigue `programado`; una `enviado` no se toca', async () => {
    const { notificador, correo, registro } = await conTresProgramados()
    registro.sembrar({
      plantilla: 'recordatorio-24h',
      datos: {},
      estado: 'enviado',
      reunionId: REUNION.reunionId,
    })
    correo.guion.cancelar = [fallo('inesperado', 'sin red')]
    const resultado = await notificador.cancelarDeReunion(REUNION.reunionId)
    expect(resultado.ok && resultado.data.cancelados).toBe(2)
    expect(resultado.ok && resultado.data.fallidos).toHaveLength(1)
    const programados = [...registro.filas.values()].filter((f) => f.estado === 'programado')
    expect(programados).toHaveLength(1)
    expect([...registro.filas.values()].filter((f) => f.estado === 'enviado')).toHaveLength(1)
  })

  it('un programado en el proveedor cuya hora ya pasó se cuenta como `yaSalieron`, sin llamar a cancelar', async () => {
    const { notificador, correo, registro } = armarPrueba()
    registro.sembrar({
      plantilla: 'recordatorio-24h',
      datos: {},
      reunionId: REUNION.reunionId,
      resendId: '10000000-0000-4000-8000-0000000000ff',
      programadoPara: '2026-11-02T10:00:00.000Z',
    })
    const resultado = await notificador.cancelarDeReunion(REUNION.reunionId)
    expect(resultado.ok && resultado.data).toEqual({ cancelados: 0, yaSalieron: 1, fallidos: [] })
    expect(correo.de('cancelar')).toHaveLength(0)
  })

  it('cancelarDeSolicitud toma las de esa solicitud y cancelar(referencia) una sola', async () => {
    const { notificador, registro } = await conTresProgramados()
    const porSolicitud = await notificador.cancelarDeSolicitud(REUNION.solicitudId)
    expect(porSolicitud.ok && porSolicitud.data.cancelados).toBe(3)
    const { notificador: otro } = await conTresProgramados()
    const una = await otro.cancelar(referenciaDe(r24))
    expect(una.ok && una.data.cancelados).toBe(1)
    const ninguna = await otro.cancelar('no:existe')
    expect(ninguna.ok && ninguna.data).toEqual({ cancelados: 0, yaSalieron: 0, fallidos: [] })
    expect(registro.filas.size).toBeGreaterThan(0)
  })
})

describe('reprogramar', () => {
  it('un `programado` con resendId: reprograma en el proveedor y guarda la hora nueva', async () => {
    const { notificador, correo, registro } = armarPrueba()
    await notificador.programar({ para: PARA, datos: r24, cuando: CUANDO_24 ?? '' })
    const resultado = await notificador.reprogramar(referenciaDe(r24), '2026-11-02T15:00:00.000Z')
    expect(resultado.ok).toBe(true)
    expect(correo.de('reprogramar')[0]?.cuando).toBe('2026-11-02T15:00:00.000Z')
    expect(registro.porPlantilla('recordatorio-24h')[0]?.programadoPara).toBe(
      '2026-11-02T15:00:00.000Z',
    )
  })

  it('uno cancelado o enviado es `regla`; uno que no existe, `no_encontrado`; una hora sin zona, `validacion`', async () => {
    const { notificador, registro } = armarPrueba()
    registro.sembrar({
      plantilla: 'recordatorio-24h',
      datos: {},
      estado: 'cancelado',
      referencia: 'a:1',
    })
    const cancelado = await notificador.reprogramar('a:1', '2026-11-02T15:00:00.000Z')
    const nada = await notificador.reprogramar('a:2', '2026-11-02T15:00:00.000Z')
    const sinZona = await notificador.reprogramar('a:1', '2026-11-02T15:00:00')
    expect(!cancelado.ok && cancelado.error.codigo).toBe('regla')
    expect(!nada.ok && nada.error.codigo).toBe('no_encontrado')
    expect(!sinZona.ok && sinZona.error.codigo).toBe('validacion')
  })

  it('sin resendId sólo cambia la hora guardada', async () => {
    const { notificador, correo, registro } = armarPrueba({ programa: false })
    await notificador.programar({ para: PARA, datos: r24, cuando: CUANDO_24 ?? '' })
    await notificador.reprogramar(referenciaDe(r24), '2026-11-02T15:00:00.000Z')
    expect(correo.llamadas).toHaveLength(0)
    expect(registro.porPlantilla('recordatorio-24h')[0]?.programadoPara).toBe(
      '2026-11-02T15:00:00.000Z',
    )
  })
})

describe('despacharVencidos', () => {
  it('con 51 vencidos manda 50 y dice que hay más; los manda sin enlace de gestión', async () => {
    const { notificador, correo, registro } = armarPrueba({ programa: false })
    for (let i = 0; i < 51; i += 1) {
      registro.sembrar({
        plantilla: 'recordatorio-24h',
        datos: { ...r24, enlaceGestion: undefined },
        programadoPara: '2026-11-02T11:00:00.000Z',
        referencia: `recordatorio-24h:${i}`,
      })
    }
    const resultado = await notificador.despacharVencidos()
    expect(resultado.ok && resultado.data).toEqual({ enviados: 50, fallidos: 0, hayMas: true })
    expect(correo.de('enviar')).toHaveLength(50)
    expect(correo.de('enviar')[0]?.mensaje?.texto).toContain(
      'usa el enlace del correo de confirmación',
    )
    const otra = await notificador.despacharVencidos()
    expect(otra.ok && otra.data).toEqual({ enviados: 1, fallidos: 0, hayMas: false })
  })

  it('no manda lo que aún no vence ni lo que ya tiene resendId; cuenta los que fallan', async () => {
    const { notificador, correo, registro } = armarPrueba({ programa: false })
    registro.sembrar({
      plantilla: 'recordatorio-24h',
      datos: { ...r24 },
      programadoPara: '2026-11-02T13:00:00.000Z',
    })
    registro.sembrar({
      plantilla: 'recordatorio-24h',
      datos: { ...r24 },
      programadoPara: '2026-11-02T11:00:00.000Z',
      resendId: '10000000-0000-4000-8000-0000000000aa',
    })
    registro.sembrar({
      plantilla: 'meet-cambiado',
      datos: { roto: 1 },
      programadoPara: '2026-11-02T11:00:00.000Z',
    })
    const resultado = await notificador.despacharVencidos()
    expect(resultado.ok && resultado.data).toEqual({ enviados: 0, fallidos: 1, hayMas: false })
    expect(correo.de('enviar')).toHaveLength(0)
  })
})
