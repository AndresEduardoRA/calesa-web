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
- Splinter no se corrió. Se espera `authenticated_security_definer_function_executable` en las tres funciones de `authenticated`:
  es a propósito (P1).
- `supabase/semillas/pruebas.sql` quedó en 296 líneas (el plan estimaba 270 o menos), bajo el tope de 300.

## Pendientes ajenos al paso

- Next 16.4.3 avisa una vulnerabilidad conocida al compilar (`e2e-completo.txt`). Actualizarlo es una compuerta `dependencia`,
  del carril `base`.
- En esta máquina falta el navegador de Playwright (`chrome-headless-shell` 1248).
