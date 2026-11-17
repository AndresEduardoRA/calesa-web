# P33 · Bitácora

e2e completo: no (en la máquina del carril falta el navegador de Playwright, `chrome-headless-shell` 1248. La primera corrida cortó en
`next build` con `SecurityFatalError`, un aviso de vulnerabilidad de Next.js. La segunda compiló, pero el único spec, `inicio`, no llegó a
abrir el navegador. Lo corre el CI del PR, porque `scripts/e2e-dirigidos.mjs` pide el completo cuando el rango es de nivel 2, y este lo es
por `shared`; también lo corre el nocturno sobre `main`)

## Qué se hizo

| Commit    | Asunto                                                         | Qué lleva                                                                                                                                                                                                                                                                                                                                                               |
| --------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `112b016` | `test(base): compartir la tabla de casos del límite de envíos` | `casos-de-contar-envio.soporte.ts`: la tabla de casos de `ContarEnvio` (los tres de la memoria y uno por acción de `LIMITES`), que ahora corre `contador-en-memoria.test.ts`.                                                                                                                                                                                           |
| `e2f5655` | `feat(base): contar envíos con la rpc contar_envio`            | `contadorDeSupabase(cliente)` en `contador-de-supabase.ts`: cliente estructural, pedido con Zod, `rpc('contar_envio', …)`, `z.boolean()`, error por `errorDePostgrest` sin dejar pasar el texto de la RPC, nunca lanza y registra sólo el motivo. El cliente falso de las pruebas (`cliente-de-contar-envio.soporte.ts`), dos suites, el export y la ficha de `shared`. |
| `f919ccb` | `docs(base): aclarar en la ficha quién simula server-only`     | Arreglo que pidió la auditoría del informe: la línea del «Ojo» de `src/shared/CLAUDE.md` se leía como si el `vi.mock('server-only')` fuera de `limites.sql`.                                                                                                                                                                                                            |

No se tocaron `limitar`, `errores.ts` ni nada de `supabase/`.

## Pruebas en rojo primero (`.piloto/salidas/P33/`)

- `rojo-vitest.txt`: contra `112b016` y sin `contador-de-supabase.ts`, los dos archivos nuevos no cargan
  (`Cannot find module './contador-de-supabase'`).
- `rojo-tipos.txt`: `pnpm typecheck` da `TS2307` en los tres archivos que lo importan.
- El commit 1 no tiene rojo propio: `verde-commit1.txt` (19/19 y lint rc 0).

## Verificación (2026-11-17)

Cada salida abre con el HEAD y la hora y termina con su `rc=`.

| Qué                                                                                       | Resultado                                                                                                        | Salida                                       |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Prueba final (`pnpm lint && pnpm typecheck && pnpm test && bash scripts/mapa.sh --check`) | lint y typecheck rc 0; vitest 1612/1612. Cae sólo `test:kit`, 41/48 y rc 1: los 7 dependen del entorno del bucle | `prueba-final.txt`                           |
| `pnpm -s test:kit` con `env -u` de cada `PILOTO_*`/`COORD_*`, y `mapa.sh --check`         | 48/48 y rc 0; mapa rc 0                                                                                          | `test-kit-sin-entorno.txt`                   |
| Mutaciones (13 del plan, sobre `f919ccb`)                                                 | caen las 13; cada una restaurada y comparada con `cmp` (detalle abajo)                                           | `mutaciones.txt` (con el `diff` de cada una) |
| Tipos del cliente real (fuera del repo, con el `tsconfig` del proyecto)                   | el cliente del servidor y el admin entran sin cast                                                               | `tipos-cliente.txt`                          |
| `nivel.mjs --rango 321adfb..HEAD`                                                         | nivel 2 (`shared`), sin interfaz ni cambio de tipos de la base                                                   | `nivel.txt`                                  |
| `pnpm test:e2e:completo --project=escritorio`                                             | no corrió (ver el marcador arriba)                                                                               | `e2e-completo.txt`, `e2e-completo-2.txt`     |

- **e2e dirigidos:** ninguno. Ninguna ruta usa todavía `contadorDeSupabase`: lo cablean P11 y P34. El CI del PR corre igual el completo
  (nivel 2).

## Mutaciones

Cada una se hizo con un reemplazo exacto en el archivo de producto. Después se corrió vitest sobre `src/shared/lib/seguridad/` (en M5,
también `tsc`), se restauró el archivo con `cp` y se comparó con `cmp` (rc 0 en las 13). Todas tocan `contador-de-supabase.ts`, salvo M11,
que toca `contador-en-memoria.soporte.ts`.

| Mn  | Qué se rompió                                                       | Cayeron | Entre ellas                                                                        |
| --- | ------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------- |
| M1  | devolver `errorDePostgrest(error)` tal cual                         | 8       | la fila `22023` de la tabla de errores y la de `limitar` con un `22023`            |
| M2  | `inesperado`, pero con el mensaje de `errorDePostgrest` sin filtrar | 8       | las filas `22023` y `42501`                                                        |
| M3  | `ok(respuesta.data as boolean)`, sin validar                        | 8       | `data` `null`, `'true'`, `1` y `{}`                                                |
| M4  | `z.coerce.boolean()`                                                | 8       | `data` `'false'` (sale `true`), `1` y `'true'`                                     |
| M5  | `p_clave` → `clave`                                                 | 2       | «llama una vez a contar_envio…»; `tsc` da `TS2561` por el `satisfies`              |
| M6  | cruzar `p_maximo` y `p_ventana_segundos`                            | 9       | la tabla de casos y la llamada exacta                                              |
| M7  | sin `try/catch` alrededor de `rpc`                                  | 2       | `rpc` que lanza y `rpc` que rechaza                                                |
| M8  | sin validar el pedido                                               | 8       | los 8 pedidos inválidos: «la RPC no se llama»                                      |
| M9  | la clave en el registro, en el camino del error de la RPC           | 15      | la tabla de errores y la de `limitar` con un `22023`, que busca el hex de la clave |
| M10 | `if (respuesta.error?.code)`                                        | 5       | las tres filas sin red, la de sin código y la de `limitar` sin red                 |
| M11 | `>=` → `>` en el reinicio (memoria)                                 | 2       | el caso de 59:59 en las dos suites, la de la memoria y la del adaptador            |
| M12 | `error.message` en el registro en vez del código                    | 13      | las filas con el texto de la RPC (el registro no puede tener «límite de envíos»)   |
| M13 | registrar también ante un `ok`                                      | 9       | la tabla de casos del adaptador: un `ok` no registra                               |

- **Base real:** no se corrió. Este paso no toca `supabase/`, y la RPC tiene su prueba en `supabase/tests/limites.sql` (P32).

## Pendientes (no son de este paso)

- `pnpm test` dentro del bucle termina con rc 1 por 7 tests del kit que heredan `PILOTO_AUTO` y `COORD_MERGE_AUTO` (lo mismo que anotaron P06
  y P32). Le toca al carril que lleva el kit (`calidad`).
- `next build` cortó otra vez con el aviso de vulnerabilidad de Next.js (`SecurityFatalError`). Actualizar Next es una dependencia: va en su
  propio paso, con su compuerta.
- Falta el navegador de Playwright en la máquina del carril (`chrome-headless-shell` 1248).
- `supabase/tests/limites.sql:2` sigue nombrando `contador-en-memoria.test.ts`; la tabla vive ahora en `casos-de-contar-envio.soporte.ts`
  (carril `datos`).
- El repo no tiene identidad de git (`user.name`/`user.email` vacíos). Los commits usaron la de los commits anteriores del carril, pasada
  por entorno y sin tocar la configuración.
