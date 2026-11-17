// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { generarTokenDeGestion, hashDeTokenDeGestion } from './token-gestion'

// sha256 de 32 bytes en cero, sacado con `head -c 32 /dev/zero | sha256sum` (bitácora de P06).
const HASH_DE_CEROS = '\\x66687aadf862bd776c8fc18b8e9f8e20089714856ee233b3902a591d0d5f2925'
const ceros = () => new Uint8Array(32)

describe('generarTokenDeGestion', () => {
  it('codifica 32 bytes en base64url sin relleno y guarda el sha256 de los bytes como bytea', () => {
    expect(generarTokenDeGestion({ azar: ceros })).toEqual({
      token: 'A'.repeat(43),
      hash: HASH_DE_CEROS,
    })
  })

  it('con el azar real da tokens distintos de 43 caracteres', () => {
    const uno = generarTokenDeGestion()
    const otro = generarTokenDeGestion()
    expect(uno.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(otro.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(uno.token).not.toBe(otro.token)
    expect(uno.hash).toMatch(/^\\x[0-9a-f]{64}$/)
  })
})

describe('hashDeTokenDeGestion', () => {
  it('da el mismo hash que se guardó al generarlo', () => {
    const { token, hash } = generarTokenDeGestion()
    expect(hashDeTokenDeGestion(token)).toBe(hash)
    expect(hashDeTokenDeGestion('A'.repeat(43))).toBe(HASH_DE_CEROS)
  })

  it.each([
    ['42 caracteres', 'A'.repeat(42)],
    ['44 caracteres', 'A'.repeat(44)],
    ['un carácter fuera del alfabeto', `${'A'.repeat(42)}+`],
    ['con relleno', `${'A'.repeat(42)}=`],
    ['un último carácter no canónico', `${'A'.repeat(42)}B`],
    ['vacío', ''],
  ])('con %s da null', (_caso, token) => {
    expect(hashDeTokenDeGestion(token)).toBeNull()
  })
})
