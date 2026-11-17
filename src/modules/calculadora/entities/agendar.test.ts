import { describe, expect, it } from 'vitest'

import { enlaceParaAgendar } from './agendar'
import { ENTRADAS_E1, ENTRADAS_E2 } from './ejemplos.fixture'

describe('enlaceParaAgendar (C11)', () => {
  it('lleva los autos y la administración del ejemplo 1', () => {
    expect(enlaceParaAgendar(ENTRADAS_E1)).toBe('/agendar?autos=25&adm=3')
  })

  it('lleva los del ejemplo 2', () => {
    expect(enlaceParaAgendar(ENTRADAS_E2)).toBe('/agendar?autos=10&adm=2')
  })
})
