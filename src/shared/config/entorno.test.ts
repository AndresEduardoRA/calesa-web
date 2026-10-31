import { afterEach, describe, expect, it, vi } from 'vitest'

import { leerEntornoPublico, urlDelSitio } from './entorno'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('leerEntornoPublico()', () => {
  it('lee la URL del sitio, la clave de Turnstile y VERCEL_ENV por su nombre', () => {
    vi.stubEnv('NEXT_PUBLIC_SITIO_URL', 'https://calesa.app')
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', '1x00000000000000000000AA')
    vi.stubEnv('VERCEL_ENV', 'preview')
    expect(leerEntornoPublico()).toMatchObject({
      NEXT_PUBLIC_SITIO_URL: 'https://calesa.app',
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
      VERCEL_ENV: 'preview',
    })
  })
})

describe('urlDelSitio() sin entorno explícito', () => {
  // `entornoPublico()` guarda lo validado en el módulo: cada prueba importa uno nuevo.
  const kit = {
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:55321',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'p',
  }
  const conEntorno = async (variables: Record<string, string>) => {
    for (const [nombre, valor] of Object.entries({ ...kit, ...variables }))
      vi.stubEnv(nombre, valor)
    vi.resetModules()
    return (await import('./entorno')).urlDelSitio
  }

  it('lee la URL del sitio ya validada por entornoPublico()', async () => {
    const url = await conEntorno({ NEXT_PUBLIC_SITIO_URL: 'https://calesa.app/' })
    expect(url('http://localhost:8310')).toBe('https://calesa.app')
  })

  it('una URL del sitio que no es URL no llega: cae al validar lo público', async () => {
    const url = await conEntorno({ NEXT_PUBLIC_SITIO_URL: 'calesa.app' })
    expect(() => url()).toThrow('NEXT_PUBLIC_SITIO_URL: no es una URL')
  })
})

describe('urlDelSitio()', () => {
  it('con la variable, la devuelve sin barra final aunque haya respaldo', () => {
    const entorno = { NEXT_PUBLIC_SITIO_URL: 'https://calesa.app/' }
    expect(urlDelSitio(undefined, entorno)).toBe('https://calesa.app')
    expect(urlDelSitio('http://localhost:8310', entorno)).toBe('https://calesa.app')
  })

  it('sin la variable y fuera de Vercel, usa el respaldo o localhost:3000', () => {
    for (const entorno of [{}, { VERCEL_ENV: 'development' as const }]) {
      expect(urlDelSitio('http://localhost:8310/', entorno)).toBe('http://localhost:8310')
      expect(urlDelSitio(undefined, entorno)).toBe('http://localhost:3000')
    }
  })

  it('en Vercel nunca usa el respaldo: sin la variable, lanza', () => {
    for (const VERCEL_ENV of ['production', 'preview'] as const) {
      expect(() => urlDelSitio('http://malo.example', { VERCEL_ENV })).toThrow(
        `Falta NEXT_PUBLIC_SITIO_URL en Vercel ${VERCEL_ENV}.`,
      )
      expect(() => urlDelSitio(undefined, { VERCEL_ENV })).toThrow()
    }
    expect(
      urlDelSitio('http://malo.example', {
        VERCEL_ENV: 'production',
        NEXT_PUBLIC_SITIO_URL: 'https://calesa.app',
      }),
    ).toBe('https://calesa.app')
  })
})
