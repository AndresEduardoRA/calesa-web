import { describe, expect, it } from 'vitest'

import { cabecerasDelSitio, robotsDelLayout, seIndexa } from './cabeceras'
import { type OpcionesDePolitica, politicaDeContenido } from './politica-de-contenido'

const EN_PRODUCCION: OpcionesDePolitica = {
  desarrollo: false,
  supabaseUrl: 'https://abc.supabase.co',
  vercelEnv: 'production',
}
const FUERA_DE_PRODUCCION: OpcionesDePolitica[] = [
  { ...EN_PRODUCCION, vercelEnv: 'preview' },
  { ...EN_PRODUCCION, vercelEnv: 'development' },
  { desarrollo: false, supabaseUrl: 'http://127.0.0.1:55321', vercelEnv: undefined },
  { desarrollo: true, supabaseUrl: 'http://127.0.0.1:55321', vercelEnv: undefined },
]

function valorEn(opciones: OpcionesDePolitica, source: string, clave: string): string | undefined {
  return cabecerasDelSitio(opciones)
    .find((regla) => regla.source === source)
    ?.headers.find((cabecera) => cabecera.key === clave)?.value
}

function reglasCon(opciones: OpcionesDePolitica, clave: string): string[] {
  return cabecerasDelSitio(opciones)
    .filter((regla) => regla.headers.some((cabecera) => cabecera.key === clave))
    .map((regla) => regla.source)
}

describe('seIndexa', () => {
  it('sólo VERCEL_ENV=production es producción', () => {
    expect(seIndexa('production')).toBe(true)
  })

  it.each(['preview', 'development', undefined, ''])('%o no se indexa', (vercelEnv) => {
    expect(seIndexa(vercelEnv)).toBe(false)
  })
})

describe('robotsDelLayout', () => {
  it('en producción no pone robots: lo indexable lo decide cada página', () => {
    const metadata = robotsDelLayout('production')
    expect(metadata).toEqual({})
    expect('robots' in metadata).toBe(false)
  })

  it.each(['preview', 'development', undefined])('con %o, noindex y nofollow', (vercelEnv) => {
    expect(robotsDelLayout(vercelEnv)).toEqual({ robots: { index: false, follow: false } })
  })
})

describe('cabecerasDelSitio: en toda ruta', () => {
  it.each([EN_PRODUCCION, ...FUERA_DE_PRODUCCION])(
    'la CSP, nosniff y el Referrer-Policy de §4 (%o)',
    (opciones) => {
      expect(valorEn(opciones, '/:path*', 'Content-Security-Policy')).toBe(
        politicaDeContenido(opciones),
      )
      expect(valorEn(opciones, '/:path*', 'X-Content-Type-Options')).toBe('nosniff')
      expect(valorEn(opciones, '/:path*', 'Referrer-Policy')).toBe(
        'strict-origin-when-cross-origin',
      )
    },
  )
})

describe('cabecerasDelSitio: noindex', () => {
  it.each(FUERA_DE_PRODUCCION)('fuera de producción, en todo el sitio (%o)', (opciones) => {
    expect(valorEn(opciones, '/:path*', 'X-Robots-Tag')).toBe('noindex, nofollow')
  })

  it('en producción, sólo en el panel y en la gestión de reuniones', () => {
    expect(reglasCon(EN_PRODUCCION, 'X-Robots-Tag')).toEqual(['/panel/:path*', '/reunion/:path*'])
    expect(valorEn(EN_PRODUCCION, '/panel/:path*', 'X-Robots-Tag')).toBe('noindex, nofollow')
    expect(valorEn(EN_PRODUCCION, '/reunion/:path*', 'X-Robots-Tag')).toBe('noindex, nofollow')
    expect(valorEn(EN_PRODUCCION, '/:path*', 'X-Robots-Tag')).toBeUndefined()
  })
})
