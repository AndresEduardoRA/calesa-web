import { createHash, timingSafeEqual } from 'node:crypto'

// Lo criptográfico que comparten las defensas del servidor. Importa de `node:crypto` (nunca `crypto` a secas): así lo
// intercepta el `vi.mock('node:crypto')` de las pruebas.

const resumen = (texto: string) => createHash('sha256').update(texto, 'utf8').digest()

export function sha256Hex(texto: string): string {
  return resumen(texto).toString('hex')
}

// Compara dos secretos sin dar pistas por el tiempo. `timingSafeEqual` exige el mismo largo, y cortar antes con largos
// distintos diría el largo del secreto: se comparan sus sha256, que siempre miden 32 bytes. Nunca lanza.
export function igualesEnTiempoConstante(a: string, b: string): boolean {
  return timingSafeEqual(resumen(a), resumen(b))
}
