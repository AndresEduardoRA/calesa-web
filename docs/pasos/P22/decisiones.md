# P22 · Decisiones

Este paso arma el layout del sitio:

- la CSP y las cabeceras de §4 sin nonces;
- el noindex fuera de producción;
- Archivo y JetBrains Mono con `next/font/google`;
- las pruebas de todo eso.

Es de riesgo rojo, así que el plan (`.piloto/planes/P22.md`) terminó en una compuerta `datos`. La auditoría tuvo dos rondas:

- la primera bloqueó, porque el noindex del layout en producción no tenía prueba roja; se corrigió con `robotsDelLayout()`;
- la segunda dejó observaciones, todas aplicadas.

## Autoelección (2026-11-17)

Tal cual la anotó el bucle (`hechos.json` › `autoelecciones`):

- 2026-11-17T13:41:33-04:00 · P22 · compuerta datos contestada sola (PILOTO_AUTO): aprobar

«Aprobar» deja vigentes las recomendadas de las dos preguntas del plan:

- **P1 · `@vercel/analytics` (dependencia nueva).** Queda fuera de P22: no se instala ni se monta `<Analytics />`. La CSP ya permite
  `https://va.vercel-scripts.com` en `script-src` y `connect-src`, así que sumarla no vuelve a tocar las cabeceras. **Pendiente:** un paso
  propio que la instale con la versión que dé npm ese día (la semilla lista `2.0.1`, verificada el 2026-10-31) y la monte en el layout,
  cuando la persona apruebe la dependencia (C6, X7). No se propone todavía: la opción «aprobar y proponer P40» no se eligió.
- **P2 · Google Fonts en la CSP.** No se permiten: `font-src 'self'` y ninguna directiva nombra `fonts.googleapis.com` ni
  `fonts.gstatic.com`. `next/font/google` baja las fuentes en `next build` y las sirve el sitio, así que el navegador nunca le pide nada a
  Google. Choca con la letra de §4 (semilla:411), que los nombra, y lo resolvió P2. El choque es interno de la semilla (§4 frente a §8.2,
  semilla:722), así que no aplica X17. Volver a la letra de §4 es sumar dos orígenes en `politica-de-contenido.ts`.

## Lo no obvio (2026-11-17)

- **Sin nonces, con `'unsafe-inline'`.** Con un nonce por pedido, toda página pasa a render dinámico y el PPR no los admite, pero las
  públicas tienen que seguir prerenderizadas. Next documenta, sin nonces, `script-src 'self' 'unsafe-inline'` y `style-src 'self'
'unsafe-inline'` (`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`). Hashes tampoco: un `'sha256-…'` (o un
  `'strict-dynamic'`) hace que el navegador ignore `'unsafe-inline'`, y el payload RSC en línea cambia en cada página. La guarda es la
  prueba «la portada sigue prerenderizada» del e2e: exige `compute: 'static'` en el manifiesto, y M14 la tumba.
- **Las cabeceras se arman al compilar**, en `headers()` de `next.config.ts`, con las variables del build (`NEXT_PUBLIC_SUPABASE_URL` y
  `VERCEL_ENV`, por `leerEntornoPublico()`). En Vercel, `VERCEL_ENV` existe al compilar. Por eso una vista previa que se promueva a
  producción sin volver a compilar conservaría el noindex de la vista previa (ver «Para la persona» en la bitácora).
- **El origen del Supabase local va en la CSP.** `*.supabase.co` no cubre `http://127.0.0.1:<puerto>`, que es lo que usan el dev, el e2e y
  el CI. Se suman su `http://` (a `connect-src` e `img-src`) y su `ws://` (realtime), y sólo si el comodín no lo cubre. Sin URL, o con una
  que no se puede leer, no se suma nada y no lanza: `next dev` y `typegen` pueden no tenerla, y el build ya la exige.
- **`upgrade-insecure-requests` sólo con `VERCEL_ENV` `production` o `preview`.** Fuera de Vercel el sitio y el Supabase local son
  `http://`: subirlos a https los rompería.
- **En `next dev`, además, `'unsafe-eval'` y `ws://localhost:*` / `ws://127.0.0.1:*`** (el HMR). Nunca en un build.
- **noindex:**
  - Sólo `VERCEL_ENV=production` se indexa (`seIndexa`).
  - Fuera de producción va `X-Robots-Tag: noindex, nofollow` en todo y `<meta name="robots">` noindex (`robotsDelLayout`).
  - En producción, la cabecera va sólo en `/panel/:path*` y `/reunion/:path*`, que cubren también su raíz. El layout no pone `robots` y
    lo indexable lo decide cada página o el `robots.ts` del carril `sitio`.
- **Las fuentes se enchufan en `globals.css`, no en `design/tokens.css`.** Su bloque es de la semilla. `--font-sans` pasa a
  `var(--fuente-archivo, 'Archivo'), 'Arial', sans-serif` (y lo mismo para la mono). Medido en el build, con Turbopack la familia se llama
  igual (`Archivo`; con webpack llevaría un hash). Igual la variable trae el respaldo ajustado (`'Archivo Fallback'`), que evita el salto
  al cambiar de fuente.
- **Archivo con `axes: ['wdth']` y sin `weight`.** Con `axes` el peso tiene que ser `variable`, así que trae `wght` 100–900: cubre el
  400–800 de §8.2 y en el CSS sale `font-stretch: 62% 125%` y `font-weight: 100 900`. JetBrains Mono, 400 y 500.
- **JetBrains Mono con `preload: false`.** En `/` sólo sale en rótulos pequeños (y en VIN, códigos y tablas), nunca en el LCP. El build
  precarga un solo `woff2`, el de Archivo.
- **`next build` necesita salir a `fonts.googleapis.com` y `fonts.gstatic.com`.** Sin red, el build falla (`next dev` usa el respaldo y
  avisa). Se supone que el runner de GitHub tiene salida a internet.
- **El toolbar de Vercel (`vercel.live`) queda bloqueado en las vistas previas**: §4 no lo nombra.
- **`cabeceras.ts` y `politica-de-contenido.ts` no importan con `@/`**, porque los carga `next.config.ts` por ruta relativa. El tipo de una
  regla se deriva de `NextConfig['headers']`, porque Next sólo lo exporta desde `next/dist`.
- **La prueba de cabeceras del e2e va por HTTP (`request`)**, no con `page.goto` como decía el plan: mira la respuesta del servidor y no
  necesita navegador, así que corre también donde falta Chromium.
