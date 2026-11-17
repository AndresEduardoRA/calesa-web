// El caso «horas de una semana» (§6.4 paso 2, B10–B12, X1, R4.13, R4.20): con un token de solicitud o de gestión, las horas libres de la
// semana pedida, en la zona del visitante y agrupadas por día. Ésta es la forma que devuelve `GET /api/horas` (P36): agrupada, cabe en
// 20 KB aun con un horario de 7 × 24 (docs/RENDIMIENTO.md). Sin límite ni Turnstile: sólo lee.
import { z } from 'zod'
import { ok, type Resultado } from '@/shared/lib/errores'
import { horasDisponibles } from '../../entities/horas'
import {
  agruparPorDia,
  horasDeLaSemana,
  type DiaConHoras,
  type VacioDeSemana,
} from '../../entities/semana'
import { horasParaVisitante } from '../../entities/zona'
import { leerDatosParaHoras } from '../rpc'
import { leerToken } from '../tokens'
import { esquemaToken, esquemaZonaDelVisitante, validar } from './entrada'
import type { DependenciasPublicas } from './tipos'

const esquemaEntrada = z.object({
  t: esquemaToken,
  semana: z.iso.date({ error: 'Elige una semana válida.' }),
  zona: esquemaZonaDelVisitante,
})

export type HorasDeUnaSemana = {
  zona: string
  desde: string
  hasta: string
  dias: DiaConHoras[]
  haySiguiente: boolean
  vacio: VacioDeSemana
}

export type DependenciasDeHoras = Pick<DependenciasPublicas, 'llamar' | 'ahora' | 'entorno'>

export async function horasParaSemana(
  entrada: unknown,
  deps: DependenciasDeHoras,
): Promise<Resultado<HorasDeUnaSemana>> {
  const datos = validar(esquemaEntrada, entrada)
  if (!datos.ok) return datos
  const { t, semana, zona } = datos.data
  const token = leerToken(t, { entorno: deps.entorno, ahora: deps.ahora() })
  if (!token.ok) return token
  const agenda = await leerDatosParaHoras(deps.llamar, token.data)
  if (!agenda.ok) return agenda
  const deLaSemana = horasDeLaSemana(horasDisponibles(agenda.data), semana, zona)
  return ok({
    zona,
    desde: deLaSemana.desde,
    hasta: deLaSemana.hasta,
    dias: agruparPorDia(horasParaVisitante(deLaSemana.horas, zona)),
    haySiguiente: deLaSemana.haySiguiente,
    vacio: deLaSemana.vacio,
  })
}
