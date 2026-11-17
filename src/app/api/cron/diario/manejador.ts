import { verificarSecretoDelCron } from '@/shared/lib/seguridad'

// La llamada diaria del cron (X6, F10) sin su ruta: la llama `GET /api/cron/diario` (P42) con `correr`, que corre `correrTareaDiaria`
// con los puertos ya armados. Sólo corre con `Authorization: Bearer <CRON_SECRET>`; una corrida en ko responde 500 para que quede en los
// logs de Vercel. Nunca registra la cabecera.

export type DependenciasDelCron<R extends { ok: boolean }> = {
  correr: () => Promise<R>
  verificar?: (autorizacion: string | null) => boolean
}

const responder = (estado: number, cuerpo: object) =>
  Response.json(cuerpo, { status: estado, headers: { 'Cache-Control': 'no-store' } })

export async function manejarCron<R extends { ok: boolean }>(
  request: Request,
  { correr, verificar = verificarSecretoDelCron }: DependenciasDelCron<R>,
): Promise<Response> {
  let autorizado: boolean
  try {
    autorizado = verificar(request.headers.get('authorization'))
  } catch {
    // Sin el entorno del servidor no se puede saber si la llamada es del cron: no corre.
    console.error('tarea diaria: entorno')
    return responder(500, { ok: false })
  }
  if (!autorizado) {
    return responder(401, { ok: false })
  }
  try {
    const resumen = await correr()
    return responder(resumen.ok ? 200 : 500, { ok: resumen.ok, resumen })
  } catch {
    console.error('tarea diaria: inesperado')
    return responder(500, { ok: false })
  }
}
