// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

// La tabla de casos importa `LIMITES` como valor, y `limites.ts` carga `server-only`.
vi.mock('server-only', () => ({}))

import {
  CASOS_DE_CONTAR_ENVIO,
  esperadoDelCaso,
  recorrerCaso,
  relojFijo,
} from './casos-de-contar-envio.soporte'
import { crearContadorEnMemoria } from './contador-en-memoria.soporte'

describe('crearContadorEnMemoria (contrato de ContarEnvio, ventana fija)', () => {
  it.each(CASOS_DE_CONTAR_ENVIO)('$nombre', async (caso) => {
    const { reloj, avanzar } = relojFijo()
    const contar = crearContadorEnMemoria(reloj)
    expect(await recorrerCaso(caso, contar, avanzar)).toEqual(esperadoDelCaso(caso))
  })
})
