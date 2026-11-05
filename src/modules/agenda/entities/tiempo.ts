// Tiempo de la agenda: intervalos semiabiertos y semanas ISO en la zona del proyecto.
// Los instantes entran como ISO y adentro son milisegundos (`Date.parse`).
import { diaEnZona, inicioDelDia, sumarDias } from '@/shared/lib/fechas'

export type Intervalo = { inicio: number; fin: number }

export const MS_POR_MINUTO = 60_000
export const MS_POR_HORA = 60 * MS_POR_MINUTO
export const MS_POR_DIA = 24 * MS_POR_HORA

// `[inicio, fin)`: tocarse en un borde no es cruzarse.
export function seCruzan(a: Intervalo, b: Intervalo): boolean {
  return a.inicio < b.fin && b.inicio < a.fin
}

// «17:30» → minutos desde las 00:00.
export function minutosDe(horaMinuto: string): number {
  const [horas = '0', minutos = '0'] = horaMinuto.split(':')
  return Number(horas) * 60 + Number(minutos)
}

// Día de la semana ISO de un día del calendario (`YYYY-MM-DD`): 1 = lunes … 7 = domingo.
export function diaIsoDeSemana(dia: string): number {
  const diaUtc = new Date(`${dia}T00:00:00Z`).getUTCDay()
  return diaUtc === 0 ? 7 : diaUtc
}

// La semana ISO (lunes 00:00 a lunes siguiente 00:00) que contiene a un instante, en la zona.
export function semanaIso(iso: string, zona: string): Intervalo {
  const dia = diaEnZona(iso, { zona })
  const lunes = sumarDias(dia, 1 - diaIsoDeSemana(dia))
  return {
    inicio: Date.parse(inicioDelDia(lunes, { zona })),
    fin: Date.parse(inicioDelDia(sumarDias(lunes, 7), { zona })),
  }
}
