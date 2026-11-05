// Entrada de servidor de `agenda`: reglas puras de horas disponibles y zona del visitante.
export { horasDisponibles } from './entities/horas'
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
