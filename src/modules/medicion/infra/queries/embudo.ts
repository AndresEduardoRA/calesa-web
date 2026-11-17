import 'server-only'

import { z } from 'zod'

import { errorDePostgrest, fallo, ok, type Resultado } from '@/shared/lib/errores'
import { createClient } from '@/shared/lib/supabase/server'

import {
  type AlcanceDelEmbudo,
  type EmbudoDelEquipo,
  type EmbudoPropio,
  type FuenteDelEmbudo,
  fuenteDelEmbudo,
  mesEnZona,
  rangoDelMes,
  sumarEmbudoDelEquipo,
  sumarEmbudoPropio,
} from '../../entities/embudo'

// Un mes tiene a lo sumo 31 filas: una por día.
const DIAS_DEL_MES = 31

export type EmbudoDelMes =
  | { fuente: 'equipo'; mes: string; embudo: EmbudoDelEquipo }
  | { fuente: 'propio'; mes: string; embudo: EmbudoPropio }

type Entrada = {
  alcance: AlcanceDelEmbudo
  // Sólo lo exige `propio`: el perfil de quien mira.
  perfilId?: string
  // `YYYY-MM`; sin él, el mes de `ahora` en La Paz.
  mes?: string
  ahora?: Date
}

function falloDeLectura(fuente: FuenteDelEmbudo, error: { code?: string | null; message: string }) {
  console.error(`embudo ${fuente}: ${error.code ?? 'sin código'}`)
  const { codigo, mensaje } = errorDePostgrest(error)
  return fallo(codigo, mensaje)
}

// El embudo del mes (solicitudes → reuniones → ganadas, R4.4) sumado desde las métricas diarias, nunca contando eventos. Corre con la
// sesión de quien mira: la RLS decide qué filas ve (`metricas.ver`), `fuenteDelEmbudo` sólo elige la tabla. `null` si no tiene el permiso.
export async function leerEmbudoDelMes({
  alcance,
  perfilId,
  mes,
  ahora = new Date(),
}: Entrada): Promise<Resultado<EmbudoDelMes | null>> {
  const fuente = fuenteDelEmbudo(alcance)
  if (fuente === null) {
    return ok(null)
  }
  const mesPedido = mes ?? mesEnZona(ahora.toISOString())
  const rango = rangoDelMes(mesPedido)
  if (!rango) {
    return fallo('validacion', 'El mes no es válido.')
  }
  const supabase = await createClient()

  if (fuente === 'equipo') {
    // Índice: la clave primaria `dia`.
    const { data, error } = await supabase
      .from('metricas_diarias')
      .select(
        'solicitudes, reuniones_reservadas, reuniones_realizadas, ganadas, clics_whatsapp, calculadoras',
      )
      .gte('dia', rango.desde)
      .lt('dia', rango.hasta)
      .order('dia', { ascending: true })
      .limit(DIAS_DEL_MES)
    if (error) {
      return falloDeLectura(fuente, error)
    }
    return ok({ fuente, mes: mesPedido, embudo: sumarEmbudoDelEquipo(data) })
  }

  const perfil = z.guid().safeParse(perfilId)
  if (!perfil.success) {
    return fallo('validacion', 'Falta la persona de la que se pide el embudo.')
  }
  // Índice: `metricas_persona_perfil (perfil_id, dia desc)`.
  const { data, error } = await supabase
    .from('metricas_persona')
    .select('solicitudes_asignadas, reuniones_reservadas, reuniones_realizadas, ganadas')
    .eq('perfil_id', perfil.data)
    .gte('dia', rango.desde)
    .lt('dia', rango.hasta)
    .order('dia', { ascending: true })
    .limit(DIAS_DEL_MES)
  if (error) {
    return falloDeLectura(fuente, error)
  }
  return ok({ fuente, mes: mesPedido, embudo: sumarEmbudoPropio(data) })
}
