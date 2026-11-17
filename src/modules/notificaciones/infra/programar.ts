// Programar y reprogramar los correos (cancelar, en `cancelar.ts`) que salen a su hora (recordatorios de 24 h y 1 h, aviso de 15 min; X6). Con Resend se
// programan en el proveedor (`scheduledAt`) y se cancelan o reprograman allá; sin él (local, e2e) se guardan y los manda `despacharVencidos`.
import { fallo, ok, type Resultado } from '../../../shared/lib/errores'
import { esquemaDeCuando } from '../../../shared/lib/email/tipos'
import type { FilaDeCorreo } from '../entities/registro'
import { conReintentos } from '../entities/reintentos'
import {
  cerrarSalida,
  prepararDesdeDatos,
  prepararDesdeFila,
  resultadoDelKit,
  resumen,
  type Dependencias,
  type ResultadoDeEnvio,
} from './nucleo'

export type EntradaDeProgramacion = { para?: string; datos: unknown; cuando: string }
const MENSAJE_HORA = 'El correo no se programó: la hora no es ISO 8601 con zona.'
const MENSAJE_NO_REPROGRAMA = 'Un correo cancelado o enviado no se puede reprogramar.'

export function crearProgramaciones(
  deps: Dependencias,
  avisarFallo: (fila: FilaDeCorreo) => Promise<void>,
) {
  const { registro } = deps
  const ahora = () => deps.reloj().getTime()

  async function programar(entrada: EntradaDeProgramacion): Promise<Resultado<ResultadoDeEnvio>> {
    if (!esquemaDeCuando.safeParse(entrada.cuando).success) return fallo('validacion', MENSAJE_HORA)
    const armado = prepararDesdeDatos(entrada, deps)
    if (!armado.ok) return armado
    // Un momento que ya pasó no se programa: ni red ni registro.
    if (Date.parse(entrada.cuando) <= ahora())
      return ok({ id: null, estado: 'omitido', yaEstaba: false })
    const correo = armado.data
    const previa = await registro.porReferencia(correo.referencia)
    if (!previa.ok) return previa
    if (previa.data) return ok(resumen(previa.data, true))
    const cuando = entrada.cuando
    if (!deps.correo.programa())
      return cerrarSalida(
        deps,
        { correo, salida: { ok: true, resendId: null }, intentos: 0, cuando },
        avisarFallo,
      )
    const { resultado, intentos } = await conReintentos(
      () => deps.correo.programar(correo.mensaje, cuando),
      deps.esperar,
    )
    return cerrarSalida(
      deps,
      { correo, salida: resultadoDelKit(resultado), intentos, cuando },
      avisarFallo,
    )
  }

  async function reprogramar(
    referencia: string,
    cuando: string,
  ): Promise<Resultado<ResultadoDeEnvio>> {
    if (!esquemaDeCuando.safeParse(cuando).success) return fallo('validacion', MENSAJE_HORA)
    const fila = await registro.porReferencia(referencia)
    if (!fila.ok) return fila
    if (!fila.data) return fallo('no_encontrado', 'No hay un correo con esa referencia.')
    if (fila.data.estado !== 'programado') return fallo('regla', MENSAJE_NO_REPROGRAMA)
    if (fila.data.resendId) {
      const enProveedor = await deps.correo.reprogramar(fila.data.resendId, cuando)
      if (!enProveedor.ok) return enProveedor
    }
    const marcada = await registro.marcarReprogramado(fila.data.id, cuando)
    return marcada.ok ? ok(resumen(marcada.data, false)) : marcada
  }

  // Un `fallido` que todavía tiene su hora por delante vuelve a programarse (no sale antes de tiempo).
  async function volverAProgramar(
    fila: FilaDeCorreo,
    cuando: string,
  ): Promise<Resultado<FilaDeCorreo>> {
    if (!deps.correo.programa()) return registro.marcarReprogramado(fila.id, cuando, null)
    const armado = prepararDesdeFila(fila, deps)
    if (!armado.ok)
      return registro.marcarFallido(fila.id, {
        intentos: fila.intentos,
        ultimoError: armado.error.mensaje,
      })
    const { resultado, intentos } = await conReintentos(
      () => deps.correo.programar(armado.data.mensaje, cuando),
      deps.esperar,
    )
    const total = fila.intentos + intentos
    return resultado.ok
      ? registro.marcarReprogramado(fila.id, cuando, resultado.data.id)
      : registro.marcarFallido(fila.id, { intentos: total, ultimoError: resultado.error.mensaje })
  }

  return {
    programar,
    reprogramar,
    volverAProgramar,
  }
}
