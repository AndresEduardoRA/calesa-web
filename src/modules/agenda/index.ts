// Entrada de servidor de `agenda`: reglas puras de horas disponibles y zona del visitante, y los casos públicos (horas, reservar, gestionar).
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

// Los casos públicos de la agenda (P11): horas de una semana, reservar, leer, cambiar y cancelar. Sin ruta todavía (P36): el cliente de
// la base, los correos y los momentos de los recordatorios entran por `DependenciasPublicas`.
export { horasParaSemana } from './infra/casos/horas'
export type { DependenciasDeHoras, HorasDeUnaSemana } from './infra/casos/horas'
export { reservar } from './infra/casos/reservar'
export type { ReunionHecha } from './infra/casos/reservar'
export { cambiarReunion, cancelarReunion, leerReunion } from './infra/casos/gestionar'
export type { ReunionCancelada, ReunionLeida } from './infra/casos/gestionar'
export type {
  CorreosDeAgenda,
  DependenciasPublicas,
  MomentosDeRecordatorioDeAgenda,
} from './infra/casos/tipos'
export type { LlamarRpc, RpcDeAgenda } from './infra/rpc'
export { TEXTO_ENLACE_INVALIDO } from './infra/tokens'
export { TEXTO_SIN_HORAS, TEXTO_SIN_HORAS_SEMANA } from './entities/semana'
export type { DiaConHoras, VacioDeSemana } from './entities/semana'
export { TEXTO_CERRADA, TEXTO_FUERA_DE_PLAZO } from './entities/gestion'
export type { EstadoDeGestion, Gestion } from './entities/gestion'
