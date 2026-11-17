import { createHash, randomBytes } from 'node:crypto'

// El token de gestión abre `/reunion/<token>` (cambiar o cancelar; semilla §5.6): 32 bytes al azar en base64url sin
// relleno (43 caracteres). La base guarda sólo `reuniones.token_hash`, el sha256 de los 32 bytes, como literal bytea de
// PostgREST (`\x` + hex). El token nunca se guarda ni se registra.

const BYTES = 32
const FORMA = /^[A-Za-z0-9_-]{43}$/

type Dependencias = { azar?: (bytes: number) => Uint8Array }

export type TokenDeGestion = { token: string; hash: string }

const hashDeBytes = (bytes: Uint8Array) => `\\x${createHash('sha256').update(bytes).digest('hex')}`

export function generarTokenDeGestion(dependencias: Dependencias = {}): TokenDeGestion {
  const bytes = Buffer.from((dependencias.azar ?? randomBytes)(BYTES))
  return { token: bytes.toString('base64url'), hash: hashDeBytes(bytes) }
}

// El hash con que se busca la reunión, o `null` si el token no es el base64url canónico de 32 bytes. Con `null` la ruta
// responde «Este enlace no es válido.», lo mismo que con un token que no existe.
export function hashDeTokenDeGestion(token: string): string | null {
  if (!FORMA.test(token)) return null
  const bytes = Buffer.from(token, 'base64url')
  if (bytes.length !== BYTES || bytes.toString('base64url') !== token) return null
  return hashDeBytes(bytes)
}
