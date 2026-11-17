# P38 · Bitácora

2026-11-17 (America/La_Paz). Rama `datos/p38` desde `82b3d50`. Las salidas están en `.piloto/salidas/P38/` (no se versiona).

e2e completo: no (`pnpm test:e2e:completo --project=escritorio` resetea la base y se corta en `next build` con `SecurityFatalError`:
«Your version of Next.js is affected by a known security vulnerability», igual que en P34; dos intentos, `e2e-completo.txt` y
`e2e-completo-reintento.txt`). Ningún e2e de hoy lee la hora de la base.

## Commits

| Commit    | Asunto                                                                | Qué                                                                                                                                                                                                                                          |
| --------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `678f1f1` | `feat(datos): agregar _ahora() con el reloj de la semilla local`      | `20261117225514_calesa_reloj.sql` (`public._ahora()`), `supabase/semillas/reloj.sql` y su línea en `sql_paths`, `database.types.ts` regenerado, `supabase/tests/reloj.sql` (6 bloques) y `reloj.test.ts` (la guarda de `pnpm test`, 6 casos) |
| `a700e59` | `feat(datos): pasar a _ahora() las funciones del sitio público`       | `_calesa_reloj_agenda.sql` (5 funciones) y `_calesa_reloj_solicitudes.sql` (4), `reloj-rpc-sitio.sql` (7 bloques) y `reloj-copias.test.ts` (9 copias)                                                                                        |
| `ff376d5` | `feat(datos): pasar a _ahora() el panel, la retención y los defaults` | `_calesa_reloj_panel.sql` (6 funciones) y `_calesa_reloj_tareas.sql` (2 y los 22 defaults), `reloj-rpc-panel.sql` (8 bloques), `reloj-guarda.sql` (2) y las 17 copias de `reloj-copias.test.ts`                                              |

Las copias de las 17 funciones las generó un script sobre `scripts/lib/definicion-sql.ts` (la definición vigente, `now()` →
`(select public._ahora())`, `create function` → `create or replace function`), y `reloj-copias.test.ts` lo vuelve a comprobar.

## Lo corrido

| Qué                                                                    | Resultado                                                                                                                                                                                      | Salida                                                 |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Rojo contra HEAD (`82b3d50`)                                           | Caen los 23 bloques nuevos de la base (sin la tabla: `42P01`) y 19 de 23 de vitest (pasan las 4 negativas)                                                                                     | `rojo-db.txt`, `rojo-vitest.txt`                       |
| Rojo de `reloj-rpc-sitio.sql` contra el commit 1                       | Caen los 7, por la hora: `_ahora()` ya existe y las funciones siguen en `now()`                                                                                                                | `rojo-c1-sitio.txt`                                    |
| Rojo de `reloj-rpc-panel.sql` y `reloj-guarda.sql` contra el commit 2  | Caen los 10, por la hora y por los defaults                                                                                                                                                    | `rojo-c2-panel.txt`                                    |
| `pnpm db:probar` por commit                                            | 203, 210 y 220 bloques, 0 fallas                                                                                                                                                               | `c1-db.txt`, `c2-db.txt`, `c3-db.txt`                  |
| `pnpm lint` y `pnpm typecheck` por commit                              | rc 0 en los tres                                                                                                                                                                               | `c{1,2,3}-lint.txt`, `c{1,2,3}-typecheck.txt`          |
| vitest por commit                                                      | 1788, 1797 y 1805, 0 fallas                                                                                                                                                                    | `c1-test.txt`, `c2-vitest.txt`, `c3-vitest.txt`        |
| Base real: `reloj.sql`, `reloj-guarda.sql` y los dos `reloj-rpc-*.sql` | `rc=0` los cuatro, escrito al pie de cada salida (psql como `postgres`, `ON_ERROR_STOP=1`, con el candado)                                                                                     | `real-reloj*.txt`                                      |
| Base real: S1 (la semilla es de `postgres`)                            | Esquema y tabla de `postgres`; como `authenticator` (con `safeupdate`) y `set role authenticated`: `t` con la tabla vacía y `t` con la fila F; `anon`: `permission denied for function _ahora` | `real-authenticator.txt`                               |
| 18 mutaciones (M1–M17 y M9b)                                           | Caen las 18; el árbol queda igual (`cp` + `cmp`)                                                                                                                                               | `mutaciones.txt`                                       |
| `node scripts/piloto/nivel.mjs` con los archivos reales                | Nivel 2: `rls` (las 5 migraciones) y `estructura` (los defaults)                                                                                                                               | `nivel.txt`                                            |
| `pnpm db:lint`                                                         | Sin errores (`pruebas`, `public`, `publico`)                                                                                                                                                   | `db-lint.txt`                                          |
| `bash scripts/mapa.sh --check`                                         | rc 0                                                                                                                                                                                           | `mapa-check.txt`                                       |
| Prueba final (`verificacion.comando`)                                  | Verde hasta vitest: `db:probar` 220/220, lint y typecheck rc 0, vitest 1805/1805; `test:kit` 42/49 por los 7 que heredan el entorno del bucle (`PILOTO_*`, `COORD_*`), 49/49 sin él            | `prueba-final.txt`, `prueba-final-kit-sin-entorno.txt` |
| `pnpm test:e2e:completo --project=escritorio`                          | No corrió: `next build` da `SecurityFatalError` (arriba), también al reintentar                                                                                                                | `e2e-completo.txt`, `e2e-completo-reintento.txt`       |

El 49/49 de `test:kit` sin el entorno del bucle se corrió con `env -u COORD_MERGE_AUTO -u COORD_TOPE_PCT -u COORD_UMBRAL -u PILOTO
-u PILOTO_AUTO -u PILOTO_AUTO_MIN -u PILOTO_BLOQUE -u PILOTO_DISCO_MAX -u PILOTO_ESPERA_S -u PILOTO_FABLE_OK -u PILOTO_FUNCIONES -u
PILOTO_SESION -u PILOTO_TOPE_USD_MIN -u PILOTO_TOPE_USD_PASO -u CARRILES_MAX pnpm -s test:kit` (el comando va también en la primera
línea de la salida). Hace falta quitar también las `COORD_*`: el test del ciclo completo lee `COORD_MERGE_AUTO`.

## Mutaciones (qué cayó)

M1 `_ahora()` sin `to_regclass`: no se aplica `seed.sql` y cae la guarda de vitest. M2 de invocador: 13 (T4, T6, B7, B8…). M3 siempre
`now()`: 16 (T4 y las de RPC). M4 sin `coalesce`: 121. M5 EXECUTE a `anon`: `privilegios-de-anon` y T6. M6 `revoke` a `authenticated`:
11 (T4, T6, B7, B8…). M7 y M8 grants en el reloj: T5 (M8 también `permisos-calesa`). M9 la tabla nace con la fila: 46. M9b la semilla fuera
de `sql_paths`: 20 (T3–T5, las de RPC y la guarda de vitest). M10, M11, M13, M14 una función vuelve a `now()`: su prueba de RPC, la guarda
de la base y su copia. M12 `crear_o_juntar_solicitud` sin `security definer`: `solicitudes-rpc.sql` y su copia. M15 sin el default de
`solicitudes.creado_en`: la guarda de defaults y B8. M16 una migración que crea la tabla: la guarda de vitest (y la semilla). M17 la
guarda quita todo cuerpo y no sólo `_ahora`: la de las migraciones de mentira.

## Pendientes y avisos

- **`next build` se niega a construir** por una vulnerabilidad conocida de la versión de Next.js instalada, y propone
  `next upgrade --agent=security`. No se tocó: es una dependencia (compuerta `dependencia`) y no es de este paso. Medido: los dos
  intentos de `test:e2e:completo` se cortan ahí (`test:e2e` hace el mismo `next build` antes de Playwright, `package.json:19`).
- **`reservar_reunion` no tiene un caso de conducta con el reloj fijo** (su plazo de 30 días para volver a reservar con el token
  anterior): la cuidan la guarda de la base (`reloj-guarda.sql`) y su copia fiel (`reloj-copias.test.ts`). La regla de los 30 días con
  el reloj sí la prueba `datos_para_horas` (A2), sobre el mismo borde.
- **`ff376d5` junta dos intenciones** (las funciones del panel y los defaults, que disparan `estructura`): el plan aprobado lo agrupó
  así y no se reescribió la historia.
- **Identidad de git:** el worktree no tenía `user.name` ni `user.email`; los commits llevan la misma autoría que los de P34, puesta por
  variables de entorno en cada commit (no se cambió la configuración).
- **Para el coordinador:** sumar `e2e/soporte/reloj.ts` a los `modulos` de P36 (P4.1, `decisiones.md`).
