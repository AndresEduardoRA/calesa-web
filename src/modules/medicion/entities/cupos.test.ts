import { describe, expect, it } from 'vitest'

import {
  evaluarCupos,
  textoDelAvisoDeCupo,
  UMBRAL_DE_BASE_BYTES,
  UMBRAL_DE_CORREOS_DIA,
} from './cupos'

describe('evaluarCupos (C10)', () => {
  it('los umbrales de R5.2', () => {
    expect(UMBRAL_DE_BASE_BYTES).toBe(400_000_000)
    expect(UMBRAL_DE_CORREOS_DIA).toBe(80)
  })

  it('en el umbral justo no pasa; un poco más, sí', () => {
    expect(evaluarCupos({ bytesDeBase: 400_000_000, correosDelDia: 80 })).toEqual([])
    expect(evaluarCupos({ bytesDeBase: 400_000_001, correosDelDia: 80 })).toEqual(['base'])
    expect(evaluarCupos({ bytesDeBase: 0, correosDelDia: 81 })).toEqual(['correos'])
    expect(evaluarCupos({ bytesDeBase: 400_000_001, correosDelDia: 81 })).toEqual([
      'base',
      'correos',
    ])
  })

  it('un valor negativo o no finito no cuenta', () => {
    expect(evaluarCupos({ bytesDeBase: Number.NaN, correosDelDia: -1 })).toEqual([])
    expect(
      evaluarCupos({ bytesDeBase: Number.POSITIVE_INFINITY, correosDelDia: Number.NaN }),
    ).toEqual([])
  })

  it('los textos del banner (UX.md)', () => {
    expect(textoDelAvisoDeCupo('base')).toBe('Te acercas al límite gratis de la base de datos.')
    expect(textoDelAvisoDeCupo('correos')).toBe('Te acercas al límite gratis de correos.')
  })
})
