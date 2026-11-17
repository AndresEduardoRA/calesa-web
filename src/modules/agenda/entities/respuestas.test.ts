import { describe, expect, it } from 'vitest'
import { ANTERIOR, datosParaHoras, resumen, reunionDelToken } from './respuestas.soporte'
import { esquemaDatosParaHoras, esquemaResumenReunion } from './respuestas'

describe('esquemaDatosParaHoras (C2)', () => {
  it('valida la respuesta de datos_para_horas con un token de solicitud (sin reunión)', () => {
    const r = esquemaDatosParaHoras.safeParse(datosParaHoras())
    expect(r.success).toBe(true)
    expect(r.data?.reunion).toBeUndefined()
  })

  it('valida la respuesta con un token de gestión: suma la reunión, su plazo y el anfitrión', () => {
    const r = esquemaDatosParaHoras.safeParse(datosParaHoras({ reunion: reunionDelToken() }))
    expect(r.success).toBe(true)
    expect(r.data?.reunion?.cambiableHasta).toBe('2026-11-03T12:00:00+00:00')
    expect(r.data?.reunion?.anfitrion).toEqual({ nombre: 'Ana Rojas', whatsapp: '+59170000001' })
  })

  it('acepta un anfitrión sin WhatsApp', () => {
    const datos = datosParaHoras({
      reunion: reunionDelToken({ anfitrion: { nombre: 'Ana', whatsapp: null } }),
    })
    expect(esquemaDatosParaHoras.safeParse(datos).success).toBe(true)
  })

  it('rechaza una respuesta sin `ahora` o con una reunión sin plazo', () => {
    const { ahora: _sin, ...sinAhora } = datosParaHoras()
    expect(esquemaDatosParaHoras.safeParse(sinAhora).success).toBe(false)
    const { cambiableHasta: _quitado, ...sinPlazo } = reunionDelToken()
    expect(esquemaDatosParaHoras.safeParse(datosParaHoras({ reunion: sinPlazo })).success).toBe(
      false,
    )
  })
})

describe('esquemaResumenReunion (C2)', () => {
  it('valida lo que devuelven reservar, cambiar y cancelar, con y sin anfitrión anterior', () => {
    expect(esquemaResumenReunion.safeParse(resumen()).success).toBe(true)
    expect(esquemaResumenReunion.safeParse(resumen({ anfitrionAnterior: ANTERIOR })).success).toBe(
      true,
    )
  })

  it('acepta una solicitud sin importadora ni asignado', () => {
    const datos = resumen({ solicitud: { importadora: null, asignadoA: null } })
    expect(esquemaResumenReunion.safeParse(datos).success).toBe(true)
  })

  it('rechaza un correo de anfitrión inválido o una secuencia que no es un número', () => {
    const malCorreo = { ...resumen(), anfitrion: { ...resumen().anfitrion, email: 'no-es-correo' } }
    expect(esquemaResumenReunion.safeParse(malCorreo).success).toBe(false)
    expect(
      esquemaResumenReunion.safeParse(resumen({ reunion: { secuenciaIcs: '1' } })).success,
    ).toBe(false)
  })
})
