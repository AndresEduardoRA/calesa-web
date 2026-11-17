import { describe, expect, it } from 'vitest'

import { type OpcionesDePolitica, politicaDeContenido } from './politica-de-contenido'

const PRODUCCION: OpcionesDePolitica = {
  desarrollo: false,
  supabaseUrl: 'https://abc.supabase.co',
  vercelEnv: 'production',
}
const LOCAL: OpcionesDePolitica = {
  desarrollo: false,
  supabaseUrl: 'http://127.0.0.1:55321',
  vercelEnv: undefined,
}
const DESARROLLO: OpcionesDePolitica = { ...LOCAL, desarrollo: true }

// La CSP partida por directiva: nombre → lista de fuentes (vacía para las que no llevan valor).
function directivas(politica: string): Map<string, string[]> {
  return new Map(
    politica.split('; ').map((directiva) => {
      const [nombre = '', ...fuentes] = directiva.split(' ')
      return [nombre, fuentes]
    }),
  )
}

function fuentesDe(opciones: OpcionesDePolitica, directiva: string): string[] {
  const fuentes = directivas(politicaDeContenido(opciones)).get(directiva)
  if (!fuentes) throw new Error(`la CSP no trae ${directiva}`)
  return fuentes
}

const TODAS: OpcionesDePolitica[] = [
  PRODUCCION,
  { ...PRODUCCION, vercelEnv: 'preview' },
  LOCAL,
  DESARROLLO,
]

describe('politicaDeContenido: las directivas fijas de §4', () => {
  it.each(TODAS)('cierra lo que no se usa (%o)', (opciones) => {
    expect(fuentesDe(opciones, 'default-src')).toEqual(["'self'"])
    expect(fuentesDe(opciones, 'object-src')).toEqual(["'none'"])
    expect(fuentesDe(opciones, 'base-uri')).toEqual(["'self'"])
    expect(fuentesDe(opciones, 'form-action')).toEqual(["'self'"])
    expect(fuentesDe(opciones, 'frame-ancestors')).toEqual(["'none'"])
  })

  it('va en el orden fijo de las directivas', () => {
    expect([...directivas(politicaDeContenido(PRODUCCION)).keys()]).toEqual([
      'default-src',
      'script-src',
      'style-src',
      'img-src',
      'font-src',
      'connect-src',
      'frame-src',
      'object-src',
      'base-uri',
      'form-action',
      'frame-ancestors',
      'upgrade-insecure-requests',
    ])
  })
})

describe('politicaDeContenido: scripts y estilos sin nonces', () => {
  it('en producción no deja evaluar código', () => {
    expect(fuentesDe(PRODUCCION, 'script-src')).not.toContain("'unsafe-eval'")
    expect(fuentesDe(LOCAL, 'script-src')).not.toContain("'unsafe-eval'")
  })

  it('en next dev deja evaluar código y abrir el websocket del HMR', () => {
    expect(fuentesDe(DESARROLLO, 'script-src')).toContain("'unsafe-eval'")
    expect(fuentesDe(DESARROLLO, 'connect-src')).toEqual(
      expect.arrayContaining(['ws://localhost:*', 'ws://127.0.0.1:*']),
    )
    expect(fuentesDe(LOCAL, 'connect-src')).not.toContain('ws://localhost:*')
    expect(fuentesDe(PRODUCCION, 'connect-src')).not.toContain('ws://localhost:*')
  })

  it.each(TODAS)(
    'permite los scripts y estilos en línea de Next y next-themes (%o)',
    (opciones) => {
      expect(fuentesDe(opciones, 'script-src')).toContain("'unsafe-inline'")
      expect(fuentesDe(opciones, 'style-src')).toContain("'unsafe-inline'")
    },
  )

  it.each(TODAS)(
    "no lleva nonce, hash ni 'strict-dynamic', que anularían 'unsafe-inline' (%o)",
    (opciones) => {
      const politica = politicaDeContenido(opciones)
      expect(politica).not.toContain("'nonce-")
      expect(politica).not.toContain("'sha256-")
      expect(politica).not.toContain("'strict-dynamic'")
    },
  )
})

describe('politicaDeContenido: los orígenes de afuera', () => {
  it('Turnstile puede cargar su script y su iframe', () => {
    expect(fuentesDe(PRODUCCION, 'script-src')).toContain('https://challenges.cloudflare.com')
    expect(fuentesDe(PRODUCCION, 'frame-src')).toEqual(['https://challenges.cloudflare.com'])
  })

  it('Vercel Web Analytics puede cargar su script', () => {
    expect(fuentesDe(PRODUCCION, 'script-src')).toContain('https://va.vercel-scripts.com')
  })

  it('las fuentes salen sólo del sitio (next/font las sirve desde ahí)', () => {
    for (const opciones of TODAS) expect(fuentesDe(opciones, 'font-src')).toEqual(["'self'"])
    expect(politicaDeContenido(PRODUCCION)).not.toContain('fonts.googleapis.com')
    expect(politicaDeContenido(PRODUCCION)).not.toContain('fonts.gstatic.com')
  })

  it('Supabase en la nube: imágenes, API y realtime por el comodín, sin repetir el origen', () => {
    expect(fuentesDe(PRODUCCION, 'img-src')).toEqual([
      "'self'",
      'data:',
      'blob:',
      'https://*.supabase.co',
    ])
    expect(fuentesDe(PRODUCCION, 'connect-src')).toEqual([
      "'self'",
      'https://*.supabase.co',
      'wss://*.supabase.co',
      'https://va.vercel-scripts.com',
    ])
  })
})

describe('politicaDeContenido: el origen de NEXT_PUBLIC_SUPABASE_URL', () => {
  it('el Supabase local suma su http:// y su ws:// (el dev y el e2e)', () => {
    expect(fuentesDe(LOCAL, 'connect-src')).toEqual(
      expect.arrayContaining(['http://127.0.0.1:55321', 'ws://127.0.0.1:55321']),
    )
    expect(fuentesDe(LOCAL, 'img-src')).toContain('http://127.0.0.1:55321')
  })

  it('un Supabase https fuera del comodín suma su https:// y su wss://', () => {
    const propio = { ...PRODUCCION, supabaseUrl: 'https://db.calesa.app/' }
    expect(fuentesDe(propio, 'connect-src')).toEqual(
      expect.arrayContaining(['https://db.calesa.app', 'wss://db.calesa.app']),
    )
    expect(fuentesDe(propio, 'img-src')).toContain('https://db.calesa.app')
  })

  it.each([undefined, '', 'no-es-url', 'ftp://127.0.0.1:21'])(
    'con %o no suma nada y no lanza (next dev y typegen pueden no tenerla)',
    (supabaseUrl) => {
      const opciones = { ...LOCAL, supabaseUrl }
      expect(() => politicaDeContenido(opciones)).not.toThrow()
      expect(fuentesDe(opciones, 'connect-src')).toEqual([
        "'self'",
        'https://*.supabase.co',
        'wss://*.supabase.co',
        'https://va.vercel-scripts.com',
      ])
      expect(fuentesDe(opciones, 'img-src')).toEqual([
        "'self'",
        'data:',
        'blob:',
        'https://*.supabase.co',
      ])
    },
  )
})

describe('politicaDeContenido: upgrade-insecure-requests', () => {
  it.each(['production', 'preview'])('va con VERCEL_ENV=%s', (vercelEnv) => {
    expect(
      directivas(politicaDeContenido({ ...PRODUCCION, vercelEnv })).has(
        'upgrade-insecure-requests',
      ),
    ).toBe(true)
  })

  it.each(['development', undefined])(
    'no va con VERCEL_ENV=%o: el sitio y el Supabase local son http://',
    (vercelEnv) => {
      expect(
        directivas(politicaDeContenido({ ...LOCAL, vercelEnv })).has('upgrade-insecure-requests'),
      ).toBe(false)
    },
  )
})

describe('politicaDeContenido: la forma', () => {
  it.each(TODAS)(
    'una sola línea, sin espacios dobles, sin ; final y sin fuentes repetidas (%o)',
    (opciones) => {
      const politica = politicaDeContenido(opciones)
      expect(politica).not.toMatch(/\n/)
      expect(politica).not.toContain('  ')
      expect(politica.endsWith(';')).toBe(false)
      expect(politica.trim()).toBe(politica)
      for (const [nombre, fuentes] of directivas(politica)) {
        expect(new Set(fuentes).size, nombre).toBe(fuentes.length)
      }
    },
  )
})
