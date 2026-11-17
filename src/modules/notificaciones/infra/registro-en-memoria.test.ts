import { describe, expect, it } from 'vitest'

import { CASOS_DEL_REGISTRO } from './casos-del-registro.soporte'
import { RegistroEnMemoria } from './registro-en-memoria.soporte'

describe('RegistroEnMemoria corre la tabla de casos del registro', () => {
  it.each(CASOS_DEL_REGISTRO)('$nombre', async (caso) => {
    expect(await caso.correr(new RegistroEnMemoria())).toEqual(caso.esperado)
  })
})
