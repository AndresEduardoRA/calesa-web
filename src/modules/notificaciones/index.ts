// Entrada de servidor de `notificaciones`: las 12 plantillas de correo (§6.8), el .ics (también como adjunto), las referencias, los momentos de los recordatorios, el notificador (enviar, programar, cancelar, reprogramar) y el registro de correos sobre sus RPC.
import 'server-only'

export { PLANTILLAS, esquemaDatos } from './entities/datos'
export type { DatosDeCorreo, DatosDe, Plantilla, Reunion } from './entities/datos'
export type { Contexto, MetodoIcs, Organizador } from './entities/contenido'
export { renderizar } from './entities/render'
export type { CorreoRenderizado } from './entities/render'
export { armarIcs } from './entities/ics'
export { momentosDeRecordatorio } from './entities/recordatorios'
export type { MomentosDeRecordatorio } from './entities/recordatorios'
export { referenciaDe } from './entities/referencia'
export { crearNotificador } from './infra/notificador'
export type { Notificador, OpcionesDelNotificador } from './infra/notificador'
export { registroDeSupabase } from './infra/registro-de-supabase'
export type { ClienteDeCorreos } from './infra/registro-de-supabase'
export type { PuertoDeCorreo } from './infra/correo'
export type { ResultadoDeEnvio } from './infra/nucleo'
export type { ResultadoDeCancelacion } from './infra/cancelar'
export type { ResultadoDelDespacho } from './infra/enviar'
export type {
  EstadoDeCorreo,
  FilaDeCorreo,
  NuevaFila,
  Quien,
  RegistroDeCorreos,
} from './entities/registro'
