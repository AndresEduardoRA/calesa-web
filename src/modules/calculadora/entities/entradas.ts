import { z } from 'zod'
import { campoEntero, campoMonto, cuandoPasaron } from './rangos'

// Los 5 datos que pide la calculadora al visitante (semilla §5.2, B4). Lo demás sale del panel (`config.ts`).

export const TIEMPOS_DE_RESPUESTA = ['h1', 'h4', 'dia', 'sig'] as const
export type TiempoRespuesta = (typeof TIEMPOS_DE_RESPUESTA)[number]

export const esquemaEntradasCalculadora = z
  .object({
    autos: campoEntero(1, 400),
    margen: campoMonto(100, 30000),
    consultas: campoEntero(10, 5000),
    respuesta: z.enum(TIEMPOS_DE_RESPUESTA, { error: 'Elige cuánto tardas en contestar.' }),
    administracion: campoEntero(1, 80),
  })
  .refine((e) => e.consultas >= e.autos, {
    error: 'Las consultas no pueden ser menos que los autos vendidos.',
    path: ['consultas'],
    when: cuandoPasaron('autos', 'consultas'),
  })

export type EntradasCalculadora = z.infer<typeof esquemaEntradasCalculadora>
