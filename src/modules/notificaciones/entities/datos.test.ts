import { describe, expect, it } from 'vitest'

import { esquemaDatos, datosParaGuardar, esParaElEquipo, idsDe, PLANTILLAS } from './datos'
import { DATOS_DE_EJEMPLO, REUNION } from './ejemplos.soporte'

describe('esquemaDatos', () => {
  it('valida la reunión de ejemplo en las 12 plantillas', () => {
    expect(Object.keys(DATOS_DE_EJEMPLO).sort()).toEqual([...PLANTILLAS].sort())
    for (const datos of Object.values(DATOS_DE_EJEMPLO)) {
      expect(esquemaDatos.safeParse(datos).success).toBe(true)
    }
  })

  const confirmada = DATOS_DE_EJEMPLO['reunion-confirmada']
  const con = (cambios: object) => ({ ...confirmada, reunion: { ...REUNION, ...cambios } })

  it('rechaza un id que no es guid', () => {
    expect(esquemaDatos.safeParse(con({ reunionId: '123' })).success).toBe(false)
  })

  it('rechaza un inicio sin zona', () => {
    expect(esquemaDatos.safeParse(con({ inicio: '2026-11-03T10:00:00' })).success).toBe(false)
  })

  it('rechaza un enlace que no es http(s)', () => {
    expect(esquemaDatos.safeParse(con({ enlaceMeet: 'javascript:alert(1)' })).success).toBe(false)
    expect(
      esquemaDatos.safeParse({ ...confirmada, enlaceGestion: 'javascript:alert(1)' }).success,
    ).toBe(false)
  })

  it('rechaza una zona desconocida, una secuencia negativa y textos con control o demasiado largos', () => {
    expect(esquemaDatos.safeParse(con({ zonaVisitante: 'Marte/Olimpo' })).success).toBe(false)
    expect(esquemaDatos.safeParse(con({ secuencia: -1 })).success).toBe(false)
    expect(
      esquemaDatos.safeParse(con({ visitante: { ...REUNION.visitante, nombre: 'Ana\u0000' } }))
        .success,
    ).toBe(false)
    expect(esquemaDatos.safeParse(con({ importadora: 'x'.repeat(201) })).success).toBe(false)
  })

  it('rechaza una plantilla que no existe', () => {
    expect(esquemaDatos.safeParse({ plantilla: 'otra' }).success).toBe(false)
  })
})

describe('esParaElEquipo', () => {
  it('sólo aviso-equipo y correo-fallido', () => {
    expect(PLANTILLAS.filter(esParaElEquipo)).toEqual(['aviso-equipo', 'correo-fallido'])
  })
})

describe('idsDe', () => {
  it('saca los ids de la reunión, de la solicitud o de la fila que falló', () => {
    expect(idsDe(DATOS_DE_EJEMPLO['reunion-confirmada'])).toEqual({
      reunionId: REUNION.reunionId,
      solicitudId: REUNION.solicitudId,
    })
    expect(idsDe(DATOS_DE_EJEMPLO['solicitud-sin-reunion'])).toEqual({
      reunionId: null,
      solicitudId: REUNION.solicitudId,
    })
    expect(idsDe(DATOS_DE_EJEMPLO['correo-fallido'])).toEqual({
      reunionId: REUNION.reunionId,
      solicitudId: REUNION.solicitudId,
    })
  })

  it('un correo-fallido sin ids los deja en null', () => {
    const { reunionId: _r, solicitudId: _s, ...sinIds } = DATOS_DE_EJEMPLO['correo-fallido']
    expect(idsDe(sinIds)).toEqual({ reunionId: null, solicitudId: null })
  })
})

describe('datosParaGuardar', () => {
  it('quita el enlace de gestión y deja lo demás', () => {
    const guardado = datosParaGuardar(DATOS_DE_EJEMPLO['reunion-confirmada'])
    expect(guardado).not.toHaveProperty('enlaceGestion')
    expect(guardado).toHaveProperty('plantilla', 'reunion-confirmada')
    expect(JSON.stringify(guardado)).not.toContain('/reunion/')
  })

  it('una plantilla sin enlace de gestión queda igual', () => {
    const datos = DATOS_DE_EJEMPLO['meet-cambiado']
    expect(datosParaGuardar(datos)).toEqual(datos)
  })
})
