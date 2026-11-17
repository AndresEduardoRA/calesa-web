# P33 · Decisiones

Este paso enlaza el límite de envíos con su RPC: `contadorDeSupabase(cliente)` implementa `ContarEnvio` sobre `contar_envio` (P32). Es de
riesgo rojo, así que el plan (`.piloto/planes/P33.md`) terminó en una compuerta `datos`. La auditoría tuvo dos rondas:

- la primera dejó 9 observaciones, todas aplicadas;
- la segunda dejó una menor, que también se corrigió.

## Autoelección (2026-11-17)

Tal cual la anotó el bucle (`hechos.json` › `autoelecciones`):

- 2026-11-17T12:41:58-04:00 · P33 · compuerta datos contestada sola (PILOTO_AUTO): aprobar

«Aprobar» deja vigente la recomendada de la única pregunta del plan:

- **P1 · Qué texto ve el visitante si el contador falla.** El envío nunca pasa. Si no hubo red hacia la base (un error sin código con el
  texto de un `fetch` caído), el visitante lee `MENSAJE_SIN_RESPUESTA` («No pudimos llegar al servidor. Revisa tu conexión y vuelve a
  intentar.»). En cualquier otro fallo lee `MENSAJE_INESPERADO` («Algo falló de nuestro lado. Vuelve a intentar en un momento.»). Es lo
  mismo que hace la agenda con un error sin código (`src/modules/agenda/infra/rpc.ts:44-54`).
  - Lo que se sabía al elegir: en una ruta, el pedido del visitante sí llegó; lo que se cortó es el tramo del servidor a la base. Por eso
    «Revisa tu conexión» le atribuye un fallo que no es suyo.
  - La alternativa era mostrar siempre `MENSAJE_INESPERADO`. Cambiarlo es tocar una línea de `contador-de-supabase.ts` (`TEXTOS_QUE_PASAN`).

## Lo no obvio (2026-11-17)

- **El cliente es un tipo estructural, `ClienteDeContarEnvio`.** El lint prohíbe importar `@supabase/supabase-js` y `@supabase/ssr` en
  todo `src/**`, también con `import type` y también en las pruebas (`eslint.config.mjs:8-12`). Por eso `seguridad/` describe sólo el
  `rpc` que usa, con los argumentos de `database.types.ts`.
  - El cliente del servidor (`ClienteSupabase`) entra sin cast. Lo fija una prueba de tipos (`expectTypeOf<…>().toExtend<…>()`) que corre
    `pnpm typecheck`.
  - El admin (`createClient<Database>`) también entra sin cast, pero eso sólo se comprobó con `tsc` fuera del repo
    (`.piloto/salidas/P33/tipos-cliente.txt`), porque el lint no deja importarlo en `src/**`. Esa mitad la fija el typecheck del primer
    consumidor (P23/P11), y ahí tampoco va un cast.
- **El texto de la RPC no se filtra en `errores.ts`, sino después de `errorDePostgrest`.** El `terminado` pide mapear con
  `errorDePostgrest`, y así se hace.
  - Pero `errorDePostgrest` deja pasar el texto legible de un código conocido, que es lo que quiere la agenda con `P0001` y `PT409`. Por
    eso `errores.ts` no cambia: lo usan todos los módulos.
  - El adaptador fuerza `codigo: 'inesperado'` y conserva el `mensaje` sólo si es uno de los tres textos del kit (`MENSAJE_SIN_RESPUESTA`,
    `MENSAJE_SIN_CONEXION`, `MENSAJE_INESPERADO`). El `22023` de `contar_envio` nombra «la clave del límite de envíos»; con esto nunca
    llega al visitante, como pidió P32.
- **El pedido se valida antes de llamar, con los rangos de la RPC:**
  - clave de 1 a 200;
  - máximo entero de 32 bits desde 1;
  - ventana de 1 a 86 400 segundos.

  Un pedido fuera de rango no llega a la base. Así, un `22023` sólo puede venir de un desacuerdo entre el esquema y la RPC. La clave es
  ASCII (`accion:<64 hex>`), así que el largo de JS coincide con el `char_length` de la base.

- **`z.boolean()`, sin `coerce`.** `'false'` con coerce daría `true` (el envío pasaría): cualquier `data` que no sea un booleano es
  `inesperado`.
- **El registro lleva sólo el motivo:** `limites: contar_envio <motivo>`, donde el motivo es el código de PostgreSQL o PostgREST,
  `sin-codigo`, `respuesta`, `excepcion` o `pedido`. Nunca lleva la clave (aunque sea un sha256, junto con la sal identifica una IP), los
  argumentos, `message`, `hint` ni lo lanzado. Un `ok` no registra nada.
- **La tabla de casos se movió a `casos-de-contar-envio.soporte.ts`.**
  - Los casos (a)–(c) pasaron tal cual: hasta el máximo; el borde de 59:59 y la hora exacta; cada clave por su lado.
  - El (d), los máximos de `LIMITES`, hoy sólo corría a través de `limitar` (`limites.test.ts`). Ahora corre también en la suite de la
    memoria y en la del adaptador.
  - Con eso, la tabla iguala la de `supabase/tests/limites.sql`.
  - El comentario de `supabase/tests/limites.sql:2` sigue nombrando `contador-en-memoria.test.ts`, que ahora la importa del soporte. Es del
    carril `datos`; vale corregirlo la próxima vez que lo toquen.
- **El soporte importa `LIMITES` como valor.** Por eso toda suite que lo use hace `vi.mock('server-only', () => ({}))`: `limites.ts` →
  `config/servidor.ts` → `server-only`, que lanza fuera de `react-server`.
- **No hay prueba contra la base real en vitest.** La RPC ya tiene la suya, `supabase/tests/limites.sql` (`db:probar`, P32), con la misma
  tabla. El adaptador se prueba con un cliente falso que por detrás usa `crearContadorEnMemoria`, y además se comprueban los argumentos
  exactos de `rpc`.

## El `terminado` de P06 queda cerrado

P06 dejó en parte «`limitar(accion, ip)` sobre la RPC de limites» (`docs/pasos/P06/decisiones.md`). Con P32 (la RPC) y este paso
(`contadorDeSupabase`), `limitar(accion, ip, contadorDeSupabase(cliente))` cuenta sobre `limites`.

## Para los pasos que siguen

- **P11 y P34 (las rutas que limitan):** arman `contadorDeSupabase(admin)` con el cliente que habilita P23. Se arma **por petición, nunca
  en un `const` a nivel de módulo**: el contador guarda el cliente en su closure, y el admin en una variable global lo prohíben `admin.ts`
  y `.claude/rules/datos.md`. Un cliente que no es `service_role` recibe `42501` y frena: un error de cableado no abre el límite.
- **Términos para la próxima versión de la semilla** (`docs/GLOSARIO.md` sale de ella; este paso no lo toca): **límite de envíos** y
  **ventana fija**, como ya propusieron P06 y P32.
