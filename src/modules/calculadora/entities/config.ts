import { z } from 'zod'
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
