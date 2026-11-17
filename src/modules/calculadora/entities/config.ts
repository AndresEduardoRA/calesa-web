import { z } from 'zod'

import { fallo, MENSAJE_INESPERADO, ok, type Resultado } from '@/shared/lib/errores'

import { campoEntero, campoMonto } from './rangos'

// Los datos del panel que usa la calculadora (`config_calculadora`, semilla §3 y §5.2). Las claves son las columnas de la tabla, así
// se valida la fila tal cual. No hay valores por defecto aquí: salen de la base.

export const VOLATILIDADES = ['baja', 'media', 'alta'] as const
export type Volatilidad = (typeof VOLATILIDADES)[number]

export const esquemaConfigCalculadora = z.object({
  precio: campoMonto(3000, 150000),
  pct_sena: campoEntero(0, 100),
  sena: campoMonto(0, 30000),
  moneda_local: z.boolean({ error: 'Elige sí o no.' }),
  pct_local: campoEntero(0, 100),
  volatilidad: z.enum(VOLATILIDADES, { error: 'Elige la volatilidad.' }),
  sueldo: campoMonto(200, 5000),
  tasa: campoEntero(0, 40),
  ciclo_dias: campoEntero(20, 240),
})

export type ConfigCalculadora = z.infer<typeof esquemaConfigCalculadora>

// La etiqueta de la caché de la lectura pública (`infra/queries/config-publica.ts`). La invalida el panel al guardar (P21).
export const ETIQUETA_DE_CONFIG = 'calculadora'

// La respuesta de `publico.config_calculadora()`, que llega sin tipo (`db:types` no genera el esquema `publico`): sirve sólo un
// arreglo con exactamente una fila válida. Cualquier otra cosa es un error nuestro, no algo que el visitante pueda arreglar.
export function leerFilaDeConfig(datos: unknown): Resultado<ConfigCalculadora> {
  if (!Array.isArray(datos) || datos.length !== 1) return fallo('inesperado', MENSAJE_INESPERADO)
  const fila = esquemaConfigCalculadora.safeParse(datos[0])
  return fila.success ? ok(fila.data) : fallo('inesperado', MENSAJE_INESPERADO)
}
