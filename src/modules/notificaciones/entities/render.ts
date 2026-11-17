// Lo único que ve el resto del módulo de las plantillas: `renderizar(datos, contexto)` → asunto, html, texto y, si toca, el .ics.
// Puro: no lee el reloj ni el entorno (llegan en `contexto`).
import type { Contenido, Contexto } from './contenido'
import type { DatosDeCorreo } from './datos'
import { armarIcs } from './ics'
import { envolver } from './marca'
import { plantillasDeAvisosDeReunion } from './plantillas/avisos-reunion'
import { plantillasDelEquipo } from './plantillas/equipo'
import { plantillasDeReunion } from './plantillas/reunion'
import { plantillasDeSolicitudes } from './plantillas/solicitudes'

type Compositor = (datos: DatosDeCorreo, contexto: Contexto) => Contenido

// Cada compositor recibe los datos de su plantilla; el tipo de `datos` los ata por `plantilla`.
const COMPOSITORES: Record<DatosDeCorreo['plantilla'], Compositor> = {
  ...plantillasDeReunion,
  ...plantillasDeAvisosDeReunion,
  ...plantillasDeSolicitudes,
  ...plantillasDelEquipo,
} as Record<DatosDeCorreo['plantilla'], Compositor>

export type CorreoRenderizado = { asunto: string; html: string; texto: string; ics: string | null }

export function renderizar(datos: DatosDeCorreo, contexto: Contexto): CorreoRenderizado {
  const contenido = COMPOSITORES[datos.plantilla](datos, contexto)
  const { html, texto } = envolver({
    titulo: contenido.titulo,
    bloques: contenido.bloques,
    sitio: contexto.sitio,
  })
  const ics =
    contenido.ics && 'reunion' in datos
      ? armarIcs({
          metodo: contenido.ics,
          reunion: datos.reunion,
          ahora: contexto.ahora,
          organizador: contexto.organizador,
        })
      : null
  return { asunto: contenido.asunto, html, texto, ics }
}
