import { z } from 'zod'

// Las variables de entorno, en un solo lugar: qué pide cada entorno y qué falta. Puro (sin `process.env` ni `server-only`): lo usan
// la app al arrancar y al compilar, y `pnpm env:check` (scripts/env-check.ts). Una variable nueva se agrega aquí, en `.env.example`
// y, si es pública, en `leerEntornoPublico()` de `entorno.ts`.

const texto = z.string().trim().min(1, { error: 'falta' })
const url = z.url({ error: 'no es una URL' })
const opcional = <T extends z.ZodType>(esquema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), esquema.optional())
const conValor = (esquema: z.ZodType<string>, porDefecto: string) =>
  z.preprocess((v) => (v === '' ? undefined : v), esquema.default(porDefecto))
const correo = z.email({ error: 'no es un correo' })
const secreto = z.string().trim().min(32, { error: 'al menos 32 caracteres' })
const conPrefijo = (prefijo: string) =>
  z
    .string()
    .trim()
    .startsWith(prefijo, { error: `empieza con ${prefijo}` })

// Lo que una vista previa o producción no puede no tener (semilla §4). Ahí, lo que falte → `falta (en Vercel <entorno>)`.
const PUBLICAS_EN_VERCEL = ['NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'NEXT_PUBLIC_SITIO_URL'] as const
const DEL_SERVIDOR_EN_VERCEL = [
  'RESEND_API_KEY',
  'TURNSTILE_SECRET_KEY',
  'CRON_SECRET',
  'RESEND_WEBHOOK_SECRET',
  'TOKEN_FIRMA_SECRETO',
  'IP_SAL_SECRETO',
  'ADMIN_EMAIL',
] as const

// Va con `{ when: () => true }`: sin él, Zod 4 la salta si el objeto ya falló, y una vuelta de `env:check` nombraría sólo lo del
// kit. Por eso lee cada valor como `unknown`: le puede llegar un objeto a medio validar.
function exigirEnVercel(variables: readonly string[]) {
  return (e: Record<string, unknown>, ctx: z.RefinementCtx) => {
    const despliegue = e['VERCEL_ENV']
    if (despliegue !== 'production' && despliegue !== 'preview') return
    for (const variable of variables) {
      const valor = e[variable]
      if (typeof valor === 'string' && valor.trim() !== '') continue
      ctx.addIssue({ code: 'custom', path: [variable], message: `falta (en Vercel ${despliegue})` })
    }
  }
}

// En producción la URL del sitio es https (los enlaces de los correos y el `metadataBase` salen de ella).
function sitioConHttps(e: Record<string, unknown>, ctx: z.RefinementCtx) {
  const sitio = e['NEXT_PUBLIC_SITIO_URL']
  if (e['VERCEL_ENV'] !== 'production' || typeof sitio !== 'string') return
  if (!sitio.startsWith('https://'))
    ctx.addIssue({
      code: 'custom',
      path: ['NEXT_PUBLIC_SITIO_URL'],
      message: 'en producción es https',
    })
}

export const PROVEEDORES_DE_EMAIL = ['ninguno', 'mailpit', 'resend', 'cloudflare'] as const
export type ProveedorDeEmail = (typeof PROVEEDORES_DE_EMAIL)[number]

// Los proveedores con adaptador en `src/shared/lib/email/adaptadores/`. Los demás se nombran para decirlo antes del primer correo.
export const PROVEEDORES_CON_ADAPTADOR: readonly ProveedorDeEmail[] = ['ninguno', 'mailpit']

// Lo pone Vercel en cada despliegue. Sin ella (local, carriles, CI, e2e) no se exige nada de lo que pide sólo Vercel.
export const ENTORNOS_DE_VERCEL = ['production', 'preview', 'development'] as const
const entornoDeVercel = opcional(
  z.enum(ENTORNOS_DE_VERCEL, { error: `es uno de ${ENTORNOS_DE_VERCEL.join(', ')}` }),
)

// Viajan al navegador: el nombre literal `NEXT_PUBLIC_*` (Next sólo incrusta las que se escriben así).
export const esquemaPublico = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: texto,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: opcional(texto),
    // Nadie la lee directo: se pide con `urlDelSitio()` de `entorno.ts`.
    NEXT_PUBLIC_SITIO_URL: opcional(url),
    // En el navegador queda `undefined` (no es `NEXT_PUBLIC_*`), y ahí no exige nada.
    VERCEL_ENV: entornoDeVercel,
  })
  .superRefine(exigirEnVercel(PUBLICAS_EN_VERCEL), { when: () => true })
  .superRefine(sitioConHttps, { when: () => true })

// Sólo servidor.
export const esquemaDelServidor = z
  .object({
    SUPABASE_SECRET_KEY: texto,
    EMAIL_PROVEEDOR: z
      .enum(PROVEEDORES_DE_EMAIL, { error: `es uno de ${PROVEEDORES_DE_EMAIL.join(', ')}` })
      .default('ninguno'),
    EMAIL_REMITENTE: opcional(z.email({ error: 'no es un correo' })),
    EMAIL_REMITENTE_NOMBRE: opcional(texto),
    MAILPIT_URL: opcional(url),
    // Las de Calesa (semilla §4): obligatorias sólo en Vercel (abajo); fuera de Vercel sólo se revisa su formato.
    RESEND_API_KEY: opcional(conPrefijo('re_')),
    TURNSTILE_SECRET_KEY: opcional(texto),
    CRON_SECRET: opcional(secreto),
    RESEND_WEBHOOK_SECRET: opcional(conPrefijo('whsec_')),
    TOKEN_FIRMA_SECRETO: opcional(secreto),
    IP_SAL_SECRETO: opcional(secreto),
    ADMIN_EMAIL: opcional(correo),
    EMAIL_AVISOS: conValor(correo, 'equipo@getcalesa.com'),
    EMAIL_PRIVACIDAD: conValor(correo, 'privacidad@getcalesa.com'),
    // La exige el build de producción (paso P10); aquí sólo se declara.
    LEGAL_APROBADO: opcional(z.enum(['si', 'no'], { error: 'es si o no' })),
    VERCEL_ENV: entornoDeVercel,
  })
  .superRefine((e, ctx) => {
    if (e.EMAIL_PROVEEDOR === 'ninguno') return
    for (const clave of ['EMAIL_REMITENTE', 'EMAIL_REMITENTE_NOMBRE'] as const) {
      if (!e[clave])
        ctx.addIssue({
          code: 'custom',
          path: [clave],
          message: `falta (EMAIL_PROVEEDOR=${e.EMAIL_PROVEEDOR})`,
        })
    }
    if (e.EMAIL_PROVEEDOR === 'mailpit' && !e.MAILPIT_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['MAILPIT_URL'],
        message: 'falta (EMAIL_PROVEEDOR=mailpit)',
      })
    }
    if (!PROVEEDORES_CON_ADAPTADOR.includes(e.EMAIL_PROVEEDOR)) {
      ctx.addIssue({
        code: 'custom',
        path: ['EMAIL_PROVEEDOR'],
        message: `${e.EMAIL_PROVEEDOR} todavía no tiene adaptador (src/shared/lib/email/adaptadores/); hoy: ${PROVEEDORES_CON_ADAPTADOR.join(' o ')}`,
      })
    }
  })
  .superRefine(exigirEnVercel(DEL_SERVIDOR_EN_VERCEL), { when: () => true })

// `.env.demo`: lo que leen los scripts de la demo (un proyecto de Supabase en la nube, sin datos reales). Nunca lo lee la app.
export const esquemaDeLaDemo = z.object({
  DEMO_SUPABASE_URL: url,
  DEMO_CLAVE_PUBLICA: texto,
  DEMO_CLAVE_SECRETA: texto,
  DEMO_SITE_URL: url,
  // El equipo de Vercel, para el comodín de los previews (`https://*-<equipo>.vercel.app/**`, sólo demo).
  DEMO_VERCEL_EQUIPO: opcional(
    z
      .string()
      .regex(/^[a-z0-9-]+$/, { error: 'es el slug del equipo (minúsculas, números y guiones)' }),
  ),
  // El SMTP de los correos de Auth. Sin él, Supabase manda con su SMTP de prueba (pocos correos por hora).
  SMTP_HOST: opcional(texto),
  SMTP_USUARIO: opcional(texto),
  SMTP_CLAVE: opcional(texto),
  EMAIL_REMITENTE: opcional(z.email({ error: 'no es un correo' })),
  EMAIL_REMITENTE_NOMBRE: opcional(texto),
})

export type Problema = { variable: string; motivo: string }

// Lo que falta o está mal en `entorno` según `esquema`, sin los valores (nunca se imprime un valor). Una variable, un motivo: el
// primero (la regla de Vercel puede repetir una que su formato ya rechazó).
export function problemasDe(
  esquema: z.ZodType,
  entorno: Record<string, string | undefined>,
): Problema[] {
  const r = esquema.safeParse(entorno)
  if (r.success) return []
  const vistas = new Set<string>()
  return r.error.issues.flatMap((i) => {
    const variable = i.path.map(String).join('.') || '(entorno)'
    if (vistas.has(variable)) return []
    vistas.add(variable)
    return [
      {
        variable,
        motivo: i.code === 'invalid_type' && i.input === undefined ? 'falta' : i.message,
      },
    ]
  })
}

// Si `next.config.ts` valida las públicas: sólo en `next build`. `next typegen` (el `pnpm typecheck`) carga la configuración con la
// misma fase y no las necesita; se reconoce por su subcomando.
export function validaLaCompilacion(fase: string, argv: readonly string[]): boolean {
  return fase === 'phase-production-build' && !argv.includes('typegen')
}

// Un mensaje para cortar el arranque o el build, con cada variable y su motivo.
export function mensajeDeProblemas(donde: string, problemas: readonly Problema[]): string {
  return [
    `El entorno de ${donde} está incompleto (.env.example y pnpm env:check):`,
    ...problemas.map((p) => `  - ${p.variable}: ${p.motivo}`),
  ].join('\n')
}
