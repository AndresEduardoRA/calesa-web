import { describe, expect, it } from 'vitest'

import { estadoDeTarea, HORAS_SIN_LATIDO, TAREA_DIARIA } from './latidos'

const AHORA = new Date('2026-11-20T12:00:00.000Z')
const haceHoras = (h: number, extraMs = 0) =>
  new Date(AHORA.getTime() - h * 3_600_000 - extraMs).toISOString()

describe('estadoDeTarea (C11)', () => {
  it('la tarea es diario y el plazo 26 h', () => {
    expect(TAREA_DIARIA).toBe('diario')
    expect(HORAS_SIN_LATIDO).toBe(26)
  })

  it('con ultimo_ok a 26 h justas no está detenida', () => {
    const ok = haceHoras(26)
    expect(
      estadoDeTarea(
        { ultimo_ok: ok, ultimo_error: null, fallos_seguidos: 0, creado_en: haceHoras(500) },
        AHORA,
      ),
    ).toEqual({ detenida: false, desde: ok, ultimoError: null, fallosSeguidos: 0 })
  })

  it('con ultimo_ok a 26 h + 1 s está detenida desde ultimo_ok', () => {
    const ok = haceHoras(26, 1000)
    expect(
      estadoDeTarea(
        { ultimo_ok: ok, ultimo_error: 'boom', fallos_seguidos: 3, creado_en: haceHoras(500) },
        AHORA,
      ),
    ).toEqual({ detenida: true, desde: ok, ultimoError: 'boom', fallosSeguidos: 3 })
  })

  it('sin fila no está detenida y no hay desde', () => {
    expect(estadoDeTarea(null, AHORA)).toEqual({
      detenida: false,
      desde: null,
      ultimoError: null,
      fallosSeguidos: 0,
    })
  })

  it('con ultimo_ok nulo cuenta las 26 h desde creado_en', () => {
    const creado = haceHoras(26)
    const fila = { ultimo_ok: null, ultimo_error: 'x', fallos_seguidos: 1, creado_en: creado }
    expect(estadoDeTarea(fila, AHORA)).toEqual({
      detenida: false,
      desde: creado,
      ultimoError: 'x',
      fallosSeguidos: 1,
    })
    const antiguo = haceHoras(26, 1000)
    expect(estadoDeTarea({ ...fila, creado_en: antiguo }, AHORA)).toMatchObject({
      detenida: true,
      desde: antiguo,
    })
  })
})
