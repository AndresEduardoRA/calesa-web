import { ok } from '../errores'
import type { ContarEnvio } from './limites'

// El contrato de `ContarEnvio` (ventana fija) en memoria: la especificación ejecutable de la RPC de `limites` y el falso de las
// pruebas de quien limita. No es de producción: no se exporta en `index.ts` y se importa por su ruta.
export function crearContadorEnMemoria(reloj: () => Date = () => new Date()): ContarEnvio {
  const filas = new Map<string, { ventanaInicio: number; conteo: number }>()
  return ({ clave, maximo, ventanaSegundos }) => {
    const ahora = reloj().getTime()
    const fila = filas.get(clave)
    const nueva =
      !fila || ahora >= fila.ventanaInicio + ventanaSegundos * 1000
        ? { ventanaInicio: ahora, conteo: 1 }
        : { ventanaInicio: fila.ventanaInicio, conteo: fila.conteo + 1 }
    filas.set(clave, nueva)
    return Promise.resolve(ok(nueva.conteo <= maximo))
  }
}
