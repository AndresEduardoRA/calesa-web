import { z } from 'zod'

import { TIPOS_DE_EVENTO_PUBLICOS } from './tipos-de-evento'

const MAXIMO_DE_PAGINA = 200
const MAXIMO_DE_UTM = 100

// Espacios y caracteres de control (`\p{Cc}`): una ruta con alguno no es una ruta del sitio.
const CARACTER_NO_PERMITIDO = /[\s\p{Cc}]/u

// La ruta de la página donde ocurrió el evento, sin lo que viene después del primer `?` o `#`: nunca se guarda una consulta ni un
// fragmento de la URL (X7). `null` si no es una ruta del sitio.
export function paginaDelEvento(valor: unknown): string | null {
  if (typeof valor !== 'string') {
    return null
  }
  const ruta = valor.split(/[?#]/, 1)[0] ?? ''
  if (!ruta.startsWith('/') || ruta.startsWith('//')) {
    return null
  }
  if (ruta.length > MAXIMO_DE_PAGINA || CARACTER_NO_PERMITIDO.test(ruta)) {
    return null
  }
  return ruta
}

const utm = z
  .string()
  .trim()
  .max(MAXIMO_DE_UTM)
  .nullish()
  .transform((valor) => (valor ? valor : null))

// Lo único que cruza `POST /api/eventos` (X7): estricto, así un correo, un id o cualquier clave de más hace fallar todo.
export const esquemaEventoPublico = z.strictObject({
  tipo: z.enum(TIPOS_DE_EVENTO_PUBLICOS),
  pagina: z.unknown().transform((valor, ctx) => {
    const pagina = paginaDelEvento(valor)
    if (pagina === null) {
      ctx.addIssue({ code: 'custom', message: 'La página del evento no es una ruta del sitio.' })
      return z.NEVER
    }
    return pagina
  }),
  utm_source: utm,
  utm_medium: utm,
  utm_campaign: utm,
  utm_term: utm,
  utm_content: utm,
})

export type EventoPublico = z.output<typeof esquemaEventoPublico>
