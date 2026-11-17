import type { NextConfig } from 'next'

import { type OpcionesDePolitica, politicaDeContenido } from './politica-de-contenido'

// Las cabeceras del sitio (semilla §4) y su noindex. Las usa `next.config.ts` en `headers()`, que se arma al compilar con las
// variables del build: nada se lee por pedido y las páginas siguen prerenderizadas. Sin `@/`: la configuración de Next la importa
// por ruta relativa.

// El tipo de una regla de `headers()`, sacado de la configuración (Next sólo lo exporta desde `next/dist`).
export type Cabecera = Awaited<ReturnType<NonNullable<NextConfig['headers']>>>[number]

const NOINDEX = 'noindex, nofollow'

// Sólo `VERCEL_ENV=production` se indexa: las vistas previas, el local, el CI y el e2e, nunca.
export function seIndexa(vercelEnv: string | undefined): boolean {
  return vercelEnv === 'production'
}

// El mismo noindex, dicho en el HTML: el layout lo esparce en su `metadata`. En producción no pone nada y lo indexable lo decide cada
// página (o `robots.ts`); la cabecera de `/panel` y `/reunion` manda igual.
export function robotsDelLayout(vercelEnv: string | undefined): {
  robots?: { index: false; follow: false }
} {
  return seIndexa(vercelEnv) ? {} : { robots: { index: false, follow: false } }
}

export function cabecerasDelSitio(opciones: OpcionesDePolitica): Cabecera[] {
  const noindex = { key: 'X-Robots-Tag', value: NOINDEX }
  const deTodas = [
    { key: 'Content-Security-Policy', value: politicaDeContenido(opciones) },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  ]
  if (!seIndexa(opciones.vercelEnv)) return [{ source: '/:path*', headers: [...deTodas, noindex] }]
  // En producción, el panel y la gestión de reuniones nunca se indexan (`/x/:path*` también cubre `/x`).
  return [
    { source: '/:path*', headers: deTodas },
    { source: '/panel/:path*', headers: [noindex] },
    { source: '/reunion/:path*', headers: [noindex] },
  ]
}
