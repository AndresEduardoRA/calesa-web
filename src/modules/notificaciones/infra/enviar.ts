// Enviar un correo en el momento (los de evento: reserva, cambio, cancelación, avisos) con 2 reintentos, y mandar lo que quedó en el registro
// sin proveedor que lo programe (`despacharVencidos`). El correo se registra DESPUÉS de mandarlo: la tabla no tiene estado «pendiente».
// Un correo que no salió no tumba la acción que lo pidió: queda `fallido` y se avisa al equipo, una vez y sin cadena.
import { ok, type Resultado } from '@/shared/lib/errores'
import type { FilaDeCorreo } from '../entities/registro'
import { conReintentos } from '../entities/reintentos'
import {
  avisaDelFallo,
  cerrarSalida,
  prepararDesdeDatos,
  prepararDesdeFila,
  resultadoDelKit,
  resumen,
  type Dependencias,
  type ResultadoDeEnvio,
} from './nucleo'

// Un lote del despacho cabe en una petición del cron (P13); si hubo más, `hayMas` y otra llamada.
export const TOPE_DE_LOTE = 50

export type EntradaDeEnvio = { para?: string; datos: unknown }
export type ResultadoDelDespacho = { enviados: number; fallidos: number; hayMas: boolean }

export function crearEnvios(deps: Dependencias) {
  const { registro } = deps

  async function enviarAhora(entrada: EntradaDeEnvio): Promise<Resultado<ResultadoDeEnvio>> {
    const armado = prepararDesdeDatos(entrada, deps)
    if (!armado.ok) return armado
    const correo = armado.data
    const previa = await registro.porReferencia(correo.referencia)
    if (!previa.ok) return previa
    if (previa.data) return ok(resumen(previa.data, true))
    const { resultado, intentos } = await conReintentos(
      () => deps.correo.enviar(correo.mensaje),
      deps.esperar,
    )
    return cerrarSalida(
      deps,
      { correo, salida: resultadoDelKit(resultado), intentos, cuando: null },
      avisarFallo,
    )
  }

  // Avisa a `EMAIL_AVISOS` de un correo que quedó `fallido`. Si el que falla es el aviso mismo, no dispara otro. Es de mejor esfuerzo:
  // si el aviso falla, el fallo original ya quedó registrado.
  async function avisarFallo(fila: FilaDeCorreo): Promise<void> {
    if (fila.plantilla === 'correo-fallido') return
    await enviarAhora({
      datos: {
        plantilla: 'correo-fallido',
        correoId: fila.id,
        plantillaFallida: fila.plantilla,
        paraFallido: fila.para,
        ultimoError: fila.ultimoError ?? 'Sin detalle.',
        intentos: fila.intentos,
        reunionId: fila.reunionId ?? undefined,
        solicitudId: fila.solicitudId ?? undefined,
      },
    })
  }

  // Manda una fila que ya está en el registro (reintento o vencido) y la marca; suma los intentos que tenía.
  async function reenviar(fila: FilaDeCorreo): Promise<Resultado<FilaDeCorreo>> {
    const armado = prepararDesdeFila(fila, deps)
    if (!armado.ok)
      return registro.marcarFallido(fila.id, {
        intentos: fila.intentos,
        ultimoError: armado.error.mensaje,
      })
    const { resultado, intentos } = await conReintentos(
      () => deps.correo.enviar(armado.data.mensaje),
      deps.esperar,
    )
    const total = fila.intentos + intentos
    const salida = resultadoDelKit(resultado)
    const marcada = salida.ok
      ? await registro.marcarEnviado(fila.id, {
          resendId: salida.resendId,
          intentos: total,
          enviadoEn: deps.reloj().toISOString(),
        })
      : await registro.marcarFallido(fila.id, {
          intentos: total,
          ultimoError: salida.error.mensaje,
        })
    if (marcada.ok && avisaDelFallo(salida)) await avisarFallo(marcada.data)
    return marcada
  }

  async function despacharVencidos(): Promise<Resultado<ResultadoDelDespacho>> {
    const vencidos = await registro.vencidos(deps.reloj().toISOString(), TOPE_DE_LOTE)
    if (!vencidos.ok) return vencidos
    let enviados = 0
    let fallidos = 0
    for (const fila of vencidos.data) {
      const marcada = await reenviar(fila)
      if (marcada.ok && marcada.data.estado === 'enviado') enviados += 1
      else fallidos += 1
    }
    return ok({ enviados, fallidos, hayMas: vencidos.data.length === TOPE_DE_LOTE })
  }

  return { enviarAhora, avisarFallo, reenviar, despacharVencidos }
}
