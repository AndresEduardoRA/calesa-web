import { z } from 'zod'

// El mismo patrón que el check de `enlaces_prospeccion.codigo` (semilla §3): mayúsculas, números y guiones, de 2 a 20.
export const PATRON_CODIGO = /^[A-Z0-9-]{2,20}$/

export const MENSAJE_CODIGO_INVALIDO =
  'El código lleva de 2 a 20 letras de la A a la Z, números o guiones.'

// R4.19: el usuario escribe el código y se guarda en mayúsculas. Sólo pasa a mayúscula a-z ASCII: `toUpperCase()` general
// volvería «ß» en «SS» y «ı» en «I», y haría válido algo que la persona no escribió.
export function normalizarCodigo(texto: string): string {
  return texto.trim().replace(/[a-z]/g, (letra) => letra.toUpperCase())
}

export function esCodigoValido(codigo: string): boolean {
  return PATRON_CODIGO.test(codigo)
}

// Para el formulario del panel y la action que crea el enlace: entrega el código ya normalizado.
export const esquemaCodigoDeProspeccion = z
  .string()
  .transform(normalizarCodigo)
  .refine(esCodigoValido, { error: MENSAJE_CODIGO_INVALIDO })

// El `?ref` de `/agendar`: el código normalizado, o `null` si no es texto o está mal formado. No consulta la base: un código
// bien escrito pero inexistente o inactivo lo ignora la RPC (R4.19).
export function codigoDeRef(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const codigo = normalizarCodigo(valor)
  return esCodigoValido(codigo) ? codigo : null
}
