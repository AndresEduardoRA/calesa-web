import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'

import { entornoPublico } from '@/shared/config/entorno'
import { errorDePostgrest, fallo, type Resultado } from '@/shared/lib/errores'

import {
  ETIQUETA_DEL_EQUIPO,
  leerFilasDelEquipo,
  type MiembroDelEquipo,
} from '../../entities/miembro'
import { crearClientePublico } from '../cliente-publico'

// Las filas visibles del equipo para «Quiénes somos» (semilla §6.2, sección 8), por `publico.equipo_visible()`. Cacheada 1 hora
// (las páginas públicas son estáticas con revalidación de 1 h) y con la etiqueta `equipo`, que la action de P16 invalida al guardar.
// Un fallo no tumba la página: se devuelve como valor, la sección se oculta y se reintenta en minutos, no en una hora.
export async function leerEquipoVisible(): Promise<Resultado<MiembroDelEquipo[]>> {
  'use cache'
  cacheTag(ETIQUETA_DEL_EQUIPO)

  const { data, error } = await crearClientePublico().rpc('equipo_visible')
  if (error) {
    cacheLife('minutes')
    console.error(`equipo_visible: ${error.code} ${error.message}`)
    const { codigo, mensaje } = errorDePostgrest(error)
    return fallo(codigo, mensaje)
  }

  const filas = leerFilasDelEquipo(data as unknown, entornoPublico().NEXT_PUBLIC_SUPABASE_URL)
  if (!filas.ok) {
    cacheLife('minutes')
    console.error('equipo_visible: la respuesta no cumple el esquema')
    return filas
  }
  cacheLife('hours')
  return filas
}
