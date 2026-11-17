import type { Database } from '@/shared/types/database.types'

// Los latidos (R4.22): la última vez que corrió bien cada tarea programada. La tarea diaria se llama `diario`.
export const TAREA_DIARIA = 'diario'
export const HORAS_SIN_LATIDO = 26

export type Latido = Pick<
  Database['public']['Tables']['latidos']['Row'],
  'ultimo_ok' | 'ultimo_error' | 'fallos_seguidos' | 'creado_en'
>

export type EstadoDeTarea = {
  detenida: boolean
  // Desde cuándo no corre bien (ISO): su último éxito o, si nunca lo tuvo, cuando se creó su fila. `null` sin fila.
  desde: string | null
  ultimoError: string | null
  fallosSeguidos: number
}

const MS_SIN_LATIDO = HORAS_SIN_LATIDO * 3_600_000

// «Si no tuvo éxito en 26 h» (R4.22): justo 26 h no está detenida. Sin fila no hay de dónde contar: no hay banner (el despliegue
// crea la fila). Con la fila y sin éxito, las 26 h se cuentan desde que se creó.
export function estadoDeTarea(latido: Latido | null, ahora: Date): EstadoDeTarea {
  if (!latido) {
    return { detenida: false, desde: null, ultimoError: null, fallosSeguidos: 0 }
  }
  const desde = latido.ultimo_ok ?? latido.creado_en
  return {
    detenida: ahora.getTime() - new Date(desde).getTime() > MS_SIN_LATIDO,
    desde,
    ultimoError: latido.ultimo_error,
    fallosSeguidos: latido.fallos_seguidos,
  }
}
