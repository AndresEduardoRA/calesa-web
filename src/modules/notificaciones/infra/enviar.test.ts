import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { fallo, ok } from '../../../shared/lib/errores'
import { DATOS_DE_EJEMPLO, REUNION } from '../entities/ejemplos.soporte'
import { referenciaDe } from '../entities/referencia'
import { AHORA, armarPrueba } from './pruebas.soporte'

const confirmada = DATOS_DE_EJEMPLO['reunion-confirmada']
const PARA = 'ana@ejemplo.com'
const sinRed = () =>
  fallo('inesperado', 'No pudimos llegar al servidor. Revisa tu conexión y vuelve a intentar.')

describe('enviarAhora', () => {
  it('manda, registra `enviado` con el id del proveedor y devuelve la fila', async () => {
    const { notificador, correo, registro } = armarPrueba()
    const resultado = await notificador.enviarAhora({ para: PARA, datos: confirmada })
    expect(resultado.ok && resultado.data).toMatchObject({ estado: 'enviado', yaEstaba: false })
    const [fila] = registro.porPlantilla('reunion-confirmada')
    expect(fila).toMatchObject({
      estado: 'enviado',
      intentos: 1,
      enviadoEn: AHORA,
      referencia: referenciaDe(confirmada),
      para: PARA,
    })
    expect(fila?.resendId).toBe(
      correo.de('enviar').length ? '10000000-0000-4000-8000-000000000001' : null,
    )
    const mensaje = correo.de('enviar')[0]?.mensaje
    expect(mensaje).toMatchObject({
      para: PARA,
      asunto: 'Tu demo con Calesa: 3 nov 2026, 10:00',
      etiquetas: { plantilla: 'reunion-confirmada' },
      referencia: referenciaDe(confirmada),
    })
  })

  it('inesperado, inesperado, ok: 3 intentos, enviado con intentos 3 y esperas de 300 y 900', async () => {
    const { notificador, correo, registro, esperas } = armarPrueba()
    correo.guion.enviar = [sinRed(), sinRed()]
    await notificador.enviarAhora({ para: PARA, datos: confirmada })
    expect(correo.de('enviar')).toHaveLength(3)
    expect(registro.porPlantilla('reunion-confirmada')[0]).toMatchObject({
      estado: 'enviado',
      intentos: 3,
    })
    expect(esperas).toEqual([300, 900])
  })

  it('3 × inesperado: queda `fallido`, el resultado es ok y avisa a EMAIL_AVISOS una vez', async () => {
    const { notificador, correo, registro } = armarPrueba()
    correo.guion.enviar = [sinRed(), sinRed(), sinRed()]
    const resultado = await notificador.enviarAhora({ para: PARA, datos: confirmada })
    expect(resultado.ok && resultado.data.estado).toBe('fallido')
    const [fila] = registro.porPlantilla('reunion-confirmada')
    expect(fila).toMatchObject({ estado: 'fallido', intentos: 3 })
    expect(fila?.ultimoError).toContain('No pudimos llegar al servidor')
    const avisos = correo
      .de('enviar')
      .filter((l) => l.mensaje?.etiquetas?.['plantilla'] === 'correo-fallido')
    expect(avisos).toHaveLength(1)
    expect(avisos[0]?.mensaje?.para).toBe('equipo@getcalesa.com')
    const aviso = registro.porPlantilla('correo-fallido')[0]
    // El aviso copia los ids de la fila que falló: el borrado de una solicitud también lo vacía.
    expect(aviso).toMatchObject({ reunionId: REUNION.reunionId, solicitudId: REUNION.solicitudId })
  })

  it('un error de validación del proveedor no se reintenta; el aviso que falla no dispara otro', async () => {
    const { notificador, correo, registro } = armarPrueba()
    correo.guion.enviar = [
      fallo('validacion', 'El correo no se mandó: el mensaje no es válido.'),
      fallo('validacion', 'otra vez'),
    ]
    await notificador.enviarAhora({ para: PARA, datos: confirmada })
    // 1 intento del correo + 1 del aviso (que también falla con validación): ningún aviso de un aviso.
    expect(correo.de('enviar')).toHaveLength(2)
    expect(registro.porPlantilla('reunion-confirmada')[0]).toMatchObject({
      estado: 'fallido',
      intentos: 1,
    })
    expect(registro.porPlantilla('correo-fallido')[0]).toMatchObject({
      estado: 'fallido',
      intentos: 1,
    })
    expect(registro.porPlantilla('correo-fallido')).toHaveLength(1)
  })

  it('con el proveedor apagado (`regla`) queda `fallido` sin avisar a nadie', async () => {
    const { notificador, correo, registro } = armarPrueba()
    correo.guion.enviar = [
      fallo('regla', 'El envío de correos está apagado (EMAIL_PROVEEDOR=ninguno).'),
    ]
    await notificador.enviarAhora({ para: PARA, datos: confirmada })
    expect(registro.porPlantilla('reunion-confirmada')[0]?.estado).toBe('fallido')
    expect(registro.porPlantilla('correo-fallido')).toHaveLength(0)
    expect(correo.de('enviar')).toHaveLength(1)
  })
})

describe('enviarAhora · conflictos', () => {
  it('un `conflicto` del proveedor devuelve la fila que ya está, sin registrar un fallido', async () => {
    const { notificador, correo, registro } = armarPrueba()
    const previa = registro.sembrar({
      plantilla: 'reunion-confirmada',
      datos: {},
      estado: 'enviado',
      referencia: referenciaDe(confirmada),
    })
    // Otro pedido igual ganó entre la lectura y el envío: simulamos que la lectura no la vio.
    const original = registro.porReferencia.bind(registro)
    let primera = true
    registro.porReferencia = (ref: string) => {
      if (primera) {
        primera = false
        return Promise.resolve(ok(null))
      }
      return original(ref)
    }
    correo.guion.enviar = [fallo('conflicto', 'Ese correo ya existe con otro contenido.')]
    const resultado = await notificador.enviarAhora({ para: PARA, datos: confirmada })
    expect(resultado.ok && resultado.data).toMatchObject({ id: previa.id, yaEstaba: true })
    expect(registro.filas.size).toBe(1)
  })

  it('un `conflicto` sin fila todavía no se registra: dice que ya va en camino', async () => {
    const { notificador, correo, registro } = armarPrueba()
    correo.guion.enviar = [fallo('conflicto', 'ya')]
    const resultado = await notificador.enviarAhora({ para: PARA, datos: confirmada })
    expect(resultado.ok).toBe(false)
    expect(!resultado.ok && resultado.error.mensaje).toBe('Ese correo ya va en camino.')
    expect(registro.filas.size).toBe(0)
  })
})

describe('enviarAhora · idempotencia y registro', () => {
  it('la misma referencia otra vez no manda nada y dice `yaEstaba`', async () => {
    const { notificador, correo } = armarPrueba()
    await notificador.enviarAhora({ para: PARA, datos: confirmada })
    const otra = await notificador.enviarAhora({ para: PARA, datos: confirmada })
    expect(otra.ok && otra.data.yaEstaba).toBe(true)
    expect(correo.de('enviar')).toHaveLength(1)
  })

  it('si `registrar` da `duplicado` (otro pedido ganó), devuelve esa fila', async () => {
    const { notificador, registro } = armarPrueba()
    const ganadora = registro.sembrar({
      plantilla: 'reunion-confirmada',
      datos: {},
      estado: 'enviado',
      referencia: referenciaDe(confirmada),
    })
    const original = registro.porReferencia.bind(registro)
    let primera = true
    registro.porReferencia = (ref: string) => {
      if (primera) {
        primera = false
        return Promise.resolve(ok(null))
      }
      return original(ref)
    }
    const resultado = await notificador.enviarAhora({ para: PARA, datos: confirmada })
    expect(resultado.ok && resultado.data).toMatchObject({ id: ganadora.id, yaEstaba: true })
  })

  it('la confirmada guarda el .ics REQUEST y los datos sin el enlace de gestión, con sus ids', async () => {
    const { notificador, registro } = armarPrueba()
    await notificador.enviarAhora({ para: PARA, datos: confirmada })
    const [fila] = registro.porPlantilla('reunion-confirmada')
    expect(fila?.adjuntoIcs).toContain('METHOD:REQUEST')
    expect(fila?.adjuntoIcs).toContain(`UID:${REUNION.reunionId}@calesa.app`)
    expect(fila?.datos).not.toHaveProperty('enlaceGestion')
    expect(JSON.stringify(fila?.datos)).not.toContain('/reunion/')
    expect(fila).toMatchObject({ reunionId: REUNION.reunionId, solicitudId: REUNION.solicitudId })
  })

  it('el aviso del equipo va siempre a EMAIL_AVISOS, aunque quien llama pase otro destinatario', async () => {
    const { notificador, correo } = armarPrueba()
    await notificador.enviarAhora({ para: PARA, datos: DATOS_DE_EJEMPLO['aviso-equipo'] })
    expect(correo.de('enviar')[0]?.mensaje?.para).toBe('equipo@getcalesa.com')
  })

  it('datos inválidos o sin destinatario: `validacion`, sin mandar ni registrar', async () => {
    const { notificador, correo, registro } = armarPrueba()
    const malos = await notificador.enviarAhora({
      para: PARA,
      datos: { plantilla: 'reunion-confirmada' },
    })
    const sinPara = await notificador.enviarAhora({ datos: confirmada })
    const paraMalo = await notificador.enviarAhora({ para: 'no-es-correo', datos: confirmada })
    for (const r of [malos, sinPara, paraMalo]) expect(!r.ok && r.error.codigo).toBe('validacion')
    expect(correo.llamadas).toHaveLength(0)
    expect(registro.filas.size).toBe(0)
  })

  it('si registrar falla después de mandar: error que dice que el correo sí salió', async () => {
    const { notificador, registro } = armarPrueba()
    registro.fallar.registrar = true
    const resultado = await notificador.enviarAhora({ para: PARA, datos: confirmada })
    expect(!resultado.ok && resultado.error.mensaje).toBe(
      'El correo salió pero no quedó registrado.',
    )
  })

  it('si falla la lectura del registro, no manda', async () => {
    const { notificador, correo, registro } = armarPrueba()
    registro.fallar.porReferencia = true
    const resultado = await notificador.enviarAhora({ para: PARA, datos: confirmada })
    expect(resultado.ok).toBe(false)
    expect(correo.llamadas).toHaveLength(0)
  })
})

describe('reintentar', () => {
  it('un `fallido` con intentos 3 pasa a `enviado` con intentos 4', async () => {
    const { notificador, registro } = armarPrueba()
    const fila = registro.sembrar({
      plantilla: 'reunion-confirmada',
      datos: { ...confirmada, enlaceGestion: undefined },
      estado: 'fallido',
      intentos: 3,
      ultimoError: 'x',
      referencia: 'reunion-confirmada:x:0',
    })
    const resultado = await notificador.reintentar(fila.id)
    expect(resultado.ok && resultado.data.estado).toBe('enviado')
    expect(registro.filas.get(fila.id)).toMatchObject({
      estado: 'enviado',
      intentos: 4,
      ultimoError: null,
    })
  })

  it('un `enviado` no se reintenta (`regla`) y un id desconocido es `no_encontrado`', async () => {
    const { notificador, registro } = armarPrueba()
    const fila = registro.sembrar({ plantilla: 'meet-cambiado', datos: {}, estado: 'enviado' })
    const enviado = await notificador.reintentar(fila.id)
    expect(!enviado.ok && enviado.error.codigo).toBe('regla')
    const nada = await notificador.reintentar('99999999-9999-4999-8999-999999999999')
    expect(!nada.ok && nada.error.codigo).toBe('no_encontrado')
  })

  it('un programado fallido con su hora por delante se vuelve a programar, no se manda ya', async () => {
    const { notificador, correo, registro } = armarPrueba()
    const fila = registro.sembrar({
      plantilla: 'recordatorio-24h',
      datos: { ...DATOS_DE_EJEMPLO['recordatorio-24h'], enlaceGestion: undefined },
      estado: 'fallido',
      programadoPara: '2026-11-02T14:00:00.000Z',
      intentos: 3,
    })
    const resultado = await notificador.reintentar(fila.id)
    expect(resultado.ok && resultado.data.estado).toBe('programado')
    expect(correo.de('enviar')).toHaveLength(0)
    expect(correo.de('programar')).toHaveLength(1)
    expect(registro.filas.get(fila.id)?.resendId).not.toBeNull()
  })

  it('sin proveedor que programe, un fallido a futuro vuelve a `programado` sin resendId', async () => {
    const { notificador, correo, registro } = armarPrueba({ programa: false })
    const fila = registro.sembrar({
      plantilla: 'recordatorio-24h',
      datos: { ...DATOS_DE_EJEMPLO['recordatorio-24h'], enlaceGestion: undefined },
      estado: 'fallido',
      programadoPara: '2026-11-02T14:00:00.000Z',
    })
    await notificador.reintentar(fila.id)
    expect(correo.llamadas).toHaveLength(0)
    expect(registro.filas.get(fila.id)).toMatchObject({ estado: 'programado', resendId: null })
  })

  it('datos guardados que ya no valen: queda `fallido` con el motivo', async () => {
    const { notificador, registro } = armarPrueba()
    const fila = registro.sembrar({
      plantilla: 'meet-cambiado',
      datos: { roto: true },
      estado: 'fallido',
    })
    await notificador.reintentar(fila.id)
    expect(registro.filas.get(fila.id)).toMatchObject({
      estado: 'fallido',
      ultimoError: 'Los datos guardados del correo ya no son válidos.',
    })
  })
})
