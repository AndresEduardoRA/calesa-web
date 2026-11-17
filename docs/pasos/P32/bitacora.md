# P32 · Bitácora

e2e completo: no (en la máquina del carril no está el navegador de Playwright, `chrome-headless-shell` 1248: la app compila y el
único spec, `inicio`, no llega a abrir el navegador. El CI del PR corre sólo los dirigidos, hoy ninguno; el completo lo corre el CI
nocturno sobre `main`, después de integrar)

## Qué se hizo

| Commit    | Asunto                                                      | Qué lleva                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `1b36bd2` | `feat(datos): contar los envíos por clave con ventana fija` | `calesa_contar_envio`: `public.contar_envio(p_clave, p_maximo, p_ventana_segundos) returns boolean`, de definidor con `search_path` vacío y sólo para `service_role`. Valida con `22023` y `hint`, y aplica la ventana fija en un solo `insert … on conflict (clave) do update … returning`. Suma `supabase/tests/limites.sql` y regenera `database.types.ts`, donde sólo cambia la entrada `contar_envio`. |

La tabla `limites` no cambió. El adaptador (`contadorDeSupabase`) es de P33; la limpieza de 2 días, de P30.

## Pruebas en rojo primero (`.piloto/salidas/P32/`)

- `rojo-limites.txt`: contra HEAD `267ddb6`, antes de la migración, caen los 6 bloques de `limites.sql`. La función no existe:
  `42883`, o «hay 0» en el bloque de forma.

## Verificación (2026-11-17)

Cada salida abre con el HEAD y la hora y termina con su `rc=`.

| Qué                                                                                                            | Resultado                                                                                                                   | Salida                                     |
| -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Verde de `limites.sql`, `permisos-calesa.sql` y `privilegios-de-anon.sql` (PGlite)                             | rc 0: 6/6, 9/9 y 3/3                                                                                                        | `verde-limites.txt`                        |
| Prueba final (`pnpm db:reset && pnpm db:types && pnpm db:probar && pnpm lint && pnpm typecheck && pnpm test`)  | Pasan todos los pasos hasta vitest (1455/1455). Cae sólo `test:kit`, con 40/47 y rc 1: los 7 dependen del entorno del bucle | `prueba-final.txt`                         |
| `pnpm -s test:kit` con `env -u` de cada variable del bucle, una por nombre (la línea exacta está en la salida) | 47/47, rc 0                                                                                                                 | `test-kit-sin-entorno.txt`                 |
| Base real (`supabase_db_calesa-web-datos`, psql con `ON_ERROR_STOP=1` y el candado)                            | rc 0 en `limites`, `permisos-calesa` y `privilegios-de-anon`                                                                | `real-*.txt`                               |
| `pnpm db:lint`                                                                                                 | rc 0, `"results":[]`                                                                                                        | `db-lint.txt`                              |
| Splinter (`scripts/splinter.sql`)                                                                              | rc 0 y 0 filas `ERROR`; nada sobre `contar_envio`                                                                           | `splinter.txt`                             |
| Mutaciones (19 del plan)                                                                                       | caen las 19; cada una restaurada y comparada con `cmp`                                                                      | `mutaciones.txt`                           |
| `nivel.mjs --rango 267ddb6..HEAD`                                                                              | nivel 2 (`rls`), sin interfaz                                                                                               | `nivel.txt`                                |
| `mapa.sh --check`                                                                                              | rc 0                                                                                                                        | `mapa-check.txt`                           |
| `pnpm test:e2e:completo --project=escritorio`                                                                  | no corrió (ver el marcador arriba)                                                                                          | `e2e-completo-1.txt`, `e2e-completo-2.txt` |

- **e2e dirigidos:** ninguno. Ninguna interfaz ni ruta llama todavía a la RPC.
- **Carreras:** el kit no tiene `db:carreras`, así que dos conexiones a la vez no se probaron. Las defiende la sentencia única, y el
  bloque «forma» cae si alguien la reescribe como leer y después escribir (mutación M19).

## Pendientes (no son de este paso)

- `pnpm test` dentro del bucle termina con rc 1 por 7 tests del kit que heredan `PILOTO_AUTO` y `COORD_MERGE_AUTO` del entorno (P05
  vio 5). Sin ese entorno pasan los 47. Le toca al carril que lleva el kit (`calidad`): que esas pruebas limpien el entorno.
- En la primera corrida del e2e, `next build` se cortó con `SecurityFatalError`, un aviso de vulnerabilidad de Next.js
  (`e2e-completo-1.txt`). En la segunda compiló. Actualizar Next es una dependencia: va en su propio paso, con su compuerta.
- Falta el navegador de Playwright en la máquina del carril (`chrome-headless-shell` 1248).
- El repo no tiene identidad de git (`user.name`/`user.email` vacíos). El commit usó la de los commits anteriores del carril, pasada
  con `git -c` y sin tocar la configuración.
