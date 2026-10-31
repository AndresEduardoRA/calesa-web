import type { z } from 'zod'

import { esquemaPublico, mensajeDeProblemas, problemasDe } from './esquemas'

// Variables públicas (viajan al navegador). Las del servidor: `servidor.ts`.
export type EntornoPublico = z.infer<typeof esquemaPublico>

let cache: EntornoPublico | undefined

// Lo público tal como lo ve Next. Acceso literal: Next sólo incrusta en el bundle del navegador las NEXT_PUBLIC_* escritas así.
// `VERCEL_ENV` no viaja al navegador: ahí queda `undefined` y no exige nada (lo exige el build y el servidor).
export function leerEntornoPublico(): Record<string, string | undefined> {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env['NEXT_PUBLIC_SUPABASE_URL'],
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'],
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env['NEXT_PUBLIC_TURNSTILE_SITE_KEY'],
    NEXT_PUBLIC_SITIO_URL: process.env['NEXT_PUBLIC_SITIO_URL'],
    VERCEL_ENV: process.env['VERCEL_ENV'],
  }
}

// Perezoso a propósito: validar al importar rompería los tests de cualquier archivo que sólo pase cerca de un cliente de Supabase.
// El build ya lo valida antes (next.config.ts).
export function entornoPublico(): EntornoPublico {
  if (!cache) {
    const crudo = leerEntornoPublico()
    const problemas = problemasDe(esquemaPublico, crudo)
    if (problemas.length > 0) throw new Error(mensajeDeProblemas('la app (públicas)', problemas))
    cache = esquemaPublico.parse(crudo)
  }
  return cache
}

const SITIO_LOCAL = 'http://localhost:3000'

// La URL del sitio, sin barra final, para armar enlaces absolutos (correos, `metadataBase`, `sitemap`). Nadie lee
// `NEXT_PUBLIC_SITIO_URL` directo: fuera de Vercel no es obligatoria (CI y los carriles no la tienen).
// - Con la variable, la variable (ya validada por `esquemaPublico`).
// - Sin ella, fuera de Vercel: `respaldo` (el origen del pedido, para que el e2e apunte al puerto del carril) o localhost:3000.
// - En Vercel (`production`, `preview`) nunca el respaldo: sale de la cabecera Host, que manda el cliente, y envenenaría los
//   enlaces de un correo. Sin la variable lanza, como `entornoPublico()`: es un error de configuración, no del pedido.
export function urlDelSitio(
  respaldo?: string,
  entorno: Pick<EntornoPublico, 'NEXT_PUBLIC_SITIO_URL' | 'VERCEL_ENV'> = entornoPublico(),
): string {
  const sinBarra = (url: string) => url.replace(/\/+$/, '')
  if (entorno.NEXT_PUBLIC_SITIO_URL) return sinBarra(entorno.NEXT_PUBLIC_SITIO_URL)
  if (entorno.VERCEL_ENV === 'production' || entorno.VERCEL_ENV === 'preview')
    throw new Error(`Falta NEXT_PUBLIC_SITIO_URL en Vercel ${entorno.VERCEL_ENV}.`)
  return sinBarra(respaldo ?? SITIO_LOCAL)
}
