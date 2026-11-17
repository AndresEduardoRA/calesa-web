// Los casos de `/reunion/<token>` (§5.8, B15, R4.16, D4): leer, cambiar y cancelar, sólo con el token de gestión. Cambiar toma una
// hora como reservar y cuenta en el mismo límite de la IP; cancelar la libera y no cuenta. El plazo lo decide la base (E6).
import { z } from 'zod'
import { conflicto, fallo, ok, type Resultado } from '@/shared/lib/errores'
import { limitar } from '@/shared/lib/seguridad'
import { estadoDeGestion, type Gestion } from '../../entities/gestion'
import type { ReunionDelToken } from '../../entities/respuestas'
import { accionesDeCambio, accionesDeCancelacion, despacharCorreos } from '../correos'
import { cambiarEnLaBase, cancelarEnLaBase, leerDatosParaHoras } from '../rpc'
import { TEXTO_ENLACE_INVALIDO, leerTokenDeGestion } from '../tokens'
import { enlaceDeGestion, esquemaInstante, esquemaToken, validar } from './entrada'
import { reunionHecha, type ReunionHecha } from './reservar'
import type { DependenciasPublicas } from './tipos'

// E7, el mismo texto que levanta la base con `PT409`.
const TEXTO_CAMBIO = 'Esta demo o solicitud cambió mientras la mirabas. Recarga para ver lo último.'

export type ReunionLeida = {
  reunion: Pick<
    ReunionDelToken,
    'id' | 'inicio' | 'fin' | 'zonaVisitante' | 'enlaceMeet' | 'estado' | 'actualizadoEn'
  >
  anfitrion: { nombre: string; whatsapp: string | null }
  gestion: Gestion
}

async function reunionDelToken(llamar: DependenciasPublicas['llamar'], hash: string) {
  const datos = await leerDatosParaHoras(llamar, { tipo: 'gestion', hash })
  if (!datos.ok) return datos
  const { reunion, ahora } = datos.data
  return reunion ? ok({ reunion, ahora }) : fallo('regla', TEXTO_ENLACE_INVALIDO)
}

export async function leerReunion(
  entrada: unknown,
  deps: Pick<DependenciasPublicas, 'llamar'>,
): Promise<Resultado<ReunionLeida>> {
  const datos = validar(z.object({ t: esquemaToken }), entrada)
  if (!datos.ok) return datos
  const token = leerTokenDeGestion(datos.data.t)
  if (!token.ok) return token
  const leida = await reunionDelToken(deps.llamar, token.data.hash)
  if (!leida.ok) return leida
  const { reunion, ahora } = leida.data
  const { id, inicio, fin, zonaVisitante, enlaceMeet, estado, actualizadoEn } = reunion
  return ok({
    reunion: { id, inicio, fin, zonaVisitante, enlaceMeet, estado, actualizadoEn },
    anfitrion: { nombre: reunion.anfitrion.nombre, whatsapp: reunion.anfitrion.whatsapp },
    gestion: estadoDeGestion(reunion, ahora),
  })
}

const esquemaCambio = z.object({
  t: esquemaToken,
  inicio: esquemaInstante,
  actualizadoEn: esquemaInstante,
})

// Con la versión que recibió la pantalla: si ya no es la de la base, conflicto sin intentar el cambio. La hora anterior, la leída.
export async function cambiarReunion(
  entrada: unknown,
  deps: DependenciasPublicas,
): Promise<Resultado<ReunionHecha>> {
  const datos = validar(esquemaCambio, entrada)
  if (!datos.ok) return datos
  const limite = await limitar('reservas', deps.ip, deps.contar, { entorno: deps.entorno })
  if (!limite.ok) return limite
  const token = leerTokenDeGestion(datos.data.t)
  if (!token.ok) return token
  const leida = await reunionDelToken(deps.llamar, token.data.hash)
  if (!leida.ok) return leida
  const { inicio, actualizadoEn } = datos.data
  if (Date.parse(leida.data.reunion.actualizadoEn) !== Date.parse(actualizadoEn)) {
    return conflicto(TEXTO_CAMBIO)
  }
  const resumen = await cambiarEnLaBase(deps.llamar, {
    hash: token.data.hash,
    inicio,
    actualizadoEn,
  })
  if (!resumen.ok) return resumen
  const enlace = enlaceDeGestion(deps.sitio, datos.data.t)
  const contexto = {
    resumen: resumen.data,
    enlaceGestion: enlace,
    ahora: deps.ahora().toISOString(),
    momentos: deps.momentos,
    inicioAnterior: leida.data.reunion.inicio,
  }
  await despacharCorreos(accionesDeCambio(contexto), deps.correos)
  return ok(reunionHecha(resumen.data, enlace))
}

export type ReunionCancelada = { reunionId: string; estado: 'cancelada' }

export async function cancelarReunion(
  entrada: unknown,
  deps: Pick<DependenciasPublicas, 'llamar' | 'correos' | 'ahora'>,
): Promise<Resultado<ReunionCancelada>> {
  const datos = validar(z.object({ t: esquemaToken, actualizadoEn: esquemaInstante }), entrada)
  if (!datos.ok) return datos
  const token = leerTokenDeGestion(datos.data.t)
  if (!token.ok) return token
  const resumen = await cancelarEnLaBase(deps.llamar, {
    hash: token.data.hash,
    actualizadoEn: datos.data.actualizadoEn,
  })
  if (!resumen.ok) return resumen
  await despacharCorreos(
    accionesDeCancelacion({ resumen: resumen.data, ahora: deps.ahora().toISOString() }),
    deps.correos,
  )
  return ok({ reunionId: resumen.data.reunion.id, estado: 'cancelada' })
}
