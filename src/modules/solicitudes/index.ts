// Entrada de servidor de `solicitudes`: reglas puras de estados y de solicitudes repetidas.
export {
  CAMBIO_NO_PERMITIDO,
  ESTADOS_SOLICITUD,
  esquemaEstadoSolicitud,
  estadosPosibles,
  transicionPermitida,
} from './entities/estados'
export type {
  Actor,
  EfectoEnReunion,
  EstadoSolicitud,
  PeticionDeCambio,
  ResultadoCambio,
} from './entities/estados'
export {
  VENTANA_REPETIDAS_DIAS,
  esquemaCamposSolicitud,
  esquemaSolicitudAbierta,
  juntarSolicitud,
} from './entities/repetidas'
export type { CamposSolicitud, ResultadoJuntar, SolicitudAbierta } from './entities/repetidas'
