# P06 · Decisiones

Fecha: 2026-11-17 (America/La_Paz). El plan (`.piloto/planes/P06.md`) se auditó en dos rondas: la primera bloqueó (la IPv6 en /64 iba a
Turnstile y faltaban pruebas de tiempo constante en el cron y el token) y la segunda dio observaciones, aplicadas. Terminó en la compuerta
`datos` de todo paso rojo, que se contestó sola. Autoelección, tal cual de `hechos.json › autoelecciones`:

- 2026-11-17T08:25:23-04:00 · P06 · compuerta datos contestada sola (PILOTO_AUTO): aprobar

La autoelección aprobó el plan; nadie contestó sus preguntas. P2–P5 se tomaron con la opción que el plan recomendaba (abajo). P1 la
contestó la persona después, en la compuerta `afuera` con que cerró la ejecución (más abajo).

## Respuestas a las preguntas del plan

- **P2 · texto del límite:** «Hiciste varios envíos seguidos. Vuelve a intentar en una hora.» (`TEXTO_LIMITE`). Es una constante: se
  cambia sin migrar nada.
- **P3 · texto de Turnstile:** «No pudimos comprobar que eres una persona. Vuelve a intentar.» (`TEXTO_TURNSTILE`).
- **P4 · IPv6:** se cuenta por su prefijo /64 y la IPv4 por dirección. Quienes comparten una /64 comparten límite, igual que quienes comparten
  una IPv4 detrás de un NAT.
- **P5 · sin `TURNSTILE_SECRET_KEY` fuera de Vercel:** falla cerrado (`inesperado`, sin red). Local y e2e usan la clave de prueba pública de
  `.env.example` o un `pedir` falso.

## El `terminado` queda cumplido en parte

«`limitar(accion, ip)` **sobre la RPC de limites**» no se cumple: la RPC no existe. P02 la pidió para P05 (`docs/pasos/P02/decisiones.md:75`),
el `terminado` de P05 no la nombra y su plan dice que no la toma. `limitar` recibe quién cuenta por parámetro (`ContarEnvio`), con el contrato
de ventana fija escrito en `limites.ts`, y se prueba con `crearContadorEnMemoria`, que lo cumple (5/6, 10/11, 30/31 y 60/61).

**P1, contestada por la persona.** La compuerta `datos` se aprobó sola, así que P1 volvió a preguntarse al cerrar, en una compuerta
`afuera` (2026-11-17). Respuesta, tal cual de `hechos.json › decision`: «seguir (Recommended)». Es decir: P06 se publica con el `terminado`
en parte, y P32 y P33 se suman a `plan.yaml`, con P33 en el `depende_de` de P11 y P12. Esto lo hace quien edita `plan.yaml`: P06 no toca la
semilla. Se proponen estos pasos.
Los ids son propuestos; si ya se usaron, el siguiente libre (P22–P31 ya están propuestos por P01, P03, P07 y el plan de P05):

| Paso | Carril | `modulos`                        | Riesgo | Depende de | `terminado` propuesto                                                                                                                                                                                                                                                                                                                                                                                   |
| ---- | ------ | -------------------------------- | ------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P32  | datos  | `[supabase/, src/shared/types/]` | rojo   | P02        | `contar_envio(p_clave text, p_maximo int, p_ventana_segundos int) returns boolean`, `security definer` con `set search_path = ''`, `revoke all … from public, anon, authenticated` y `grant execute … to service_role`; la ventana fija de `ContarEnvio` en un solo `insert … on conflict (clave) do update … returning`; su prueba en `supabase/tests/` con la misma tabla de casos; tipos regenerados |
| P33  | base   | `[src/shared/lib/seguridad/]`    | rojo   | P06, P32   | `contadorDeSupabase(cliente)` implementa `ContarEnvio` con `cliente.rpc('contar_envio', …)`: el cliente entra por parámetro (no suma archivos a `DONDE_SE_PERMITE_EL_ADMIN`), valida la respuesta con Zod y mapea el error con `errorDePostgrest`; sus pruebas corren la misma tabla de casos que `crearContadorEnMemoria`. Cierra la parte pendiente del `terminado` de P06                            |

P11 y P12 (sus route handlers son los que limitan) suman P33 a su `depende_de`. P09, P13 y P14, no. La limpieza de 2 días de `limites` no
va en P32: es de `retencion_diaria`, que el plan de P05 pasa a su P30.

## Decisiones no obvias

- **Forma del token de solicitud: `<solicitud_id>.<exp>.<firma>`.** La firma es la de la semilla (§5.6, `semilla.md:534`), pero
  `GET /api/horas` recibe sólo `t=<token>` (`semilla.md:592`): el id y el vencimiento tienen que viajar en claro. `exp` va en segundos Unix
  y vence con `ahora >= exp`. La firma se compara en tiempo constante **antes** de mirar el vencimiento.
- **Vence 2 h después de emitido, no de `solicitudes.creado_en`.** Por R4.5 (`semilla.md:513`), `crear_o_juntar_solicitud` puede devolver
  una solicitud de hasta 30 días, y con su `creado_en` el token nacería vencido. `firmarTokenDeSolicitud` toma `emitidoEn` (por defecto,
  ahora). El ejemplo de la semilla (10:00 → 11:59 sí, 12:01 no) sigue valiendo.
- **El mismo texto para un token inválido y uno vencido** («El enlace venció. Vuelve a llenar el formulario.»): es el único que define
  `docs/UX.md:62`, la persona hace lo mismo en los dos casos y no se le dice a nadie cuál falló. Cambia sólo el código (`validacion` o
  `regla`).
- **El hash del token de gestión es el sha256 de los 32 bytes** (no del texto base64url), como literal bytea de PostgREST (`\x` + hex):
  `reuniones.token_hash` es `bytea` con `octet_length = 32`. Un token que no es el base64url canónico de 32 bytes da `null`, y la ruta
  responde «Este enlace no es válido.», igual que con uno que no existe.
- **«Token de gestión», no «token de reunión».** Es el nombre del dato en la semilla (`token_hash`, «sha256 del token de gestión»,
  `semilla.md:227`; «Gestión de reunión», `:535`), el que usa el plan de P05 y P07 llama «enlace de gestión» a la URL. El `terminado` y R4.20
  dicen «token de reunión»: queda como alias que la próxima versión de la semilla debería unificar.
- **`remoteip` a Cloudflare.** Es opcional según la documentación de Turnstile, y Cloudflare ya ve la IP por el widget, pero mandarla
  desde el servidor es entregar la IP del visitante a un tercero. Se manda la IP completa de `ipDelPedido` (nunca el /64) para mejorar la
  verificación. Para P10 (privacidad): nombrar a Cloudflare Turnstile como encargado que recibe la IP.
- **Todo falla cerrado:** sin secreto, sin sal, con la red caída, un timeout de 5 s, un status no 2xx, un JSON inválido o un error del
  contador, se rechaza. Un error del secreto de Turnstile (`missing-input-secret`, `invalid-input-secret`) es `inesperado` con un
  `console.error` del código; nunca se registran el token, la cabecera, la IP ni los secretos.
- **IP normalizada.** `ipDelPedido` lee `x-real-ip` y, si falta, el primer elemento de `x-forwarded-for`. La IPv6 queda en la forma
  canónica del `URL` de WHATWG (minúscula, comprimida) y la mapeada `::ffff:a.b.c.d` pasa a IPv4, así una misma IP da una sola clave. Antes del
  `URL` se filtra a `[0-9a-fA-F:.]` (sin eso, `::1]/x` salía `::1`). Lo que no vale da `'desconocida'`, y todas las desconocidas comparten
  límite. El /64 se arma sólo en `claveDeLimite`: `::1` → `0:0:0:0::/64`.
- **El contador entra por parámetro.** `seguridad/` no importa el cliente admin ni `@supabase/*` (como P07). `crearContadorEnMemoria` vive
  en `contador-en-memoria.soporte.ts`: no se exporta en `index.ts` y las pruebas lo importan por su ruta.
- **F5 no agrega conducta aquí.** El enlace mágico es de Supabase Auth (P14), con sus propios topes; P06 no limita `/entrar`.
- **Supuestos contrastados el 2026-11-17** con la documentación oficial:
  - S1, <https://developers.cloudflare.com/turnstile/get-started/server-side-validation/>: `POST`
    `https://challenges.cloudflare.com/turnstile/v0/siteverify` con form-urlencoded o JSON (`secret`, `response`, `remoteip` opcional), token
    de hasta 2048 caracteres, respuesta JSON con `success` y `error-codes`, y los códigos `missing-input-secret` e `invalid-input-secret`.
  - S2, <https://vercel.com/docs/headers/request-headers>: Vercel sobrescribe `x-forwarded-for` («to prevent IP spoofing») y
    `x-real-ip` es idéntica.
- **Términos para la próxima versión de la semilla** (`docs/GLOSARIO.md` se genera de ella; P06 no lo toca, como P02): **token de
  solicitud**, **token de gestión** (alias del `terminado`: «token de reunión»; la URL que lo lleva es el «enlace de gestión») y **límite de
  envíos**.
