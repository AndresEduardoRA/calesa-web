// Entrada de servidor de `agenda`: reglas puras de horas disponibles y zona del visitante.
export { HORA_OCUPADA, elegirAnfitrion } from './entities/anfitrion'
export type { EntradaAnfitrion, ResultadoAnfitrion } from './entities/anfitrion'
export { horasDisponibles } from './entities/horas'
export { repartoParejo } from './entities/reparto'
export type { CandidatoReparto } from './entities/reparto'
export { esZonaValida, esquemaZona, horasParaVisitante } from './entities/zona'
export type { HoraParaVisitante } from './entities/zona'
export {
  esquemaBloqueo,
  esquemaConfigAgenda,
  esquemaEntradaAgenda,
  esquemaPersona,
  esquemaReunion,
  esquemaTramo,
} from './entities/config'
export type {
  Bloqueo,
  ConfigAgenda,
  EntradaAgenda,
  Persona,
  Reunion,
  Tramo,
} from './entities/config'
