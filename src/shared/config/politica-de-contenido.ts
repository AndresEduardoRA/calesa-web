// La Content-Security-Policy del sitio (semilla §4), como función pura: la arma `cabeceras.ts` y la manda `next.config.ts` en
// `headers()`. Sin `@/` ni `process.env`: la carga la configuración de Next por ruta relativa, y lo del entorno entra por parámetro.
//
// Va sin nonces, a propósito: con un nonce por pedido toda página pasa a render dinámico (y el PPR no los admite), y las públicas
// tienen que seguir prerenderizadas. Sin nonces, Next documenta `'unsafe-inline'` en `script-src` y `style-src`
// (node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md). Por eso nunca un `'nonce-…'`, un `'sha256-…'` ni
// `'strict-dynamic'`: con cualquiera, el navegador ignora `'unsafe-inline'` y dejan de correr los scripts en línea de Next (el payload
// RSC) y de next-themes.
//
// Un origen externo nuevo (un script, un iframe, una API que llama el navegador) se suma acá, con su test.

export type OpcionesDePolitica = {
  // `next dev`: el HMR evalúa código y abre un websocket.
  desarrollo: boolean
  // NEXT_PUBLIC_SUPABASE_URL. Fuera de Vercel es el Supabase local (`http://127.0.0.1:<puerto>`), que no cubre el comodín.
  supabaseUrl: string | undefined
  // VERCEL_ENV: `production`, `preview`, `development` o nada (local, CI, e2e).
  vercelEnv: string | undefined
}

const TURNSTILE = 'https://challenges.cloudflare.com'
const ANALITICA_DE_VERCEL = 'https://va.vercel-scripts.com'
const SUPABASE = 'https://*.supabase.co'
const SUPABASE_REALTIME = 'wss://*.supabase.co'

type OrigenesDeSupabase = { conexion: string[]; imagenes: string[] }

// El origen de la URL de Supabase, si el comodín no lo cubre: el http(s) para la API y las imágenes, y su ws(s) para realtime.
// Sin URL, o con una que no se lee, nada: en `next dev` y en `next typegen` puede faltar, y el build ya la exige.
function origenesDeSupabase(supabaseUrl: string | undefined): OrigenesDeSupabase {
  const ninguno = { conexion: [], imagenes: [] }
  if (!supabaseUrl || !URL.canParse(supabaseUrl)) return ninguno
  const url = new URL(supabaseUrl)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return ninguno
  if (url.protocol === 'https:' && url.port === '' && url.hostname.endsWith('.supabase.co'))
    return ninguno
  const websocket = `${url.protocol === 'https:' ? 'wss' : 'ws'}://${url.host}`
  return { conexion: [url.origin, websocket], imagenes: [url.origin] }
}

export function politicaDeContenido({
  desarrollo,
  supabaseUrl,
  vercelEnv,
}: OpcionesDePolitica): string {
  const supabase = origenesDeSupabase(supabaseUrl)
  const enVercel = vercelEnv === 'production' || vercelEnv === 'preview'

  // En orden fijo; una directiva sin fuentes (`upgrade-insecure-requests`) va sola. `null` = no va.
  const directivas: [string, string[] | null][] = [
    ['default-src', ["'self'"]],
    [
      'script-src',
      [
        "'self'",
        "'unsafe-inline'",
        TURNSTILE,
        ANALITICA_DE_VERCEL,
        ...(desarrollo ? ["'unsafe-eval'"] : []),
      ],
    ],
    ['style-src', ["'self'", "'unsafe-inline'"]],
    ['img-src', ["'self'", 'data:', 'blob:', SUPABASE, ...supabase.imagenes]],
    // next/font sirve Archivo y JetBrains Mono desde el sitio: el navegador nunca le pide nada a Google.
    ['font-src', ["'self'"]],
    [
      'connect-src',
      [
        "'self'",
        SUPABASE,
        SUPABASE_REALTIME,
        ANALITICA_DE_VERCEL,
        ...supabase.conexion,
        ...(desarrollo ? ['ws://localhost:*', 'ws://127.0.0.1:*'] : []),
      ],
    ],
    ['frame-src', [TURNSTILE]],
    ['object-src', ["'none'"]],
    ['base-uri', ["'self'"]],
    ['form-action', ["'self'"]],
    ['frame-ancestors', ["'none'"]],
    // Fuera de Vercel el sitio y el Supabase local son http://: subirlos a https los rompería.
    ['upgrade-insecure-requests', enVercel ? [] : null],
  ]

  return directivas
    .filter((directiva): directiva is [string, string[]] => directiva[1] !== null)
    .map(([nombre, fuentes]) => [nombre, ...new Set(fuentes)].join(' '))
    .join('; ')
}
