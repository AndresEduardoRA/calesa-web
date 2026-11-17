// Lo que comparten las plantillas de reunión: la fecha según quién lee, y los enlaces del panel. Sólo funciones puras.
import type { Reunion } from '../datos'
import { fechaParaEquipo, fechaParaVisitante } from '../formato-correo'

export type Lector = 'visitante' | 'equipo'

export function fechaDe(iso: string, reunion: Reunion, lector: Lector): string {
  return lector === 'visitante'
    ? fechaParaVisitante(iso, reunion.zonaVisitante)
    : fechaParaEquipo(iso)
}

export function minutosDeDuracion(reunion: Reunion): number {
  return Math.round((Date.parse(reunion.fin) - Date.parse(reunion.inicio)) / 60_000)
}

export const enlaceDeSolicitud = (sitio: string, solicitudId: string): string =>
  `${sitio}/panel/solicitudes/${solicitudId}`

export const enlaceDeActividad = (sitio: string): string => `${sitio}/panel/actividad`

export const FRASE_SIN_GESTION =
  'Para cambiar o cancelar, usa el enlace del correo de confirmación.'
