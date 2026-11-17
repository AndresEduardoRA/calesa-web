// El registro de correos (`correos_salientes`, X6) como interfaz: lo que `infra/` necesita saber de dónde se guardan los correos. La base
// sólo se escribe por RPC (§3): el adaptador sobre las de P27 es `registroDeSupabase` (`infra/`, P29). Sólo tipos.
import type { Resultado } from '@/shared/lib/errores'

export type EstadoDeCorreo = 'enviado' | 'programado' | 'cancelado' | 'fallido'

// Una fila de `correos_salientes`, con los nombres de la tabla en camelCase.
export type FilaDeCorreo = {
  id: string
  para: string
  plantilla: string
  datos: Record<string, unknown>
  adjuntoIcs: string | null
  estado: EstadoDeCorreo
  resendId: string | null
  programadoPara: string | null
  intentos: number
  ultimoError: string | null
  enviadoEn: string | null
  referencia: string | null
  reunionId: string | null
  solicitudId: string | null
}

export type NuevaFila = Omit<FilaDeCorreo, 'id'>

export type Quien = { reunionId: string } | { solicitudId: string }

export interface RegistroDeCorreos {
  porReferencia(referencia: string): Promise<Resultado<FilaDeCorreo | null>>
  porId(id: string): Promise<Resultado<FilaDeCorreo | null>>
  // `duplicado` si la referencia ya está.
  registrar(nueva: NuevaFila): Promise<Resultado<FilaDeCorreo>>
  marcarEnviado(
    id: string,
    datos: { resendId: string | null; intentos: number; enviadoEn: string },
  ): Promise<Resultado<FilaDeCorreo>>
  marcarFallido(
    id: string,
    datos: { intentos: number; ultimoError: string },
  ): Promise<Resultado<FilaDeCorreo>>
  marcarCancelado(id: string): Promise<Resultado<FilaDeCorreo>>
  // Vuelve la fila a `programado` con su nueva hora; `resendId` undefined la deja como está.
  marcarReprogramado(
    id: string,
    programadoPara: string,
    resendId?: string | null,
  ): Promise<Resultado<FilaDeCorreo>>
  programadosDe(quien: Quien, tope: number): Promise<Resultado<FilaDeCorreo[]>>
  // Programados sin `resendId` (sin proveedor que los mande) con `programadoPara ≤ ahora`, los más viejos primero.
  vencidos(ahora: string, tope: number): Promise<Resultado<FilaDeCorreo[]>>
}
