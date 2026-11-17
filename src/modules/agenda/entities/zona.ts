// La zona del visitante (X1, R4.13): se acepta cualquier zona IANA válida y las horas de La Paz
// se muestran convertidas. Las horas viajan siempre como ISO; la conversión es sólo de presentación.
import { z } from 'zod'
import { ZONA_POR_DEFECTO, diaEnZona, formatearHora } from '@/shared/lib/fechas'

// `Intl` acepta también desfases como «+05:00», que no son zonas IANA: se descartan aparte.
export function esZonaValida(zona: string): boolean {
  if (zona === '' || zona.startsWith('+') || zona.startsWith('-')) {
    return false
  }
  try {
    new Intl.DateTimeFormat('es', { timeZone: zona })
    return true
  } catch {
    return false
  }
}

export const esquemaZona = z
  .string()
  .refine(esZonaValida, { error: 'Elige una zona horaria válida.' })

export type HoraParaVisitante = { inicio: string; dia: string; hora: string }

// Cada inicio (ISO) con su día y su hora en la zona del visitante. Con una zona inválida usa
// la de La Paz, que es la del horario: nunca lanza.
export function horasParaVisitante(horas: string[], zona: string): HoraParaVisitante[] {
  const zonaVisitante = esZonaValida(zona) ? zona : ZONA_POR_DEFECTO
  return horas.map((inicio) => ({
    inicio,
    dia: diaEnZona(inicio, { zona: zonaVisitante }),
    hora: formatearHora(inicio, { zona: zonaVisitante }),
  }))
}
