// @vitest-environment node
// En jsdom, `Uint8Array` es de otro realm y `timingSafeEqual` puede rechazarlo: estas pruebas corren en Node.
import type * as nodeCrypto from 'node:crypto'
import { timingSafeEqual } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('node:crypto', async (importOriginal) => {
  const real = await importOriginal<typeof nodeCrypto>()
  return { ...real, timingSafeEqual: vi.fn(real.timingSafeEqual) }
})

import { igualesEnTiempoConstante, sha256Hex } from './cripto'

describe('igualesEnTiempoConstante', () => {
  beforeEach(() => {
    vi.mocked(timingSafeEqual).mockClear()
  })

  it('da true con dos textos iguales', () => {
    expect(igualesEnTiempoConstante('Bearer secreto', 'Bearer secreto')).toBe(true)
  })

  it.each([
    ['un carácter distinto', 'Bearer secretx'],
    ['más corto', 'Bearer secret'],
    ['más largo', 'Bearer secreto!'],
    ['vacío', ''],
  ])('da false sin lanzar con %s', (_caso, otro) => {
    expect(() => igualesEnTiempoConstante('Bearer secreto', otro)).not.toThrow()
    expect(igualesEnTiempoConstante('Bearer secreto', otro)).toBe(false)
  })

  it('compara con timingSafeEqual dos resúmenes de 32 bytes, también con largos distintos', () => {
    igualesEnTiempoConstante('corto', 'un texto bastante más largo que el otro')
    expect(timingSafeEqual).toHaveBeenCalledTimes(1)
    const [a, b] = vi.mocked(timingSafeEqual).mock.calls[0] ?? []
    expect((a as Uint8Array).byteLength).toBe(32)
    expect((b as Uint8Array).byteLength).toBe(32)
  })
})

describe('sha256Hex', () => {
  it('da el vector de FIPS 180-2 para «abc», en hex minúscula', () => {
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })
})
