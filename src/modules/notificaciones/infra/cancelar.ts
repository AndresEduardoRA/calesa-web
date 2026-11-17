// Cancelar los correos programados: uno por referencia, o todos los de una reunión o una solicitud (al cambiarla o cancelarla, X6). Con
// Resend se cancelan en el proveedor; los que no tienen `resendId` (local, e2e) sólo se marcan.
import { ok, type Resultado } from '../../../shared/lib/errores'
import type { FilaDeCorreo, Quien } from '../entities/registro'
import type { Dependencias } from './nucleo'

// Los programados de una reunión o una solicitud son pocos (24 h, 1 h × 2, aviso, meet): un tope de sobra, sin paginar.
const TOPE_DE_PROGRAMADOS = 50

export type ResultadoDeCancelacion = {
  cancelados: number
  // Resend ya los mandó a su hora: no hay nada que cancelar.
  yaSalieron: number
  fallidos: { id: string; error: string }[]
}

export function crearCancelaciones(deps: Dependencias) {
  const { registro } = deps
  const ahora = () => deps.reloj().getTime()

  async function cancelarFilas(filas: FilaDeCorreo[]): Promise<ResultadoDeCancelacion> {
    const salida: ResultadoDeCancelacion = { cancelados: 0, yaSalieron: 0, fallidos: [] }
    for (const fila of filas) {
      if (fila.estado !== 'programado') continue
      if (fila.resendId && Date.parse(fila.programadoPara ?? '') <= ahora()) {
        salida.yaSalieron += 1
        continue
      }
      const enProveedor = fila.resendId ? await deps.correo.cancelar(fila.resendId) : null
      if (enProveedor && !enProveedor.ok) {
        salida.fallidos.push({ id: fila.id, error: enProveedor.error.mensaje })
        continue
      }
      const marcada = await registro.marcarCancelado(fila.id)
      if (marcada.ok) salida.cancelados += 1
      else salida.fallidos.push({ id: fila.id, error: marcada.error.mensaje })
    }
    return salida
  }

  async function cancelarDe(quien: Quien): Promise<Resultado<ResultadoDeCancelacion>> {
    const filas = await registro.programadosDe(quien, TOPE_DE_PROGRAMADOS)
    return filas.ok ? ok(await cancelarFilas(filas.data)) : filas
  }

  async function cancelar(referencia: string): Promise<Resultado<ResultadoDeCancelacion>> {
    const fila = await registro.porReferencia(referencia)
    if (!fila.ok) return fila
    return ok(await cancelarFilas(fila.data ? [fila.data] : []))
  }

  return {
    cancelar,
    cancelarDeReunion: (reunionId: string) => cancelarDe({ reunionId }),
    cancelarDeSolicitud: (solicitudId: string) => cancelarDe({ solicitudId }),
  }
}
