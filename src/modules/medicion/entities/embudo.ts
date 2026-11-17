import { diaEnZona } from '@/shared/lib/fechas'
import type { Database } from '@/shared/types/database.types'

type Diaria = Database['public']['Tables']['metricas_diarias']['Row']
type Persona = Database['public']['Tables']['metricas_persona']['Row']

export type FilaDiaria = Pick<
  Diaria,
  | 'solicitudes'
  | 'reuniones_reservadas'
  | 'reuniones_realizadas'
  | 'ganadas'
  | 'clics_whatsapp'
  | 'calculadoras'
>
export type FilaPersona = Pick<
  Persona,
  'solicitudes_asignadas' | 'reuniones_reservadas' | 'reuniones_realizadas' | 'ganadas'
>

export type EmbudoDelEquipo = {
  solicitudes: number
  reunionesReservadas: number
  reunionesRealizadas: number
  ganadas: number
  clicsWhatsapp: number
  calculadoras: number
}
export type EmbudoPropio = Omit<EmbudoDelEquipo, 'clicsWhatsapp' | 'calculadoras'>

// El alcance de `metricas.ver` de quien mira; `null` es que no la tiene. Lo da quien llama (`puede()` de `acceso`).
export type AlcanceDelEmbudo = 'todos' | 'propio' | null
export type FuenteDelEmbudo = 'equipo' | 'propio'

// El mes (`YYYY-MM`) en que cae un instante, en la zona del proyecto (America/La_Paz).
export function mesEnZona(iso: string): string {
  return diaEnZona(iso).slice(0, 7)
}

const PATRON_DE_MES = /^(\d{4})-(0[1-9]|1[0-2])$/

// De `YYYY-MM` al primer día y al primer día del mes siguiente (exclusivo); `null` si no es un mes.
export function rangoDelMes(mes: string): { desde: string; hasta: string } | null {
  const partes = PATRON_DE_MES.exec(mes)
  if (!partes) {
    return null
  }
  const anio = Number(partes[1])
  const numero = Number(partes[2])
  const siguiente =
    numero === 12 ? `${anio + 1}-01` : `${partes[1]}-${String(numero + 1).padStart(2, '0')}`
  return { desde: `${mes}-01`, hasta: `${siguiente}-01` }
}

export function sumarEmbudoDelEquipo(filas: readonly FilaDiaria[]): EmbudoDelEquipo {
  const total: EmbudoDelEquipo = {
    solicitudes: 0,
    reunionesReservadas: 0,
    reunionesRealizadas: 0,
    ganadas: 0,
    clicsWhatsapp: 0,
    calculadoras: 0,
  }
  for (const fila of filas) {
    total.solicitudes += fila.solicitudes
    total.reunionesReservadas += fila.reuniones_reservadas
    total.reunionesRealizadas += fila.reuniones_realizadas
    total.ganadas += fila.ganadas
    total.clicsWhatsapp += fila.clics_whatsapp
    total.calculadoras += fila.calculadoras
  }
  return total
}

export function sumarEmbudoPropio(filas: readonly FilaPersona[]): EmbudoPropio {
  const total: EmbudoPropio = {
    solicitudes: 0,
    reunionesReservadas: 0,
    reunionesRealizadas: 0,
    ganadas: 0,
  }
  for (const fila of filas) {
    total.solicitudes += fila.solicitudes_asignadas
    total.reunionesReservadas += fila.reuniones_reservadas
    total.reunionesRealizadas += fila.reuniones_realizadas
    total.ganadas += fila.ganadas
  }
  return total
}

// De dónde se lee el embudo (`datos.md`: lo decide `entities/`, no cada pantalla). La base sigue decidiendo qué se ve (RLS).
export function fuenteDelEmbudo(alcance: AlcanceDelEmbudo): FuenteDelEmbudo | null {
  if (alcance === 'todos') {
    return 'equipo'
  }
  return alcance === 'propio' ? 'propio' : null
}
