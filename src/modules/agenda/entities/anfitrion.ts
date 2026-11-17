// Quién atiende una reunión (§5.6): el asignado si está libre (X5); si no, reparto parejo.
import type { EntradaAgenda, Persona } from './config'
import { candidatosPara } from './elegibilidad'
import { horasDisponibles } from './horas'
import { repartoParejo } from './reparto'
import { semanaIso } from './tiempo'

export const HORA_OCUPADA = 'Esa hora se acaba de ocupar. Elige otra.'

export type EntradaAnfitrion = EntradaAgenda & {
  // La hora de inicio (ISO) que se quiere reservar.
  h: string
  asignadoA: string | null
}

export type ResultadoAnfitrion =
  { ok: true; anfitrionId: string; cambiaAsignado: boolean } | { ok: false; error: string }

// Reuniones confirmadas de la persona en la semana ISO de `h` (lunes a domingo, en la zona).
function reunionesDeLaSemana(persona: Persona, entrada: EntradaAnfitrion): number {
  const semana = semanaIso(entrada.h, entrada.config.zonaHoraria)
  return entrada.reuniones.filter((r) => {
    const inicio = Date.parse(r.inicio)
    return (
      r.anfitrionId === persona.id &&
      r.estado === 'confirmada' &&
      r.id !== entrada.excluirReunionId &&
      inicio >= semana.inicio &&
      inicio < semana.fin
    )
  }).length
}

export function elegirAnfitrion(entrada: EntradaAnfitrion): ResultadoAnfitrion {
  const ocupada: ResultadoAnfitrion = { ok: false, error: HORA_OCUPADA }
  // Se compara por instante: `h` puede llegar con `Z`, con `+00:00` o con el desfase del visitante.
  const h = Date.parse(entrada.h)
  if (!horasDisponibles(entrada).some((hora) => Date.parse(hora) === h)) {
    return ocupada
  }
  const candidatos = candidatosPara(entrada.h, entrada)
  const anfitrionId = candidatos.includes(entrada.asignadoA ?? '')
    ? entrada.asignadoA
    : repartoParejo(
        entrada.personas
          .filter((p) => candidatos.includes(p.id))
          .map((p) => ({
            id: p.id,
            conteo: reunionesDeLaSemana(p, entrada),
            ultimaEn: p.ultimaReunionEn,
            creadoEn: p.creadoEn,
          })),
      )
  return anfitrionId === null
    ? ocupada
    : { ok: true, anfitrionId, cambiaAsignado: anfitrionId !== entrada.asignadoA }
}
