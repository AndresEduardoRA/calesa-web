// Las horas de una semana para el visitante (§6.4 paso 2, D4, X1, R4.13): la semana ISO, de lunes 00:00 a lunes 00:00, en la zona del
// visitante; y las horas agrupadas por día, con el día una sola vez (la respuesta de horas cabe en 20 KB: docs/RENDIMIENTO.md).
import { ZONA_POR_DEFECTO, diaEnZona, inicioDelDia, sumarDias } from '@/shared/lib/fechas'
import { semanaIso } from './tiempo'
import { esZonaValida, type HoraParaVisitante } from './zona'

export const TEXTO_SIN_HORAS_SEMANA = 'No hay horas libres esta semana. Mira la siguiente.'
export const TEXTO_SIN_HORAS = 'Ahora no tenemos horas libres. Escríbenos por WhatsApp.'

// `semana`: sin horas en esta semana pero con alguna en el horizonte; `horizonte`: ninguna en los días que abre la agenda.
export type VacioDeSemana = 'semana' | 'horizonte' | null

export type HorasDeLaSemana = {
  desde: string
  hasta: string
  horas: string[]
  haySiguiente: boolean
  vacio: VacioDeSemana
}

export type DiaConHoras = { dia: string; horas: { inicio: string; hora: string }[] }

// `horas`: los inicios ofrecidos (ISO). `semana`: cualquier día `AAAA-MM-DD` de la semana pedida. Con una zona inválida usa la de
// La Paz, como `horasParaVisitante`: nunca lanza por la zona.
export function horasDeLaSemana(horas: string[], semana: string, zona: string): HorasDeLaSemana {
  const zonaVisitante = esZonaValida(zona) ? zona : ZONA_POR_DEFECTO
  const { inicio, fin } = semanaIso(inicioDelDia(semana, { zona: zonaVisitante }), zonaVisitante)
  const desde = diaEnZona(new Date(inicio).toISOString(), { zona: zonaVisitante })
  const enLaSemana = horas.filter((h) => Date.parse(h) >= inicio && Date.parse(h) < fin)
  const vacio = enLaSemana.length > 0 ? null : horas.length > 0 ? 'semana' : 'horizonte'
  return {
    desde,
    hasta: sumarDias(desde, 6),
    horas: enLaSemana,
    haySiguiente: horas.some((h) => Date.parse(h) >= fin),
    vacio,
  }
}

// En orden de inicio y sin días vacíos.
export function agruparPorDia(horas: HoraParaVisitante[]): DiaConHoras[] {
  const ordenadas = [...horas].sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio))
  const dias = new Map<string, DiaConHoras>()
  for (const { inicio, dia, hora } of ordenadas) {
    const delDia = dias.get(dia) ?? { dia, horas: [] }
    delDia.horas.push({ inicio, hora })
    dias.set(dia, delDia)
  }
  return [...dias.values()]
}
