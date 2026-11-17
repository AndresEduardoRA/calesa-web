import 'server-only'

import { errorDePostgrest, fallo, ok, type Resultado } from '@/shared/lib/errores'
import { createClient } from '@/shared/lib/supabase/server'

import { type EstadoDeTarea, estadoDeTarea, TAREA_DIARIA } from '../../entities/latidos'

// El estado de la tarea diaria para el banner «La tarea diaria no corre desde <fecha>.» (R4.22). Corre con la sesión de quien mira: sólo
// el admin (`actividad.ver`) ve la fila; para los demás la RLS da 0 filas y no hay banner. Índice: la clave primaria `tarea`.
export async function leerLatidoDiario(
  ahora: Date = new Date(),
): Promise<Resultado<EstadoDeTarea>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('latidos')
    .select('ultimo_ok, ultimo_error, fallos_seguidos, creado_en')
    .eq('tarea', TAREA_DIARIA)
    .maybeSingle()
  if (error) {
    console.error(`latido ${TAREA_DIARIA}: ${error.code}`)
    const { codigo, mensaje } = errorDePostgrest(error)
    return fallo(codigo, mensaje)
  }
  return ok(estadoDeTarea(data, ahora))
}
