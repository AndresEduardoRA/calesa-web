// Qué puede hacer el visitante en `/reunion/<token>` (§5.8, B15, R4.16, D4). `ahora` es el reloj de la base (el `ahora` de
// `datos_para_horas`), el mismo con que `cambiar_reunion` decide el plazo: el borde vale (`ahora ≤ inicio − cancelar_hasta_horas`).
import type { ReunionDelToken } from './respuestas'

export const TEXTO_FUERA_DE_PLAZO = 'Ya no se puede cambiar en línea. Escríbenos por WhatsApp.'
export const TEXTO_CERRADA = 'Esta demo ya no está confirmada.'

export type EstadoDeGestion = 'cambiable' | 'fuera_de_plazo' | 'puede_volver_a_reservar' | 'cerrada'
export type Gestion = { estado: EstadoDeGestion; texto: string | null }

type ReunionParaGestion = Pick<
  ReunionDelToken,
  'estado' | 'cambiableHasta' | 'puedeVolverAReservar'
>

export function estadoDeGestion(reunion: ReunionParaGestion, ahora: string): Gestion {
  if (reunion.estado === 'confirmada') {
    // Escrito como «está dentro»: con un reloj inválido (`NaN`) falla cerrado.
    const dentro = Date.parse(ahora) <= Date.parse(reunion.cambiableHasta)
    return dentro
      ? { estado: 'cambiable', texto: null }
      : { estado: 'fuera_de_plazo', texto: TEXTO_FUERA_DE_PLAZO }
  }
  if (reunion.estado === 'cancelada' && reunion.puedeVolverAReservar) {
    return { estado: 'puede_volver_a_reservar', texto: null }
  }
  return { estado: 'cerrada', texto: TEXTO_CERRADA }
}
