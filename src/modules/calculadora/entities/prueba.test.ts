import { describe, expect, it } from 'vitest'

import { ROTULO_DE_PRUEBA, TEXTO_DE_PRUEBA } from './prueba'

describe('el bloque de prueba (C15, A2, A0.2)', () => {
  it('el texto es el exacto de A0.2, sin nombre ni logo', () => {
    expect(TEXTO_DE_PRUEBA).toBe(
      'Ya funciona en una de las importadoras más grandes de Bolivia: 35 asesores y unos 40 autos al mes.',
    )
  })

  it('el rótulo es «Ya funciona»', () => {
    expect(ROTULO_DE_PRUEBA).toBe('Ya funciona')
  })
})
