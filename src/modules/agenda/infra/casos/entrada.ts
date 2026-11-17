// Lo que comparten las entradas de los casos públicos: el token, la zona con la forma que acepta la base y un instante, más cómo se
// devuelve una entrada que no valida y cómo se arma el enlace de gestión.
import { z } from 'zod'
import { fallo, type Resultado } from '@/shared/lib/errores'
import { esquemaZona } from '../../entities/zona'
import { TEXTO_ENLACE_INVALIDO } from '../tokens'

const TEXTO_ZONA = 'Elige una zona horaria válida.'

// La forma de `_validar_zona` (supabase/migrations/20261117124015_calesa_agenda_reglas.sql): «Región/Ciudad» o UTC, hasta 64. Una zona
// que Intl acepta y la base no (GMT, EST5EDT) se rechaza aquí, con el texto de la persona, y no como un `22023` de la base.
const FORMA_DE_LA_BASE = /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)+$/

export const esquemaZonaDelVisitante = esquemaZona.refine(
  (zona) => zona.length <= 64 && (zona === 'UTC' || FORMA_DE_LA_BASE.test(zona)),
  { error: TEXTO_ZONA },
)

export const esquemaToken = z
  .string({ error: TEXTO_ENLACE_INVALIDO })
  .min(1, { error: TEXTO_ENLACE_INVALIDO })
  .max(200, {
    error: TEXTO_ENLACE_INVALIDO,
  })

export const esquemaInstante = z.iso.datetime({ offset: true, error: 'Elige una hora válida.' })

// Una entrada que no valida dice el primer problema, con su texto en español.
export function validar<T>(esquema: z.ZodType<T>, entrada: unknown): Resultado<T> {
  const datos = esquema.safeParse(entrada)
  if (datos.success) {
    return { ok: true, data: datos.data }
  }
  return fallo('validacion', datos.error.issues[0]?.message ?? 'Hay un dato que no es válido.')
}

// `/reunion/<token>` sobre `NEXT_PUBLIC_SITIO_URL`. El token es base64url: no hace falta codificarlo.
export function enlaceDeGestion(sitio: string, token: string): string {
  return new URL(`/reunion/${token}`, sitio).toString()
}
