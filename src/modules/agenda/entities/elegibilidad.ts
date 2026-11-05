// Quién puede atender una hora (§5.5). Los intervalos son `[inicio, fin)`.
import { diaEnZona } from '@/shared/lib/fechas'
import type { EntradaAgenda, Persona, Reunion } from './config'
import { MS_POR_DIA, MS_POR_MINUTO, seCruzan } from './tiempo'

const tiene = (texto: string | null): boolean => texto !== null && texto !== ''

function ocupadas(persona: Persona, entrada: EntradaAgenda): Reunion[] {
  return entrada.reuniones.filter(
    (r) =>
      r.anfitrionId === persona.id &&
      r.estado === 'confirmada' &&
      r.id !== entrada.excluirReunionId,
  )
}

function sinBloqueo(
  persona: Persona,
  entrada: EntradaAgenda,
  inicio: number,
  fin: number,
): boolean {
  return !entrada.bloqueos.some(
    (b) =>
      b.perfilId === persona.id &&
      seCruzan({ inicio: Date.parse(b.inicio), fin: Date.parse(b.fin) }, { inicio, fin }),
  )
}

// La reunión ocupa hasta `fin + descanso`; la hora candidata también pide su descanso.
function sinReunionCruzada(
  reuniones: Reunion[],
  inicio: number,
  duracion: number,
  descanso: number,
) {
  const candidata = { inicio, fin: inicio + duracion + descanso }
  return !reuniones.some((r) =>
    seCruzan({ inicio: Date.parse(r.inicio), fin: Date.parse(r.fin) + descanso }, candidata),
  )
}

// Reuniones del mismo día de la zona de la config. Sólo calcula el día de las cercanas.
function reunionesDelDia(reuniones: Reunion[], hora: string, entrada: EntradaAgenda): number {
  const h = Date.parse(hora)
  const dia = diaEnZona(hora, { zona: entrada.config.zonaHoraria })
  return reuniones.filter(
    (r) =>
      Math.abs(Date.parse(r.inicio) - h) < 2 * MS_POR_DIA &&
      diaEnZona(r.inicio, { zona: entrada.config.zonaHoraria }) === dia,
  ).length
}

export function esElegible(persona: Persona, hora: string, entrada: EntradaAgenda): boolean {
  if (
    !persona.activo ||
    !persona.enTurno ||
    !tiene(persona.whatsapp) ||
    !tiene(persona.enlaceMeet)
  ) {
    return false
  }
  const { duracionMin, descansoMin, maxReunionesDia } = entrada.config
  const inicio = Date.parse(hora)
  const duracion = duracionMin * MS_POR_MINUTO
  const reuniones = ocupadas(persona, entrada)
  return (
    sinBloqueo(persona, entrada, inicio, inicio + duracion) &&
    sinReunionCruzada(reuniones, inicio, duracion, descansoMin * MS_POR_MINUTO) &&
    reunionesDelDia(reuniones, hora, entrada) < maxReunionesDia
  )
}

// Los ids de quien puede atender `hora`, en el orden de `personas`. Con `limitarA` activo, sólo esa
// persona (R4.1, R4.20). Si no: los vendedores elegibles y, si no hay ninguno, los admins (R1.2, R4.9).
export function candidatosPara(hora: string, entrada: EntradaAgenda): string[] {
  const elegibles = (rol: Persona['rol']) =>
    entrada.personas.filter((p) => p.rol === rol && esElegible(p, hora, entrada)).map((p) => p.id)
  const limitada = entrada.personas.find((p) => p.id === entrada.limitarA && p.activo)
  if (limitada) {
    return esElegible(limitada, hora, entrada) ? [limitada.id] : []
  }
  const vendedores = elegibles('vendedor')
  return vendedores.length > 0 ? vendedores : elegibles('admin')
}
