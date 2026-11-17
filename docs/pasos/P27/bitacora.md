# P27 · Bitácora

e2e completo: no (`next build` se cortó con `SecurityFatalError`, el aviso de vulnerabilidad de la versión de Next.js, en las dos
corridas, la segunda después de compilar y con otro aviso; actualizar Next es una dependencia. Además falta el navegador de Playwright en
la máquina del carril: `~/.cache/ms-playwright` no existe (`e2e-completo-2.txt`). Lo corre el CI. Ningún e2e nombra
`correos_salientes` ni estas RPC)

## Qué se hizo

| Commit    | Asunto                                                 | Qué lleva                                                                                                                                                                                                            |
| --------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `5a39c25` | `feat(datos): registrar correos salientes por rpc`     | `calesa_registrar_correos`: `_correo_json`, `_correo_invalido`, `registrar_correo`, `correo_por_referencia`, `correo_por_id` y `correos_programados_de` (sólo `service_role`). `correos-rpc.sql` (6 bloques). Tipos. |
| `08a9235` | `feat(datos): leer los correos vencidos con su índice` | `calesa_correos_vencidos`: el índice `correos_salientes_vencidos` y `correos_vencidos` (sólo `service_role`). `correos-vencidos.sql` (3 bloques, uno con 20 000 filas y el plan genérico). Tipos.                    |
| `08da2f9` | `feat(datos): mover el estado de un correo registrado` | `calesa_marcar_correos`: `_tomar_correo` (tabla de transiciones, `for update`) y `marcar_correo_enviado`, `_fallido`, `_cancelado` y `_reprogramado` (sólo `service_role`). `correos-marcar.sql` (7 bloques). Tipos. |

Cada commit pasó `db:reset`, `db:types` y `db:probar` sobre su propio árbol: los archivos de prueba de los commits siguientes se apartaron
mientras tanto (`reset-c1.txt`, `probar-c1.txt`, `arbol-c2.txt`, `arbol-c3.txt`). Después, el `supabase/` de cada commit, sacado con
`git archive`, volvió a pasar entero en PGlite: 134, 137 y 144 bloques, rc 0 (`arbol-5a39c25.txt`, `arbol-08a9235.txt`,
`arbol-08da2f9.txt`).

## Lo medido (`.piloto/salidas/P27/`)

| Qué                                                                                                           | Resultado                                                                                                                                                                                                            | Salida                                   |
| ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Rojo contra HEAD `a9be3e0` (`SOLO=<archivo> pnpm db:probar`)                                                  | caen 6/6, 3/3 y 7/7 bloques, todos con `42883` (la función no existe)                                                                                                                                                | `rojo-*.txt`                             |
| `pnpm db:probar` completo sobre `08da2f9`                                                                     | rc 0, 144 bloques en verde (128 de antes y 16 nuevos)                                                                                                                                                                | `arbol-c3.txt`                           |
| Mutaciones M1–M32                                                                                             | caen las 32 y cada migración se restauró (`cmp` igual): 31 en la 1.ª corrida con el bloque del plan; M32 sobrevivió a conducta y se volvió a correr esperando el bloque de volumen, donde cae por la prueba de forma | `mutaciones.txt`                         |
| Base real (`supabase_db_calesa-web-datos`, psql con `ON_ERROR_STOP=1` y el candado)                           | rc 0 en `correos-rpc`, `correos-vencidos`, `correos-marcar`, `permisos-calesa` y `privilegios-de-anon`                                                                                                               | `real-*.txt`                             |
| `pnpm db:lint`                                                                                                | rc 0, `"results":[]`                                                                                                                                                                                                 | `db-lint.txt`                            |
| Splinter (`scripts/splinter.sql`)                                                                             | rc 0, 0 filas `ERROR` y ningún aviso de definidor ejecutable para las 9 RPC                                                                                                                                          | `splinter.txt`                           |
| `node scripts/piloto/nivel.mjs --rango a9be3e0..HEAD`                                                         | nivel 2 (`rls` en las tres migraciones, `estructura` por el índice), sin interfaz, `database_types: true`                                                                                                            | `nivel.txt`                              |
| Prueba final (`pnpm db:reset && pnpm db:types && pnpm db:probar && pnpm lint && pnpm typecheck && pnpm test`) | todo verde hasta vitest (103 archivos, 1670 pruebas); `test:kit` da 41/48 por los 7 tests que heredan el entorno del bucle                                                                                           | `prueba-final.txt`                       |
| `pnpm -s test:kit` con `env -u` de cada variable `PILOTO*`, `COORD_*` y `CARRILES_MAX`                        | 48/48, rc 0                                                                                                                                                                                                          | `test-kit-sin-entorno.txt`               |
| `bash scripts/mapa.sh --check`                                                                                | rc 0                                                                                                                                                                                                                 | `mapa-check.txt`                         |
| `pnpm test:e2e:completo --project=escritorio`                                                                 | no corrió: `next build` da `SecurityFatalError` en las dos corridas; sin `~/.cache/ms-playwright` (ver arriba)                                                                                                       | `e2e-completo.txt`, `e2e-completo-2.txt` |

## Lo que no se probó

- **Carreras:** PGlite es una sola conexión y el kit no tiene `db:carreras`. La serialización la da el `for update` de `_tomar_correo`,
  que fija una prueba de forma (y la mutación M27).
- **El e2e completo** (arriba). Ningún e2e dirigido: nada en `e2e/` nombra estos correos.

## Pendientes ajenos al paso

- `next build` se corta con `SecurityFatalError` en el carril (también en P30): hace falta actualizar Next.js, y eso es una compuerta
  `dependencia` de otro paso.
