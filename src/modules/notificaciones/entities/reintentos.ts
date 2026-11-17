// Los reintentos de un envío: 3 intentos (2 reintentos), esperando 300 y 900 ms. Sólo se reintenta lo que puede arreglarse solo: un fallo
// del proveedor o de la red (`inesperado`). Un `validacion`, `regla`, `conflicto` o `no_encontrado` repetido da lo mismo.
import type { CodigoError, Resultado } from '../../../shared/lib/errores'

export const ESPERAS_ENTRE_INTENTOS_MS = [300, 900] as const
export const INTENTOS_MAXIMOS = ESPERAS_ENTRE_INTENTOS_MS.length + 1

export function esReintentable(codigo: CodigoError): boolean {
  return codigo === 'inesperado'
}

export async function conReintentos<T>(
  intento: () => Promise<Resultado<T>>,
  esperar: (ms: number) => Promise<void>,
): Promise<{ resultado: Resultado<T>; intentos: number }> {
  let resultado = await intento()
  let intentos = 1
  for (const espera of ESPERAS_ENTRE_INTENTOS_MS) {
    if (resultado.ok || !esReintentable(resultado.error.codigo)) break
    await esperar(espera)
    resultado = await intento()
    intentos += 1
  }
  return { resultado, intentos }
}
