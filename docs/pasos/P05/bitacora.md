# P05 · Bitácora

e2e completo: no (en la máquina del carril no está el navegador de Playwright, `chrome-headless-shell` 1248: la app compila y el
único spec, `inicio`, no llega a abrir el navegador; lo corre CI)

## Qué se hizo

| Commit    | Asunto                                                                   | Qué lleva                                                                                                                                                                                                                                                                                                                                         |
| --------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `3146cc6` | `feat(datos): validar los estados de la solicitud y auditar sus cambios` | `calesa_estados`: `_fallar` (la tabla E), `_transicion` (§5.7), los triggers de estado (validar y efecto en la reunión) y de auditoría, `cambiar_estado_solicitud`, la descripción de `solicitudes.estado`; `estados.sql`; `pruebas.error` y los ayudantes de datos; las funciones de trigger en `permisos-calesa.sql`.                           |
| `2b76545` | `feat(datos): reservar reuniones con el reparto parejo en la base`       | `calesa_agenda_reglas` (C1–C7: candado, hora ofrecible, elegible, candidatos, orden, prospección, zona) y `calesa_reservar` (`_resumen_reunion`, `_intentar_reserva`, `reservar_reunion`, `datos_para_horas`); `reservas.sql` y `reservas-horas.sql`; `pruebas.hora`, `abrir_agenda` y `claves`; comparaciones de `estados.sql` a prueba de null. |
| `37265ba` | `feat(datos): cambiar y cancelar reuniones por enlace y desde el panel`  | `calesa_cambiar_reunion` (`_bloquear_vigente`, `_mover_reunion`, `_cancelar_reunion`, `_reunion_del_token`, `_reunion_del_panel`, las cuatro RPC y la clave `reuniones.cambiar`); `reservas-cambios.sql`; la clave nueva en las listas de `permisos-calesa.sql`.                                                                                  |
| `96e037c` | `test(datos): endurecer las pruebas de la agenda tras la auditoría`      | Lo pidió la auditoría del informe: comparaciones a prueba de null en `estados.sql` y `reservas-cambios.sql`, y las hojas `cambiableHasta` y `puedeVolverAReservar` (con la reunión cancelada) de `datos_para_horas` en `reservas-horas.sql`.                                                                                                      |

`src/shared/types/database.types.ts` se regeneró con `pnpm db:types` en cada commit. Lo que no entró va a P30 y P31
(`decisiones.md` › Partición).

## Pruebas en rojo primero (`.piloto/salidas/P05/`)

- `rojo-1-estados.txt`: contra HEAD `772155f`, caen 8 de 9. La del ayudante pasa porque `pruebas.error` ya existía. Sin el trigger,
  `agendada → descartada` no falla.
- `rojo-2-reservas.txt`: contra `3146cc6`, caen las 13 de `reservas.sql` (todavía sin partir): `reservar_reunion` y
  `datos_para_horas` no existen.
- `rojo-3-cambios.txt`: contra `2b76545`, caen las 9 de `reservas-cambios.sql` y 2 de `permisos-calesa.sql` (falta
  `reuniones.cambiar`).

## Verificación (2026-11-17)

Sobre `96e037c` (HEAD) se volvieron a correr la prueba final, `pnpm test` sin el entorno del bucle, la base real, `nivel.mjs` y
`mapa.sh --check`; esas salidas abren con el HEAD y la hora y terminan con su `rc=`. `db:lint` y el e2e corrieron sobre `37265ba`
(ya con el fixup de `db:lint` fundido en `2b76545`): mismo esquema y misma app, porque `96e037c` sólo toca pruebas.

| Qué                                                                                                                                   | Resultado                                                                                                                                                                                                | Salida                                   |
| ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `pnpm db:reset && pnpm db:types && pnpm db:probar && pnpm lint && pnpm typecheck && pnpm test`                                        | rc 1: `db:probar` da 96 ✓ y 0 ✗ (31 bloques de P05), lint y typecheck sin avisos, vitest 1253/1253; en `node --test` de los scripts del kit caen 5 de 45 por el entorno del bucle                        | `prueba-final.txt`                       |
| `pnpm test` sin `PILOTO_*` ni `COORD_*`                                                                                               | rc 0: vitest 1253/1253, kit 45/45                                                                                                                                                                        | `test-sin-entorno-del-bucle.txt`         |
| Mutaciones (27 del plan y 2 tras la auditoría)                                                                                        | caen las 29; cada archivo restaurado y comparado con `cmp`. Las 27 corrieron sobre `4de5578` (el commit 3 antes de que el fixup de `db:lint` reescribiera los commits), que no toca ninguna línea mutada | `mutaciones.txt`                         |
| Base real (`supabase_db_calesa-web-datos`, psql con `ON_ERROR_STOP=1` y el candado; cada salida trae el comando, el stderr y el `rc`) | rc 0, sin `ERROR`, en `estados`, `reservas`, `reservas-horas`, `reservas-cambios`, `permisos-calesa`, `rls-calesa`, `privilegios-de-anon` y `esquema-calesa`                                             | `real-*.txt`                             |
| `pnpm db:lint`                                                                                                                        | `"results": []` (antes de corregir `datos_para_horas`: un `'{}'` sin cast y STABLE con un PERFORM volátil; se corrigió en `2b76545`)                                                                     | `db-lint.txt`                            |
| `node scripts/piloto/nivel.mjs --rango 772155f..HEAD`                                                                                 | nivel 2 (`rls`), sin interfaz                                                                                                                                                                            | `nivel.txt`                              |
| `bash scripts/mapa.sh --check`                                                                                                        | rc 0                                                                                                                                                                                                     | `mapa-check.txt`                         |
| `pnpm test:e2e:completo --project=escritorio`                                                                                         | rc 1. La primera corrida: `next build` se detuvo por un aviso de seguridad de Next 16.4.3 y pidió reintentar. La segunda: falta el navegador de Playwright                                               | `e2e-completo.txt`, `e2e-completo-2.txt` |

- Las 5 fallas de `prueba-final.txt` son de `scripts/piloto/piloto.test.mjs` (4) y `scripts/coordinador/coordinador.test.mjs` (1), que este
  paso no toca. Pasan sin `PILOTO_AUTO` ni `COORD_MERGE_AUTO` (le pasó igual a P02).
- Carreras: el kit no tiene `db:carreras`. La concurrencia real (dos conexiones a la vez) no se probó; la defienden el candado de
  agenda, el orden de bloqueo y la exclusión. Las pruebas de PGlite cubren la conducta en serie y el respaldo de la exclusión.
- Splinter no se corrió en esta verificación; corrió después, en la del CI del PR #13 (abajo). Se espera
  `authenticated_security_definer_function_executable` en las tres funciones de `authenticated`: es a propósito (P1).
- `supabase/semillas/pruebas.sql` quedó en 296 líneas (el plan estimaba 270 o menos), bajo el tope de 300.

## CI del PR #13 en rojo (2026-11-17)

El coordinador devolvió el paso con «CI en rojo» (corrida `44092129613`, sobre `75db0b5`). Sólo cayó el job «Base · reset, tipos,
probar, lint y advisors», y cayó en su primer paso, `supabase start`, antes de tocar una migración: el puerto `55322` del runner ya
estaba en uso cuando arrancó el contenedor de la base (`failed to bind host port for 0.0.0.0:55322 … address already in use`,
`ci-44092129613-base.txt`). Los 4 bloques de e2e de la misma corrida levantaron la misma pila en el mismo puerto y pasaron. No hay
código que arreglar: el paso no cambia nada del esquema ni de la app.

Lo que el job no llegó a correr se corrió en el stack del carril sobre `75db0b5`, en el orden del job (`ci-base-local.txt`; psql
dentro del contenedor porque esta máquina no tiene psql):

| Paso del job                                  | Resultado                                  |
| --------------------------------------------- | ------------------------------------------ |
| `pnpm db:reset`                               | rc 0                                       |
| `pnpm db:types` y `git diff --exit-code`      | rc 0, sin diff                             |
| `pnpm db:probar`                              | rc 0: 96 ✓ y 0 ✗                           |
| `supabase/tests/privilegios-de-anon.sql`      | rc 0                                       |
| `pnpm db:lint`                                | rc 0, `"results": []`                      |
| Splinter (`scripts/splinter.sql`) sin `ERROR` | rc 0 y 0 filas `ERROR` (`ci-advisors.txt`) |

- Splinter da 9 `authenticated_security_definer_function_executable` (las tres de P05, a propósito por P1, y seis de P02) y 8
  `function_search_path_mutable`, todos de `pruebas.*`: los ayudantes de `supabase/semillas/pruebas.sql`, que sólo existen en local y
  en `db:probar` y no tienen permisos para `anon` ni `authenticated`. `pruebas.caso` y `pruebas.error` ejecutan el SQL del caso con el
  `search_path` de la sesión, así que fijarlo en ellos cambiaría lo que prueban. Ninguno es `ERROR`, que es lo que hace caer el job.
- La prueba final del paso, vuelta a correr con estas notas (`prueba-final-ci.txt`): rc 1, igual que antes. `db:probar` da 96 ✓, lint
  y typecheck salen sin avisos y vitest da 1253/1253. Caen sólo los mismos 5 tests del kit, por el entorno del bucle: sin `PILOTO_*`
  ni `COORD_*` pasan 45/45 (`test-kit-sin-entorno-ci.txt`).
- Este commit de notas no arregla la causa: al publicarlo, el bucle empuja y el CI vuelve a correr entero.

## Pendientes ajenos al paso

- El bloque de puertos del proyecto (`55321`–`55327`, y `+100` por carril) cae dentro del rango efímero de Linux (`32768`–`60999`,
  `/proc/sys/net/ipv4/ip_local_port_range`). Una conexión saliente del runner, como las descargas de imágenes que hace
  `supabase start`, puede tomar uno de esos puertos justo antes de que arranque el contenedor. Probablemente eso tumbó el job «Base»
  del PR #13. Es del kit, no de un carril: un bloque fuera de ese rango en `piloto.config`, o reservar el rango en el CI
  (`sysctl net.ipv4.ip_local_reserved_ports`) antes de `supabase start`.

- Next 16.4.3 avisa una vulnerabilidad conocida al compilar (`e2e-completo.txt`). Actualizarlo es una compuerta `dependencia`,
  del carril `base`.
- En esta máquina falta el navegador de Playwright (`chrome-headless-shell` 1248).
