import { entornoDelServidor, type EntornoDelServidor } from '../../config/servidor'
import { igualesEnTiempoConstante } from './cripto'

type Dependencias = { entorno?: EntornoDelServidor }

// `/api/cron/*` sólo corre si la cabecera `Authorization` es exactamente `Bearer <CRON_SECRET>` (lo que manda Vercel Cron;
// semilla §4). Se compara la cabecera entera en tiempo constante. Sin `CRON_SECRET` configurado, nada pasa. Nunca se registra.
export function verificarSecretoDelCron(
  autorizacion: string | null,
  dependencias: Dependencias = {},
): boolean {
  const secreto = (dependencias.entorno ?? entornoDelServidor()).CRON_SECRET
  if (!secreto || !autorizacion) return false
  return igualesEnTiempoConstante(autorizacion, `Bearer ${secreto}`)
}
