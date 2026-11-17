# shared

Infraestructura transversal sin reglas de negocio: clientes de Supabase, errores como valores, formato de números y fechas, paginación, configuración, correo y los componentes de interfaz que usan todos los módulos.

## Entra y sale

- Entra: nada de `src/modules` ni de `src/app`. `shared` sólo importa `shared`.
- Sale: lo consumen `app/` y las tres capas de cada módulo.

## Archivos clave

- `lib/supabase/` — `server.ts` (`createClient()`, uno por request), `browser.ts`, `admin.ts` (secret key, salta la RLS), `proxy.ts` (`actualizarSesion()`).
- `lib/safe-action.ts` — `actionClient` (exige sesión; `ctx` trae `supabase` y `usuarioId`) y `actionClientPublico`. Toda mutación entra por acá.
- `lib/errores.ts` — `Resultado<T>`, `ok()`, `fallo()`, `conflicto()`, `errorDePostgrest()` (`PT409` → conflicto, `42501` → sin_permiso, `23505` → duplicado), `datosO()`.
- `lib/formato.ts`, `lib/fechas.ts` — todo número y toda fecha salen de acá, en el locale y la zona del proyecto. `formatearFechaConDia()` da «mar 3 nov, 10:00» (semilla §6.8) para correos y avisos de citas. Los montos de Calesa: `formatoUSD()` («US$ 4.452», entero con la mitad hacia arriba) y `formatoRango()` («US$ 4.452 – US$ 8.935»).
- `lib/paginacion.ts` — el tamaño de toda página sale de acá (`TAMANOS_DE_PAGINA`, `tamanoDePagina()`, `TAMANO_DE_VER_MAS`, `TOPE_DE_LO_CARGADO`); keyset `leerCursor()`, `codificarCursor()`, `armarPagina()`.
- `lib/conteo.ts` — un número que se muestra nunca es un total exacto: `conteoAcotado()`, `cantidadAcotada()`, `cortarAlTope()`, `textoDelTope()`.
- `lib/email/` — `enviarEmail()`: la única puerta del correo; un adaptador REST por proveedor (`EMAIL_PROVEEDOR`: `mailpit` y `resend`, en `adaptadores/resend-api.ts` porque el lint atrapa un import llamado `resend`). `programarEmail()`, `cancelarEmail()` y `reprogramarEmail()` sólo con Resend (`programaCorreos()`); con Mailpit o `ninguno` dan `regla` sin red. `referencia` es la clave de idempotencia: una por cuerpo. `adjuntos` (`{ nombre, tipo, contenido }`, contenido en base64; hasta 5, de 5 MB cada uno; el nombre sin rutas ni saltos de línea y el `tipo` MIME en una línea, como `text/calendar; method=REQUEST`) llegan a Mailpit (`Attachments`) y a Resend (`attachments`) validados por `esquemaDeAdjunto`.
- `lib/seguridad/` — las defensas de las escrituras públicas, el webhook y el cron (sólo servidor, por `index.ts`): `verificarTurnstile()`, `limitar(accion, ip, contar)` con `LIMITES` (5/h formulario y detalle, 10/h reservas, 30/h WhatsApp, 60/h eventos), `contadorDeSupabase(cliente)` (el `ContarEnvio` sobre la RPC `contar_envio`; el cliente, `ClienteDeContarEnvio`, entra por parámetro), `ipDelPedido()`, `firmarTokenDeSolicitud()` / `verificarTokenDeSolicitud()` (2 h), `generarTokenDeGestion()` / `hashDeTokenDeGestion()` (32 bytes; la base guarda el sha256 como bytea `\x…`), `verificarSecretoDelCron()` e `igualesEnTiempoConstante()`. Todo falla cerrado.
- `config/esquemas.ts` — el entorno en Zod (puro): públicas, servidor y demo; lo usan `entorno.ts`, `servidor.ts`, `next.config.ts` y `pnpm env:check`. Las de Calesa (semilla §4) son obligatorias sólo con `VERCEL_ENV=preview|production`; fuera de Vercel sólo se revisa su formato. `config/app.ts`: nombre, descripción y las copias de los colores.
- `config/entorno.ts` — `entornoPublico()` y `urlDelSitio(respaldo?)`: la URL del sitio para enlaces absolutos. Nadie lee `NEXT_PUBLIC_SITIO_URL` directo; en Vercel nunca usa el respaldo (el Host del pedido).
- `config/politica-de-contenido.ts` — `politicaDeContenido(opciones)`: la CSP de la semilla §4, pura y sin nonces (`'unsafe-inline'` en scripts y estilos; en `next dev`, además `'unsafe-eval'` y el websocket del HMR). Suma el origen de `NEXT_PUBLIC_SUPABASE_URL` cuando el comodín `*.supabase.co` no lo cubre (el Supabase local) y `upgrade-insecure-requests` sólo en Vercel.
- `config/cabeceras.ts` — `cabecerasDelSitio(opciones)` (CSP, `nosniff`, `Referrer-Policy` y `X-Robots-Tag`), `seIndexa(vercelEnv)` (sólo `production`) y `robotsDelLayout(vercelEnv)`, que el layout esparce en su `metadata`. Las usa `next.config.ts` en `headers()`, armadas al compilar.
- `ui/diferido.tsx` — `diferido()`: el único lugar que carga código diferido (el lint prohíbe `next/dynamic`).
- `ui/button.tsx`, `ui/aviso.tsx` — lo mínimo que usan `diferido()` y `not-found`; los de shadcn los reemplazan con la misma API.
- `types/database.types.ts` — generado por `pnpm db:types`. No se edita.

## No se rompe

- `shared` no importa módulos: locale, moneda, zona horaria, nombre y color entran por props desde `app/`.
- Los clientes de Supabase sólo desde `lib/supabase/` y `infra/` de un módulo. Ningún componente ni hook los usa.
- Todo número pasa por `formato.ts` y toda fecha por `fechas.ts`; `toFixed` está prohibido por lint.
- Nada anima `font-size` ni el alto: sin `transition-all`.

## Ojo

- `admin.ts` importa `server-only`; el lint sólo deja importarlo desde los archivos exactos de `DONDE_SE_PERMITE_EL_ADMIN` (`eslint.config.mjs`): los siete `route.ts` de la semilla §9.3 y `src/modules/acceso/infra/auth-admin.ts` (`datos.md`). Un archivo nuevo, aunque sea un ayudante junto a una ruta, se suma en un paso de `base` con su caso en `lib/supabase/admin.lint.test.ts`; ninguna página lo crea (`/reunion/[token]` lee por `/api/reservas`). El lint mira sólo el import directo.
- `entornoPublico()` valida al primer uso; las `NEXT_PUBLIC_*` se leen con el nombre literal.
- Los textos hablan de tú, también los `MENSAJE_*` de `errores.ts`.
- `limitar` recibe quién cuenta (`ContarEnvio`) por parámetro: `seguridad/` no importa el cliente admin. La IP nunca sale en claro (va `sha256(ip + IP_SAL_SECRETO)`; una IPv6 se cuenta por su /64) y a Turnstile va la IP completa de `ipDelPedido`, nunca el /64. El token de solicitud se firma con `emitidoEn` (cuando se entrega), nunca con `solicitudes.creado_en`. `crearContadorEnMemoria` vive en un `*.soporte.ts`: las pruebas lo importan por su ruta.
- `contadorDeSupabase(cliente)` se arma por petición, nunca en un `const` a nivel de módulo: guarda el cliente (el admin, en las rutas) y el admin no vive en una variable global. Un fallo de la RPC da `inesperado` y nunca muestra su texto (el `22023` de `contar_envio` nombra la clave): sólo pasan los textos del kit de `errorDePostgrest` (`MENSAJE_SIN_RESPUESTA`, `MENSAJE_SIN_CONEXION`, `MENSAJE_INESPERADO`). La tabla de casos de `ContarEnvio` vive en `casos-de-contar-envio.soporte.ts` y la corren la memoria y el adaptador; `supabase/tests/limites.sql` es su copia. Ese soporte importa `LIMITES` como valor, así que toda suite que lo use hace `vi.mock('server-only', () => ({}))`.
- `vitest` no limpia solo entre pruebas: un test que monta diálogos usa `afterEach(cleanup)`.
- Un origen externo nuevo que use el navegador (un script, un iframe, una API) se suma en `config/politica-de-contenido.ts`, con su test: si no, la CSP lo bloquea. Nunca un nonce, un hash ni `'strict-dynamic'` (anulan `'unsafe-inline'` y rompen los scripts en línea de Next y de next-themes) ni nada que se lea por pedido en el layout: las páginas públicas tienen que seguir prerenderizadas (lo vigila `e2e/base/cabeceras.spec.ts`).
- `config/politica-de-contenido.ts` y `config/cabeceras.ts` no importan con `@/`: los carga `next.config.ts` por ruta relativa. El `noindex` sale de `seIndexa`: fuera de `VERCEL_ENV=production`, todo el sitio; en producción, `/panel` y `/reunion`.
