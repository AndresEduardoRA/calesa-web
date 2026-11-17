// La entrada de servidor de `medicion`: las reglas puras de eventos, WhatsApp, embudo, cupos y latidos, y las lecturas del panel con la
// sesión de quien mira. Las rutas `GET /api/whatsapp` y `POST /api/eventos` son de P34. No hay `client.ts`: nada viaja al navegador.
export { esquemaEventoPublico, paginaDelEvento, type EventoPublico } from './entities/eventos'
export { TIPOS_DE_EVENTO_PUBLICOS, type TipoDeEventoPublico } from './entities/tipos-de-evento'
export {
  AVISO_SIN_WHATSAPP,
  enlaceDeWhatsApp,
  MENSAJE_DE_WHATSAPP,
  RUTA_SIN_WHATSAPP,
} from './entities/whatsapp'
export {
  type AlcanceDelEmbudo,
  type EmbudoDelEquipo,
  type EmbudoPropio,
  fuenteDelEmbudo,
  type FuenteDelEmbudo,
  mesEnZona,
  rangoDelMes,
  sumarEmbudoDelEquipo,
  sumarEmbudoPropio,
} from './entities/embudo'
export {
  type Cupo,
  evaluarCupos,
  textoDelAvisoDeCupo,
  UMBRAL_DE_BASE_BYTES,
  UMBRAL_DE_CORREOS_DIA,
} from './entities/cupos'
export {
  type EstadoDeTarea,
  estadoDeTarea,
  HORAS_SIN_LATIDO,
  type Latido,
  TAREA_DIARIA,
} from './entities/latidos'
export { type EmbudoDelMes, leerEmbudoDelMes } from './infra/queries/embudo'
export { leerLatidoDiario } from './infra/queries/latido'
