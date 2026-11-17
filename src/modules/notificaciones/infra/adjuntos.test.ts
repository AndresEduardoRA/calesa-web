import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { esquemaDeMensaje } from '@/shared/lib/email/tipos'
import { DATOS_DE_EJEMPLO, REUNION } from '../entities/ejemplos.soporte'
import { momentosDeRecordatorio } from '../entities/recordatorios'
import { referenciaDe } from '../entities/referencia'
import { AHORA, armarPrueba } from './pruebas.soporte'

const PARA = 'ana@ejemplo.com'
const confirmada = DATOS_DE_EJEMPLO['reunion-confirmada']
const sinEnlace = (plantilla: keyof typeof DATOS_DE_EJEMPLO) => ({
  ...DATOS_DE_EJEMPLO[plantilla],
  enlaceGestion: undefined,
})
const CUANDO = '2026-11-02T14:00:00.000Z'
const PASADO = '2026-11-02T10:00:00.000Z'

const ics = (adjunto?: { contenido: string }) =>
  Buffer.from(adjunto?.contenido ?? '', 'base64').toString('utf8')

describe('el .ics sale adjunto', () => {
  it('enviarAhora de la confirmada: un adjunto REQUEST igual al .ics guardado, y el mensaje es válido', async () => {
    const { notificador, correo, registro } = armarPrueba()
    await notificador.enviarAhora({ para: PARA, datos: confirmada })
    const mensaje = correo.de('enviar')[0]?.mensaje
    expect(esquemaDeMensaje.safeParse(mensaje).success).toBe(true)
    expect(mensaje?.adjuntos).toHaveLength(1)
    expect(mensaje?.adjuntos?.[0]).toMatchObject({
      nombre: 'demo-calesa.ics',
      tipo: 'text/calendar; method=REQUEST',
    })
    const [fila] = registro.porPlantilla('reunion-confirmada')
    expect(ics(mensaje?.adjuntos?.[0])).toBe(fila?.adjuntoIcs)
    expect(fila?.adjuntoIcs).toContain('METHOD:REQUEST')
  })

  it('la cancelación al visitante lleva CANCEL; al anfitrión, el recordatorio y el aviso, ningún adjunto', async () => {
    const { notificador, correo } = armarPrueba()
    await notificador.enviarAhora({ para: PARA, datos: DATOS_DE_EJEMPLO['reunion-cancelada'] })
    await notificador.enviarAhora({
      datos: { ...DATOS_DE_EJEMPLO['reunion-cancelada'], destinatario: 'anfitrion' },
    })
    await notificador.enviarAhora({ para: PARA, datos: DATOS_DE_EJEMPLO['recordatorio-24h'] })
    await notificador.enviarAhora({ para: PARA, datos: DATOS_DE_EJEMPLO['meet-cambiado'] })
    const [visitante, ...otros] = correo.de('enviar').map((l) => l.mensaje)
    expect(visitante?.adjuntos?.[0]?.tipo).toBe('text/calendar; method=CANCEL')
    expect(ics(visitante?.adjuntos?.[0])).toContain('METHOD:CANCEL')
    for (const m of otros) expect(m).not.toHaveProperty('adjuntos')
  })

  it('reintentar una confirmada fallida ya vencida: mismo UID y SEQUENCE en el adjunto', async () => {
    const { notificador, correo, registro } = armarPrueba()
    const fila = registro.sembrar({
      plantilla: 'reunion-confirmada',
      datos: sinEnlace('reunion-confirmada'),
      estado: 'fallido',
      intentos: 3,
      programadoPara: PASADO,
    })
    await notificador.reintentar(fila.id)
    const adjunto = correo.de('enviar')[0]?.mensaje?.adjuntos?.[0]
    expect(ics(adjunto)).toContain(`UID:${REUNION.reunionId}@calesa.app`)
    expect(ics(adjunto)).toContain('SEQUENCE:0')
  })

  it('despacharVencidos de una cambiada y de una cancelada sin resendId manda su .ics', async () => {
    const { notificador, correo, registro } = armarPrueba({ programa: false })
    for (const plantilla of ['reunion-cambiada', 'reunion-cancelada'] as const)
      registro.sembrar({ plantilla, datos: sinEnlace(plantilla), programadoPara: PASADO })
    await notificador.despacharVencidos()
    const tipos = correo.de('enviar').map((l) => l.mensaje?.adjuntos?.[0]?.tipo)
    expect(tipos.sort()).toEqual(['text/calendar; method=CANCEL', 'text/calendar; method=REQUEST'])
  })

  it('programar con proveedor y volverAProgramar llevan el adjunto en la llamada `programar`', async () => {
    const { notificador, correo, registro } = armarPrueba()
    await notificador.programar({ para: PARA, datos: confirmada, cuando: CUANDO })
    const fila = registro.sembrar({
      plantilla: 'reunion-confirmada',
      datos: sinEnlace('reunion-confirmada'),
      estado: 'fallido',
      programadoPara: CUANDO,
    })
    await notificador.reintentar(fila.id)
    const programadas = correo.de('programar')
    expect(programadas).toHaveLength(2)
    for (const l of programadas)
      expect(l.mensaje?.adjuntos?.[0]?.tipo).toBe('text/calendar; method=REQUEST')
  })
})

describe('reprogramar no vuelve a armar el correo', () => {
  const r24 = DATOS_DE_EJEMPLO['recordatorio-24h']
  const { r24: CUANDO_24 } = momentosDeRecordatorio({ reservadaEn: AHORA, inicio: REUNION.inicio })

  it('con resendId: una sola llamada `reprogramar(id, cuando)`, sin mensaje', async () => {
    const { notificador, correo } = armarPrueba()
    await notificador.programar({ para: PARA, datos: r24, cuando: CUANDO_24 ?? '' })
    await notificador.reprogramar(referenciaDe(r24), CUANDO)
    expect(correo.de('reprogramar')).toHaveLength(1)
    expect(correo.de('reprogramar')[0]).not.toHaveProperty('mensaje')
    expect(correo.de('programar')).toHaveLength(1)
  })

  it('sin proveedor: reprogramar sólo cambia la hora y el despacho manda el .ics a la hora nueva', async () => {
    const { notificador, correo, registro } = armarPrueba({ programa: false })
    const fila = registro.sembrar({
      plantilla: 'reunion-confirmada',
      datos: sinEnlace('reunion-confirmada'),
      programadoPara: '2026-11-03T10:00:00.000Z',
      referencia: 'ref-de-prueba',
    })
    await notificador.reprogramar('ref-de-prueba', PASADO)
    expect(correo.llamadas).toHaveLength(0)
    expect(registro.filas.get(fila.id)?.programadoPara).toBe(PASADO)
    await notificador.despacharVencidos()
    expect(correo.de('enviar')[0]?.mensaje?.adjuntos?.[0]?.tipo).toBe(
      'text/calendar; method=REQUEST',
    )
  })
})
