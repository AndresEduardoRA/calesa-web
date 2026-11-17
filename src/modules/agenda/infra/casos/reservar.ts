// El caso «reservar» (§5.6, §6.4 paso 3, C7, R4.16): con el token de solicitud, la primera reserva; con el de gestión de una reunión
// cancelada, volver a reservar. El límite de reservas de la IP va antes de leer el token o tocar la base (falla cerrado); Turnstile no
// va aquí (§4: sólo el formulario y el detalle). Devuelve sólo lo que muestra la confirmación: nunca correos, el asignado ni el hash.
import { z } from 'zod'
import { ok, type Resultado } from '@/shared/lib/errores'
import { generarTokenDeGestion, limitar } from '@/shared/lib/seguridad'
import type { ResumenReunion } from '../../entities/respuestas'
import { accionesDeReserva, despacharCorreos } from '../correos'
import { reservarEnLaBase } from '../rpc'
import { leerToken } from '../tokens'
import {
  enlaceDeGestion,
  esquemaInstante,
  esquemaToken,
  esquemaZonaDelVisitante,
  validar,
} from './entrada'
import type { DependenciasPublicas } from './tipos'

const esquemaEntrada = z.object({
  t: esquemaToken,
  inicio: esquemaInstante,
  zona: esquemaZonaDelVisitante,
})

export type ReunionHecha = {
  reunion: {
    id: string
    inicio: string
    fin: string
    zonaVisitante: string
    enlaceMeet: string
    actualizadoEn: string
  }
  // El WhatsApp es el de «Abrir WhatsApp con <nombre>» de §6.4: el correo del anfitrión no sale.
  anfitrion: { nombre: string; whatsapp: string | null }
  enlaceGestion: string
}

export function reunionHecha(resumen: ResumenReunion, enlace: string): ReunionHecha {
  const { reunion, anfitrion } = resumen
  return {
    reunion: {
      id: reunion.id,
      inicio: reunion.inicio,
      fin: reunion.fin,
      zonaVisitante: reunion.zonaVisitante,
      enlaceMeet: reunion.enlaceMeet,
      actualizadoEn: reunion.actualizadoEn,
    },
    anfitrion: { nombre: anfitrion.nombre, whatsapp: anfitrion.whatsapp },
    enlaceGestion: enlace,
  }
}

export async function reservar(
  entrada: unknown,
  deps: DependenciasPublicas,
): Promise<Resultado<ReunionHecha>> {
  const datos = validar(esquemaEntrada, entrada)
  if (!datos.ok) return datos
  const limite = await limitar('reservas', deps.ip, deps.contar, { entorno: deps.entorno })
  if (!limite.ok) return limite
  const token = leerToken(datos.data.t, { entorno: deps.entorno, ahora: deps.ahora() })
  if (!token.ok) return token
  const nuevo = generarTokenDeGestion()
  const resumen = await reservarEnLaBase(deps.llamar, {
    token: token.data,
    inicio: datos.data.inicio,
    zona: datos.data.zona,
    tokenHash: nuevo.hash,
  })
  if (!resumen.ok) return resumen
  const enlace = enlaceDeGestion(deps.sitio, nuevo.token)
  const contexto = {
    resumen: resumen.data,
    enlaceGestion: enlace,
    ahora: deps.ahora().toISOString(),
    momentos: deps.momentos,
  }
  await despacharCorreos(accionesDeReserva(contexto), deps.correos)
  return ok(reunionHecha(resumen.data, enlace))
}
