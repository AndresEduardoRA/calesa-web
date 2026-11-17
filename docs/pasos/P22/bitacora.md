# P22 · Bitácora

e2e completo: no. En la máquina del carril falta el navegador de Playwright (`chrome-headless-shell` 1248). Del spec nuevo corrieron las dos
pruebas que no abren navegador: las cabeceras por HTTP y la portada prerenderizada. Las tres que lo abren (sin violar la CSP, fuentes y
tema) cortan con `Executable doesn't exist`. El completo lo corre el CI del PR, porque `next.config.ts` está en `MUEVE_TODO` de
`scripts/e2e-dirigidos.mjs` y el rango es de nivel 2 por `shared` y `layout`. También lo corre el nocturno sobre `main`. Pero los dos corren
sólo en `escritorio` (`scripts/e2e-dirigidos.mjs:159`, `.github/workflows/ci.yml:112`): el spec en `movil` (Pixel 7) no lo corre nadie
todavía.

## Qué se hizo

| Commit    | Asunto                                                         | Qué lleva                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aefdc21` | `feat(base): enviar las cabeceras de §4 según el entorno`      | Archivos nuevos y cambiados: <ul><li>`politica-de-contenido.ts` (la CSP pura, sin nonces) y `cabeceras.ts` (`cabecerasDelSitio`, `seIndexa`, `robotsDelLayout`), con sus tests (52);</li><li>`next.config.ts`, que registra `headers()` con la fase y las variables del build;</li><li>el layout, que esparce `robotsDelLayout(VERCEL_ENV)` en su `metadata`;</li><li>la ficha `src/shared/CLAUDE.md`.</li></ul> |
| `e9a9d4e` | `feat(base): cargar las fuentes de la semilla con next/font`   | Fuentes y variables: <ul><li>en el layout, Archivo (`axes: ['wdth']`) y JetBrains Mono (400 y 500, `preload: false`), con sus variables en `<html>`;</li><li>en `globals.css`, `--font-sans` y `--font-mono` enchufados a `--fuente-archivo` y `--fuente-mono`.</li></ul>                                                                                                                                        |
| `22c70e4` | `test(base): probar cabeceras, fuentes y tema en el navegador` | `e2e/base/cabeceras.spec.ts`, con cinco pruebas: <ul><li>cabeceras y meta robots por HTTP;</li><li>sin violaciones de la CSP;</li><li>fuentes de next/font con el eje `wdth`;</li><li>tema que sigue al teléfono;</li><li>portada prerenderizada.</li></ul>                                                                                                                                                      |

No se tocaron `design/tokens.css`, `src/proxy.ts` ni `package.json`. Decisiones y autoelección: `decisiones.md`.

## Pruebas en rojo primero (`.piloto/salidas/P22/`)

- `rojo-vitest.txt`: contra `485abb6`, los dos archivos de test nuevos no cargan (`Failed to resolve import "./politica-de-contenido"`).
- `rojo-e2e.txt`: contra `485abb6`, con los tests nuevos en el árbol, `next build` corta en el chequeo de tipos (`TS2307` en
  `cabeceras.test.ts`). Por eso no hay rojo del spec contra HEAD; además, sin navegador, tres de sus pruebas no pueden correr en esta
  máquina.

## Verificación (2026-11-17)

| Qué                                                                                                                                          | Resultado                                                                                                                                                                                                                                                                                                                                                                          | Salida                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Prueba final del paso (`pnpm lint && pnpm typecheck && pnpm test && bash scripts/mapa.sh --check`) sobre `22c70e4`, con el entorno del bucle | lint y typecheck en 0; vitest 105 archivos y 1722/1722. Cae sólo `test:kit`, 41/48, con `rc=1`: lo mismo que en P06, P32 y P33, porque esos 7 dependen de las `PILOTO_*`/`COORD_*` del bucle                                                                                                                                                                                       | `final-head-con-entorno.txt`                                           |
| La misma prueba final sobre `22c70e4`, con `env -u` de cada `PILOTO_*`/`COORD_*`                                                             | `rc=0`: vitest 1722/1722, `test:kit` 48/48 y mapa `--check`                                                                                                                                                                                                                                                                                                                        | `final-head.txt`                                                       |
| `pnpm test:e2e e2e/base/cabeceras.spec.ts --project=escritorio`, sobre `22c70e4`                                                             | 2 pasan (cabeceras por HTTP y prerender); 3 no arrancan el navegador                                                                                                                                                                                                                                                                                                               | `e2e-final.txt`                                                        |
| Build de ese e2e (`.next-e2e/`)                                                                                                              | <ul><li>`routes-manifest.json`: una regla `/:path*` con CSP, `nosniff`, `Referrer-Policy` y `X-Robots-Tag`. La CSP trae el Supabase local del carril.</li><li>`prerender-manifest.json`: `/` con `response: complete` y `compute: static`.</li><li>CSS: `font-stretch: 62% 125%` y `font-weight: 100 900` en Archivo.</li><li>Un solo `woff2` precargado, el de Archivo.</li></ul> | los manifiestos y el CSS de `.next-e2e/`, del build de `e2e-final.txt` |
| `node scripts/guardas/carriles.mjs 485abb6 base/p22`                                                                                         | 9 archivos de `base/p22` cumplen, `rc=0`                                                                                                                                                                                                                                                                                                                                           | `nivel-y-carriles.txt`                                                 |
| `node scripts/piloto/nivel.mjs` del rango                                                                                                    | nivel 2 (`shared`, `layout`), con interfaz y sin cambios en `database.types.ts`                                                                                                                                                                                                                                                                                                    | `nivel-y-carriles.txt`                                                 |
| e2e dirigidos en `movil`, y `e2e/inicio.spec.ts`                                                                                             | no corrieron: abren el navegador                                                                                                                                                                                                                                                                                                                                                   | —                                                                      |
| `pnpm test:e2e:completo --project=escritorio` (nivel 2)                                                                                      | no corrió (ver el marcador arriba)                                                                                                                                                                                                                                                                                                                                                 | —                                                                      |

- **`SecurityFatalError`:** `next build` (Next 16.4.3) cortó con el aviso de una vulnerabilidad conocida, que pide actualizar Next.
  Apareció en el primer intento de casi todas las corridas, y el siguiente siempre compiló (`e2e-reintentos.txt` y los avisos de
  `mutaciones-e2e.txt`). Actualizar Next es una dependencia: no se hizo, y va en «Para la persona».
- **Saltadas:** una sola, condicional y con su motivo: la del prerender sin `E2E_PROD`, porque `next dev` no escribe el manifiesto.

## Mutaciones (`mutaciones-vitest.txt`, `mutaciones-e2e.txt`)

Cada una es un reemplazo exacto en el archivo de producto. Se restauró desde su copia y después se comprobó con `git status` y `git diff`.
Las del e2e compilan (`noUnusedLocals`): ninguna cae por un build roto.

| Mn  | Archivo                    | Qué se rompió                                                 | Cayó                                                                                          |
| --- | -------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| M1  | `politica-de-contenido.ts` | sin `'unsafe-inline'` en `script-src`                         | Vitest «permite los scripts y estilos en línea…» (4)                                          |
| M2  | `politica-de-contenido.ts` | `'unsafe-eval'` siempre                                       | Vitest «en producción no deja evaluar código»                                                 |
| M3  | `politica-de-contenido.ts` | no se suma el origen de `supabaseUrl`                         | Vitest del Supabase local y del https propio (2)                                              |
| M4  | `politica-de-contenido.ts` | `upgrade-insecure-requests` siempre                           | Vitest «no va con VERCEL_ENV=development / undefined» (2)                                     |
| M5  | `politica-de-contenido.ts` | `frame-ancestors 'self'`                                      | Vitest «cierra lo que no se usa» (4)                                                          |
| M6  | `cabeceras.ts`             | `seIndexa` también con `preview`                              | Vitest de `seIndexa`, de `robotsDelLayout` y del noindex fuera de producción (3)              |
| M7  | `cabeceras.ts`             | sin la regla `/reunion/:path*`                                | Vitest «en producción, sólo en el panel y en la gestión de reuniones»                         |
| M13 | `cabeceras.ts`             | `robotsDelLayout` con noindex siempre (lo de HEAD)            | Vitest «en producción no pone robots»                                                         |
| M8  | `next.config.ts`           | `headers()` sin reglas (`.slice(0, 0)`)                       | e2e de cabeceras: CSP vacía                                                                   |
| M12 | `src/app/layout.tsx`       | `robotsDelLayout(VERCEL_ENV ?? 'production')`                 | e2e de cabeceras: «el HTML no trae `<meta name="robots">`» (corrida 2, con la aserción final) |
| M14 | `src/app/layout.tsx`       | `await connection()` dentro de un `<Suspense>` en el `<body>` | e2e «la portada sigue prerenderizada» (`compute` deja de ser `static`)                        |

**No se hicieron M9, M10 ni M11** (las fuentes en el navegador), porque sus pruebas necesitan Chromium. No se dan por caídas, y nadie las
hace: el CI corre pruebas, no mutaciones.

## Pendientes

- `@vercel/analytics`: un paso propio cuando la persona apruebe la dependencia (P1, `decisiones.md`).
- **Las tres pruebas del spec con navegador nunca se ejecutaron**: ni en rojo ni en verde. Prettier las reformateó y quedaron en sus líneas
  de HEAD (34, 56 y 109) después de las corridas de las 13:52. El completo de `escritorio` del CI va a ser su primera ejecución: si caen
  ahí, primero se mira la prueba y después el producto.
- **Sin dueño:** las mutaciones M9–M11 y el spec en `movil`. Necesitan una máquina con Chromium, y el CI sólo corre `escritorio`.
- **Zod en el navegador bajo esta CSP:** fuera de `next dev` no hay `'unsafe-eval'`, pero Zod 4 prueba `new Function("")` la primera vez
  que se usa en el cliente. La CSP lo bloquea y lo reporta como `securitypolicyviolation`, aunque Zod se trague la excepción
  (`node_modules/zod/v4/core/util.js:218-233`). Hoy no muerde: `/` no usa Zod en el cliente. Una pantalla con formulario sí lo usaría, y un
  chequeo de violaciones en esa ruta caería. La salida es `z.config({ jitless: true })` en lo compartido del cliente, en un paso de `base`.

## Para la persona

- **Next.js 16.4.3 tiene una vulnerabilidad conocida.** `next build` lo avisa con `SecurityFatalError` y recomienda actualizar. Es una
  dependencia (`package.json`, carril `base`): conviene un paso propio que lo actualice con la versión verificada ese día.
- **Promover una vista previa a producción:** las cabeceras se arman al compilar. Si Vercel promueve un despliegue de vista previa sin
  volver a compilar, producción quedaría con el noindex y la CSP de la vista previa. Conviene confirmarlo en el paso de despliegue, o
  desplegar producción siempre con su propio build.
- **Zod con `jitless`** antes de la primera pantalla con formulario (ver «Pendientes»).
