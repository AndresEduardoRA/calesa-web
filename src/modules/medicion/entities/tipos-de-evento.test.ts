import { describe, expect, expectTypeOf, it } from 'vitest'

import type { Database } from '@/shared/types/database.types'

import { TIPOS_DE_EVENTO_PUBLICOS, type TipoDeEventoPublico } from './tipos-de-evento'

describe('TIPOS_DE_EVENTO_PUBLICOS (C1)', () => {
  it('son sólo clic_agendar y calculadora_usada', () => {
    expect([...TIPOS_DE_EVENTO_PUBLICOS]).toEqual(['clic_agendar', 'calculadora_usada'])
  })

  it('son un subconjunto de tipo_evento de la base', () => {
    expectTypeOf<TipoDeEventoPublico>().toExtend<Database['public']['Enums']['tipo_evento']>()
  })
})
