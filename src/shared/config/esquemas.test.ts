import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from 'next/constants'
import { describe, expect, it } from 'vitest'

import {
  esquemaDeLaDemo,
  esquemaDelServidor,
  esquemaPublico,
  mensajeDeProblemas,
  problemasDe,
  validaLaCompilacion,
} from './esquemas'

describe('el entorno: lo público', () => {
  it('pide la URL y la clave publicable de Supabase', () => {
    expect(problemasDe(esquemaPublico, {})).toEqual([
      { variable: 'NEXT_PUBLIC_SUPABASE_URL', motivo: 'falta' },
      { variable: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', motivo: 'falta' },
    ])
    expect(
      problemasDe(esquemaPublico, {
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:55321',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'x',
      }),
    ).toEqual([])
  })

  it('una URL que no es URL o una clave vacía se nombran', () => {
    expect(
      problemasDe(esquemaPublico, {
        NEXT_PUBLIC_SUPABASE_URL: 'nada',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ' ',
      }),
    ).toEqual([
      { variable: 'NEXT_PUBLIC_SUPABASE_URL', motivo: 'no es una URL' },
      { variable: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', motivo: 'falta' },
    ])
  })
})

describe('el entorno: el servidor', () => {
  const base = { SUPABASE_SECRET_KEY: 'x' }

  it('sólo la secret key es obligatoria; sin EMAIL_PROVEEDOR no se manda correo', () => {
    expect(problemasDe(esquemaDelServidor, {})).toEqual([
      { variable: 'SUPABASE_SECRET_KEY', motivo: 'falta' },
    ])
    expect(problemasDe(esquemaDelServidor, base)).toEqual([])
    expect(esquemaDelServidor.parse(base).EMAIL_PROVEEDOR).toBe('ninguno')
  })

  it('con un proveedor de correo pide el remitente; mailpit pide además su URL', () => {
    expect(
      problemasDe(esquemaDelServidor, { ...base, EMAIL_PROVEEDOR: 'mailpit' }).map(
        (p) => p.variable,
      ),
    ).toEqual(['EMAIL_REMITENTE', 'EMAIL_REMITENTE_NOMBRE', 'MAILPIT_URL'])
    expect(
      problemasDe(esquemaDelServidor, {
        ...base,
        EMAIL_PROVEEDOR: 'mailpit',
        EMAIL_REMITENTE: 'avisos@correo.ejemplo.com',
        EMAIL_REMITENTE_NOMBRE: 'Mi proyecto',
        MAILPIT_URL: 'http://127.0.0.1:55324',
      }),
    ).toEqual([])
  })

  it('un proveedor sin adaptador lo dice en vez de fallar al primer correo', () => {
    const p = problemasDe(esquemaDelServidor, {
      ...base,
      EMAIL_PROVEEDOR: 'resend',
      EMAIL_REMITENTE: 'a@b.co',
      EMAIL_REMITENTE_NOMBRE: 'X',
    })
    expect(p).toHaveLength(1)
    expect(p[0]?.motivo).toContain('todavía no tiene adaptador')
  })

  it('un proveedor que no existe se nombra con los que hay', () => {
    expect(
      problemasDe(esquemaDelServidor, { ...base, EMAIL_PROVEEDOR: 'sendgrid' })[0]?.motivo,
    ).toContain('mailpit')
  })
})

// Las de Calesa (semilla §4). Sin Vercel no se exige nada nuevo: local, carriles, CI y e2e siguen con las tres del kit.
const publicas = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x',
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
  NEXT_PUBLIC_SITIO_URL: 'https://calesa.app',
}
const secreto = 'a'.repeat(32)
const delServidor = {
  SUPABASE_SECRET_KEY: 'sb_secret_x',
  RESEND_API_KEY: 're_prueba',
  TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
  CRON_SECRET: secreto,
  RESEND_WEBHOOK_SECRET: 'whsec_prueba',
  TOKEN_FIRMA_SECRETO: secreto,
  IP_SAL_SECRETO: secreto,
  ADMIN_EMAIL: 'admin@ejemplo.com',
}
const faltaEnVercel = (entorno: string, variables: string[]) =>
  variables.map((variable) => ({ variable, motivo: `falta (en Vercel ${entorno})` }))

describe('el entorno: lo que exige Vercel', () => {
  it('con VERCEL_ENV y nada más, nombra en una sola vuelta lo del kit y cada una de §4', () => {
    for (const entorno of ['production', 'preview']) {
      expect(problemasDe(esquemaPublico, { VERCEL_ENV: entorno })).toEqual([
        { variable: 'NEXT_PUBLIC_SUPABASE_URL', motivo: 'falta' },
        { variable: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', motivo: 'falta' },
        ...faltaEnVercel(entorno, ['NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'NEXT_PUBLIC_SITIO_URL']),
      ])
      expect(problemasDe(esquemaDelServidor, { VERCEL_ENV: entorno })).toEqual([
        { variable: 'SUPABASE_SECRET_KEY', motivo: 'falta' },
        ...faltaEnVercel(entorno, [
          'RESEND_API_KEY',
          'TURNSTILE_SECRET_KEY',
          'CRON_SECRET',
          'RESEND_WEBHOOK_SECRET',
          'TOKEN_FIRMA_SECRETO',
          'IP_SAL_SECRETO',
          'ADMIN_EMAIL',
        ]),
      ])
    }
  })

  it('un valor sólo de espacios falta, y cada variable se nombra una sola vez', () => {
    expect(
      problemasDe(esquemaPublico, {
        ...publicas,
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: '  ',
        VERCEL_ENV: 'production',
      }),
    ).toEqual([{ variable: 'NEXT_PUBLIC_TURNSTILE_SITE_KEY', motivo: 'falta' }])
  })

  it('completo en Vercel no tiene problemas; en producción la URL del sitio es https', () => {
    expect(problemasDe(esquemaPublico, { ...publicas, VERCEL_ENV: 'production' })).toEqual([])
    expect(problemasDe(esquemaDelServidor, { ...delServidor, VERCEL_ENV: 'production' })).toEqual(
      [],
    )
    expect(
      problemasDe(esquemaPublico, {
        ...publicas,
        NEXT_PUBLIC_SITIO_URL: 'http://calesa.app',
        VERCEL_ENV: 'production',
      }),
    ).toEqual([{ variable: 'NEXT_PUBLIC_SITIO_URL', motivo: 'en producción es https' }])
  })

  it('sin VERCEL_ENV, o con development, bastan las tres del kit', () => {
    const kit = {
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:55321',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'p',
      SUPABASE_SECRET_KEY: 's',
    }
    for (const extra of [{}, { VERCEL_ENV: 'development' }]) {
      expect(problemasDe(esquemaPublico, { ...kit, ...extra })).toEqual([])
      expect(problemasDe(esquemaDelServidor, { ...kit, ...extra })).toEqual([])
    }
  })

  it('los correos de avisos y de privacidad tienen su valor de F4', () => {
    const e = esquemaDelServidor.parse({ SUPABASE_SECRET_KEY: 's' })
    expect(e.EMAIL_AVISOS).toBe('equipo@getcalesa.com')
    expect(e.EMAIL_PRIVACIDAD).toBe('privacidad@getcalesa.com')
  })
})

describe('el entorno: los formatos de §4', () => {
  it('un formato malo se nombra con su motivo y nunca con su valor', () => {
    const malos = {
      SUPABASE_SECRET_KEY: 's',
      RESEND_API_KEY: 'sk_secreto_resend',
      RESEND_WEBHOOK_SECRET: 'secreto_del_webhook',
      CRON_SECRET: 'secreto-corto-del-cron',
      TOKEN_FIRMA_SECRETO: 'secreto-corto-de-firma',
      IP_SAL_SECRETO: 'secreto-corto-de-sal',
      ADMIN_EMAIL: 'admin-sin-arroba',
      EMAIL_AVISOS: 'avisos-sin-arroba',
      EMAIL_PRIVACIDAD: 'privacidad-sin-arroba',
      LEGAL_APROBADO: 'quizas-luego',
      VERCEL_ENV: 'ensayo-general',
    }
    const p = problemasDe(esquemaDelServidor, malos)
    expect(p).toEqual([
      { variable: 'RESEND_API_KEY', motivo: 'empieza con re_' },
      { variable: 'CRON_SECRET', motivo: 'al menos 32 caracteres' },
      { variable: 'RESEND_WEBHOOK_SECRET', motivo: 'empieza con whsec_' },
      { variable: 'TOKEN_FIRMA_SECRETO', motivo: 'al menos 32 caracteres' },
      { variable: 'IP_SAL_SECRETO', motivo: 'al menos 32 caracteres' },
      { variable: 'ADMIN_EMAIL', motivo: 'no es un correo' },
      { variable: 'EMAIL_AVISOS', motivo: 'no es un correo' },
      { variable: 'EMAIL_PRIVACIDAD', motivo: 'no es un correo' },
      { variable: 'LEGAL_APROBADO', motivo: 'es si o no' },
      { variable: 'VERCEL_ENV', motivo: 'es uno de production, preview, development' },
    ])
    const texto = JSON.stringify(p)
    for (const valor of Object.values(malos).filter((v) => v.length > 1))
      expect(texto).not.toContain(valor)
  })
})

describe('el entorno: la demo', () => {
  it('pide el proyecto y su sitio; el SMTP y el remitente son opcionales', () => {
    expect(problemasDe(esquemaDeLaDemo, {}).map((p) => p.variable)).toEqual([
      'DEMO_SUPABASE_URL',
      'DEMO_CLAVE_PUBLICA',
      'DEMO_CLAVE_SECRETA',
      'DEMO_SITE_URL',
    ])
  })

  it('un equipo de Vercel con mayúsculas se rechaza', () => {
    const p = problemasDe(esquemaDeLaDemo, { DEMO_VERCEL_EQUIPO: 'Mi Equipo' }).find(
      (x) => x.variable === 'DEMO_VERCEL_EQUIPO',
    )
    expect(p?.motivo).toContain('slug')
  })
})

describe('el mensaje', () => {
  it('lista cada variable con su motivo y nunca un valor', () => {
    expect(mensajeDeProblemas('la app', [{ variable: 'X', motivo: 'falta' }])).toBe(
      'El entorno de la app está incompleto (.env.example y pnpm env:check):\n  - X: falta',
    )
  })
})

// next.config.ts valida las públicas sólo en `next build`: `next typegen` (pnpm typecheck) llega con la misma fase y en CI no hay
// `.env.local`.
describe('cuándo valida la compilación', () => {
  it('en next build sí; en next typegen y en desarrollo no', () => {
    expect(validaLaCompilacion(PHASE_PRODUCTION_BUILD, ['node', 'next', 'build'])).toBe(true)
    expect(validaLaCompilacion(PHASE_PRODUCTION_BUILD, ['node', 'next', 'typegen'])).toBe(false)
    expect(validaLaCompilacion(PHASE_DEVELOPMENT_SERVER, ['node', 'next', 'dev'])).toBe(false)
  })
})
