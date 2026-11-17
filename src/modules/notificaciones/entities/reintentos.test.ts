import { describe, expect, it, vi } from 'vitest'

import { fallo, ok, type Resultado } from '../../../shared/lib/errores'
import {
  ESPERAS_ENTRE_INTENTOS_MS,
  INTENTOS_MAXIMOS,
  conReintentos,
  esReintentable,
} from './reintentos'

function guion(...resultados: Resultado<string>[]) {
  const cola = [...resultados]
  return vi.fn(() => Promise.resolve(cola.shift() ?? fallo('inesperado', 'sin guion')))
}

describe('esReintentable', () => {
  it('sólo `inesperado`', () => {
    expect(esReintentable('inesperado')).toBe(true)
    for (const codigo of [
      'validacion',
      'regla',
      'conflicto',
      'no_encontrado',
      'duplicado',
    ] as const) {
      expect(esReintentable(codigo)).toBe(false)
    }
  })
})

describe('conReintentos', () => {
  it('son 3 intentos con esperas de 300 y 900 ms', () => {
    expect(ESPERAS_ENTRE_INTENTOS_MS).toEqual([300, 900])
    expect(INTENTOS_MAXIMOS).toBe(3)
  })

  it('a la primera: un intento, sin esperar', async () => {
    const esperar = vi.fn(() => Promise.resolve())
    const intento = guion(ok('a'))
    expect(await conReintentos(intento, esperar)).toEqual({ resultado: ok('a'), intentos: 1 })
    expect(esperar).not.toHaveBeenCalled()
  })

  it('inesperado, inesperado, ok: 3 intentos y esperó 300 y 900', async () => {
    const esperar = vi.fn(() => Promise.resolve())
    const intento = guion(fallo('inesperado', 'a'), fallo('inesperado', 'b'), ok('c'))
    const { resultado, intentos } = await conReintentos(intento, esperar)
    expect(resultado).toEqual(ok('c'))
    expect(intentos).toBe(3)
    expect(esperar.mock.calls).toEqual([[300], [900]])
  })

  it('3 × inesperado: se rinde con el último error', async () => {
    const esperar = vi.fn(() => Promise.resolve())
    const intento = guion(
      fallo('inesperado', 'a'),
      fallo('inesperado', 'b'),
      fallo('inesperado', 'c'),
    )
    const { resultado, intentos } = await conReintentos(intento, esperar)
    expect(intentos).toBe(3)
    expect(resultado).toEqual(fallo('inesperado', 'c'))
  })

  it('un error que no se arregla solo no se reintenta', async () => {
    const esperar = vi.fn(() => Promise.resolve())
    const intento = guion(fallo('validacion', 'mal'), ok('nunca'))
    const { intentos } = await conReintentos(intento, esperar)
    expect(intentos).toBe(1)
    expect(intento).toHaveBeenCalledTimes(1)
    expect(esperar).not.toHaveBeenCalled()
  })
})
