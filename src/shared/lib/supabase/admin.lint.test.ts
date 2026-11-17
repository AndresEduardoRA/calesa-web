// @vitest-environment node
// Quién puede crear el cliente admin, leído de la configuración real del lint (eslint.config.mjs). `calculateConfigForFile` sólo
// resuelve la ruta: sirve para las rutas de §9.3 y para `acceso/infra/auth-admin.ts` aunque todavía no existan.
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

const RAIZ = fileURLToPath(new URL('../../../../', import.meta.url))
const ADMIN = '@/shared/lib/supabase/admin'
const DIFERIDO = 'next/dynamic'
const GRUPO_CLIENTES = '@supabase/supabase-js'
const GRUPO_CORREO = 'resend'
const GRUPO_PANTALLAS = '!@/modules/*/pantallas/*'

const RUTAS_CON_ADMIN = [
  'src/app/api/solicitudes/route.ts',
  'src/app/api/reservas/route.ts',
  'src/app/api/horas/route.ts',
  'src/app/api/whatsapp/route.ts',
  'src/app/api/eventos/route.ts',
  'src/app/api/cron/diario/route.ts',
  'src/app/api/webhooks/resend/route.ts',
]
const INFRA_CON_ADMIN = 'src/modules/acceso/infra/auth-admin.ts'
const TESTIGOS_SIN_ADMIN = [
  'src/app/api/otra/route.ts',
  'src/app/api/solicitudes/ayudante.ts',
  'src/app/agendar/page.tsx',
  'src/app/(app)/layout.tsx',
  'src/modules/acceso/infra/queries/perfiles.ts',
  'src/modules/agenda/infra/rpc.ts',
]

const ConfigCalculada = z.object({ rules: z.record(z.string(), z.unknown()) })
const ReglaDeImports = z.tuple([
  z.union([z.literal(2), z.literal('error')]),
  z.object({
    paths: z.array(z.object({ name: z.string() })).optional(),
    patterns: z.array(z.object({ group: z.array(z.string()) })).optional(),
  }),
])

const eslint = new ESLint({ cwd: RAIZ })

/** Los imports prohibidos de una ruta: los nombres exactos y los grupos (cada uno, sus patrones unidos por espacio). */
async function prohibidos(ruta: string) {
  const config: unknown = await eslint.calculateConfigForFile(join(RAIZ, ruta))
  const { rules } = ConfigCalculada.parse(config)
  const [, opciones] = ReglaDeImports.parse(rules['no-restricted-imports'])
  return {
    nombres: (opciones.paths ?? []).map((p) => p.name),
    grupos: (opciones.patterns ?? []).map((p) => p.group.join(' ')),
  }
}

const conGrupo = (grupos: string[], patron: string) =>
  grupos.some((g) => g.split(' ').includes(patron))

describe('el cliente admin en el lint', { timeout: 30_000 }, () => {
  it.each(RUTAS_CON_ADMIN)('%s puede importarlo y conserva lo de src/app', async (ruta) => {
    const { nombres, grupos } = await prohibidos(ruta)
    expect(nombres).not.toContain(ADMIN)
    expect(nombres).toContain(DIFERIDO)
    expect(conGrupo(grupos, GRUPO_CLIENTES)).toBe(true)
    expect(conGrupo(grupos, GRUPO_CORREO)).toBe(true)
    expect(conGrupo(grupos, GRUPO_PANTALLAS)).toBe(true)
  })

  it(`${INFRA_CON_ADMIN} puede importarlo y conserva lo de infra/`, async () => {
    const { nombres, grupos } = await prohibidos(INFRA_CON_ADMIN)
    expect(nombres).not.toContain(ADMIN)
    expect(nombres).toContain(DIFERIDO)
    expect(grupos).toHaveLength(1)
    expect(conGrupo(grupos, GRUPO_CORREO)).toBe(true)
  })

  it.each(TESTIGOS_SIN_ADMIN)('%s sigue sin poder importarlo', async (ruta) => {
    const { nombres } = await prohibidos(ruta)
    expect(nombres).toContain(ADMIN)
  })

  it('src/shared/lib/supabase/ sigue pudiendo, sólo sin el SDK de correo', async () => {
    const { nombres, grupos } = await prohibidos('src/shared/lib/supabase/server.ts')
    expect(nombres).not.toContain(ADMIN)
    expect(grupos).toHaveLength(1)
    expect(conGrupo(grupos, GRUPO_CORREO)).toBe(true)
  })
})
