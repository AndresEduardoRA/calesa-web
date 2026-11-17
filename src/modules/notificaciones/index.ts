// Entrada de servidor de `notificaciones`: las 12 plantillas de correo (§6.8), el .ics, las referencias y los momentos de los recordatorios.
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
