// Lo que la agenda lee de la base (config_agenda, horario_base, perfiles, bloqueos, reuniones)
// y los tipos de sus reglas. Los parsea quien lee la base: las funciones puras no vuelven a validar.
import { z } from 'zod'
import { esquemaZona } from './zona'

const instante = z.iso.datetime({ offset: true })
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: 'Usa el formato HH:MM.' })

export const esquemaConfigAgenda = z.object({
  duracionMin: z.number().int().min(15).max(120),
  descansoMin: z.number().int().min(0).max(60),
  anticipacionMinHoras: z.number().int().min(0).max(168),
  horizonteDias: z.number().int().min(1).max(60),
  maxReunionesDia: z.number().int().min(1).max(12),
  cancelarHastaHoras: z.number().int().min(0).max(48),
  zonaHoraria: esquemaZona,
})

// `diaSemana` ISO: 1 = lunes … 7 = domingo.
export const esquemaTramo = z
  .object({
    diaSemana: z.number().int().min(1).max(7),
    desde: hora,
    hasta: hora,
  })
  .refine((tramo) => tramo.desde < tramo.hasta, {
    error: 'El tramo debe terminar después de empezar.',
  })

export const esquemaPersona = z.object({
  id: z.guid(),
  rol: z.enum(['admin', 'vendedor']),
  activo: z.boolean(),
  enTurno: z.boolean(),
  whatsapp: z.string().nullable(),
  enlaceMeet: z.string().nullable(),
  creadoEn: instante,
  // Inicio de su última reunión no cancelada (desempate del reparto parejo).
  ultimaReunionEn: instante.nullable(),
})

export const esquemaBloqueo = z
  .object({ perfilId: z.guid(), inicio: instante, fin: instante })
  .refine((bloqueo) => Date.parse(bloqueo.fin) > Date.parse(bloqueo.inicio), {
    error: 'El bloqueo debe terminar después de empezar.',
  })

export const esquemaReunion = z.object({
  id: z.guid(),
  anfitrionId: z.guid(),
  inicio: instante,
  fin: instante,
  estado: z.enum(['confirmada', 'cancelada', 'realizada', 'no_asistio']),
})

export const esquemaEntradaAgenda = z.object({
  ahora: instante,
  config: esquemaConfigAgenda,
  horarioBase: z.array(esquemaTramo),
  personas: z.array(esquemaPersona),
  bloqueos: z.array(esquemaBloqueo),
  reuniones: z.array(esquemaReunion),
  // Reagendar o enlace de prospección: el único candidato posible.
  limitarA: z.guid().nullable().optional(),
  // La reunión que se está cambiando: no cuenta como ocupada.
  excluirReunionId: z.guid().nullable().optional(),
})

export type ConfigAgenda = z.infer<typeof esquemaConfigAgenda>
export type Tramo = z.infer<typeof esquemaTramo>
export type Persona = z.infer<typeof esquemaPersona>
export type Bloqueo = z.infer<typeof esquemaBloqueo>
export type Reunion = z.infer<typeof esquemaReunion>
export type EntradaAgenda = z.infer<typeof esquemaEntradaAgenda>
