// Cómo se escriben las fechas, los nombres y los textos largos en los correos. Las fechas salen de `fechas.ts` (nunca a mano). Hasta que
// `fechas.ts` sepa escribir el día de la semana (§6.8: «mar 3 nov, 10:00»), va «3 nov 2026, 10:00»: se cambia aquí, en un solo archivo.
import { ZONA_POR_DEFECTO, formatearFechaHora } from '@/shared/lib/fechas'

export const ZONA_DEL_EQUIPO = ZONA_POR_DEFECTO
export const LARGO_MAXIMO_EN_ASUNTO = 80

// Al visitante, en su zona y sin rótulo.
export function fechaParaVisitante(iso: string, zona: string): string {
  return formatearFechaHora(iso, { zona })
}

// Al anfitrión y al equipo, en la hora de Bolivia, con el rótulo (§5.1).
export function fechaParaEquipo(iso: string): string {
  return `${formatearFechaHora(iso, { zona: ZONA_DEL_EQUIPO })} (hora de Bolivia)`
}

// Corta un texto de la persona para que quepa en un asunto: termina en «…» si se cortó.
export function cortarParaAsunto(texto: string, maximo: number = LARGO_MAXIMO_EN_ASUNTO): string {
  const limpio = texto.replace(/\s+/g, ' ').trim()
  const letras = Array.from(limpio)
  return letras.length <= maximo
    ? limpio
    : `${letras
        .slice(0, maximo - 1)
        .join('')
        .trimEnd()}…`
}

// «importadora o nombre» de §6.8.
export function importadoraONombre(importadora: string | null | undefined, nombre: string): string {
  return cortarParaAsunto(importadora?.trim() ? importadora : nombre)
}
