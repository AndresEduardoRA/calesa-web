import { readFileSync } from 'node:fs'
import path from 'node:path'

import { expect, test } from '@playwright/test'

// El layout de P22 en el navegador: las cabeceras de §4 que arma `next.config.ts` (`src/shared/config/cabeceras.ts`), las fuentes de
// §8.2 por next/font y el tema que sigue al teléfono. El e2e corre contra un build sin `VERCEL_ENV`, o sea, fuera de producción: todo
// lleva noindex. Lo de producción lo prueba Vitest (`cabeceras.test.ts`). No escribe en la base.

declare global {
  interface Window {
    __violacionesDeLaCsp?: string[]
  }
}

// Por HTTP, sin abrir el navegador: lo que se mira es la respuesta del servidor.
test('E2E cabeceras: la portada trae la CSP y las cabeceras de §4', async ({ request }) => {
  const respuesta = await request.get('/')
  expect(respuesta.ok(), `la portada respondió ${String(respuesta.status())}`).toBe(true)
  const cabeceras = respuesta.headers()

  const csp = cabeceras['content-security-policy'] ?? ''
  expect(csp).toContain("default-src 'self'")
  expect(csp).toContain("frame-ancestors 'none'")
  expect(csp).toContain("object-src 'none'")
  expect(cabeceras['x-content-type-options']).toBe('nosniff')
  expect(cabeceras['referrer-policy']).toBe('strict-origin-when-cross-origin')
  expect(cabeceras['x-robots-tag']).toBe('noindex, nofollow')
  // El mismo noindex en el HTML: el `metadata` del layout.
  const robots = /<meta name="robots" content="([^"]*)"/.exec(await respuesta.text())?.[1]
  expect(robots, 'el HTML no trae <meta name="robots">').toMatch(/noindex/)
})

test('E2E cabeceras: la portada carga sin violar la CSP', async ({ page }) => {
  // Se escucha desde antes de que corra el primer script: los en línea de Next y de next-themes son los primeros en caer.
  await page.addInitScript(() => {
    window.__violacionesDeLaCsp = []
    document.addEventListener('securitypolicyviolation', (evento) => {
      window.__violacionesDeLaCsp?.push(
        `${evento.violatedDirective} ← ${evento.blockedURI || 'en línea'}`,
      )
    })
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.waitForLoadState('load')
  await page.evaluate(async () => {
    await document.fonts.ready
  })

  expect(
    await page.evaluate(() => window.__violacionesDeLaCsp ?? ['no se instaló el escucha']),
  ).toEqual([])
})

test('E2E fuentes: Archivo y JetBrains Mono vienen de next/font', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  const fuentes = await page.evaluate(async () => {
    const estilo = getComputedStyle(document.documentElement)
    const limpia = (valor: string) => valor.trim().replace(/\s+/g, ' ')
    const sinComillas = (valor: string) => valor.trim().replace(/^["']|["']$/g, '')
    // La familia que next/font deja en su variable (`--fuente-*`), el token que la usa (`--font-*`) y las caras que carga.
    const leer = async (propia: string, token: string) => {
      const valor = limpia(estilo.getPropertyValue(propia))
      const familia = sinComillas(valor.split(',')[0] ?? '')
      const caras = familia === '' ? [] : await document.fonts.load(`16px "${familia}"`)
      return {
        valor,
        token: limpia(estilo.getPropertyValue(token)),
        familia,
        caras: caras.map((cara) => ({
          familia: sinComillas(cara.family),
          estado: cara.status,
          ancho: cara.stretch,
        })),
      }
    }
    return {
      sans: await leer('--fuente-archivo', '--font-sans'),
      mono: await leer('--fuente-mono', '--font-mono'),
    }
  })

  for (const [nombre, fuente, parecido] of [
    ['sans', fuentes.sans, /Archivo/],
    ['mono', fuentes.mono, /JetBrains/],
  ] as const) {
    // La variable de next/font está en <html> y el token empieza por ella, no por el literal de design/tokens.css.
    expect(fuente.valor, `${nombre}: la variable de next/font`).not.toBe('')
    expect(
      fuente.token.startsWith(fuente.valor),
      `${nombre}: ${fuente.token} no empieza por ${fuente.valor}`,
    ).toBe(true)
    expect(fuente.familia, nombre).toMatch(parecido)
    expect(fuente.caras.length, `${nombre}: ninguna cara de ${fuente.familia}`).toBeGreaterThan(0)
    for (const cara of fuente.caras) {
      expect(cara.familia, nombre).toBe(fuente.familia)
      expect(cara.estado, nombre).toBe('loaded')
    }
  }
  // El eje wdth de Archivo (§8.2): la cara declara un rango de anchos, no un ancho fijo.
  expect(fuentes.sans.caras.map((cara) => cara.ancho)).toContainEqual(
    expect.stringMatching(/^\d+(\.\d+)?% \d+(\.\d+)?%$/),
  )
})

test('E2E tema: <html> sigue la preferencia del teléfono', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  await expect(page.locator('html')).toHaveClass(/(^|\s)dark(\s|$)/)

  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  await expect(page.locator('html')).not.toHaveClass(/(^|\s)dark(\s|$)/)
})

test('E2E cabeceras: la portada sigue prerenderizada', () => {
  // En `next dev` no hay manifiesto de prerender: la prueba sólo dice algo contra el build de `pnpm test:e2e`.
  test.skip(
    !process.env['E2E_PROD'],
    'sin E2E_PROD corre next dev, que no escribe prerender-manifest.json',
  )
  const carpeta = process.env['NEXT_DIST_DIR'] ?? '.next-e2e'
  const manifiesto = JSON.parse(
    readFileSync(path.join(process.cwd(), carpeta, 'prerender-manifest.json'), 'utf8'),
  ) as {
    routes: Record<string, { response?: string; compute?: string } | undefined>
  }
  // Sin nonces nada se lee por pedido: la portada sale entera del build, sin partes pospuestas.
  expect(manifiesto.routes['/'], 'la portada no está en el manifiesto de prerender').toMatchObject({
    response: 'complete',
    compute: 'static',
  })
})
