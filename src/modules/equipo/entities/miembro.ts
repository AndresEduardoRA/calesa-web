import { z } from 'zod'

import { MENSAJE_INESPERADO, fallo, ok, type Resultado } from '@/shared/lib/errores'

// La etiqueta de caché de la sección. Vive aquí para que la action de P16 que guarda el equipo llame a `updateTag` sin importar `infra`.
export const ETIQUETA_DEL_EQUIPO = 'equipo'

// Lo que devuelve `publico.equipo_visible()` (semilla §3, tabla `equipo`): sólo lo público, sin `visible` ni `actualizado_en`.
export const esquemaFilaDelEquipoVisible = z.object({
  id: z.guid(),
  nombre: z.string().min(2).max(80),
  cargo: z.string().min(2).max(80),
  frase: z.string().max(400).nullable(),
  foto_ruta: z.string().min(1).max(200).nullable(),
  orden: z.int(),
})

export type MiembroDelEquipo = {
  id: string
  nombre: string
  cargo: string
  frase: string | null
  fotoUrl: string | null
}

// La RPC trae a lo sumo 100 filas; más es que algo cambió y no se muestra.
const TOPE_DE_FILAS = 100

// La URL pública de una foto del bucket `equipo`. Cada segmento se codifica y las barras de las subcarpetas se conservan.
export function urlDeFoto(baseSupabase: string, ruta: string): string {
  const base = baseSupabase.replace(/\/+$/, '')
  const segmentos = ruta.split('/').map(encodeURIComponent).join('/')
  return `${base}/storage/v1/object/public/equipo/${segmentos}`
}

// Valida la respuesta de la RPC y la deja lista para dibujar. Una sola fila inválida hace fallar todo: mejor ocultar la sección
// que mostrar un equipo a medias.
export function leerFilasDelEquipo(
  datos: unknown,
  baseSupabase: string,
): Resultado<MiembroDelEquipo[]> {
  const filas = z.array(esquemaFilaDelEquipoVisible).max(TOPE_DE_FILAS).safeParse(datos)
  if (!filas.success) return fallo('inesperado', MENSAJE_INESPERADO)
  return ok(
    filas.data.map((fila) => ({
      id: fila.id,
      nombre: fila.nombre,
      cargo: fila.cargo,
      frase: fila.frase !== null && fila.frase.trim() === '' ? null : fila.frase,
      fotoUrl: fila.foto_ruta === null ? null : urlDeFoto(baseSupabase, fila.foto_ruta),
    })),
  )
}
