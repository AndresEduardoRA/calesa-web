# P23 · Bitácora

e2e completo: no. En la máquina del carril no está el navegador de Playwright: `chromium.executablePath()` apunta a
`~/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`, que no existe (`.piloto/salidas/P23/e2e-navegador.txt`), y la sesión no
instala nada. El rango es de nivel 2 por `shared` (`nivel.mjs --rango`) y no toca interfaz, así que el completo de `escritorio` lo corre el
CI del PR (`scripts/e2e-dirigidos.mjs`). Ningún spec de `e2e/` habla del cliente admin ni de los respaldos: no hay e2e dirigidos.

## Qué se hizo

| Commit    | Asunto                                                       | Qué lleva                                                                                                                                                                                                                                                                                                                                          |
| --------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `9915c7a` | `feat(base): permitir el cliente admin en las rutas de §9.1` | <ul><li>`eslint.config.mjs`: `RUTAS_CON_ADMIN` (los siete `route.ts` de §9.3), `INFRA_CON_ADMIN` (`acceso/infra/auth-admin.ts`) y sus dos bloques, después del de `src/app` y del de `infra/`;</li><li>`src/shared/lib/supabase/admin.lint.test.ts` (15 pruebas);</li><li>el comentario de `admin.ts` y la ficha `src/shared/CLAUDE.md`.</li></ul> |
| `637bc67` | `feat(base): respaldar la base cada día cifrada con age`     | `respaldo-diario.yml`, y en `.github/respaldo/`: `volcar.sh`, `respaldar.sh`, `base-temporal.sh`, `supabase/config.toml` (la pila temporal, puertos 55340-55349) y `.gitignore`.                                                                                                                                                                   |
| `64f86ed` | `feat(base): probar cada semana que el respaldo se restaura` | `restauracion-semanal.yml`, y en `.github/respaldo/`: `restaurar.sh`, `cargar.sh`, `comprobar.sh`, `comprobar.sql` (las 20 tablas de P02 y que haya solicitudes) y `autoprueba.sh`.                                                                                                                                                                |

La carpeta de los scripts es `.github/respaldo/` y no `.github/respaldos/`, como decía el plan; el motivo está en `decisiones.md`.

## Pruebas en rojo primero (`.piloto/salidas/P23/`)

- `rojo-lint.txt`: contra `adc6832`, `admin.lint.test.ts` da 8 fallas y 7 pasan. Caen las 8 rutas de C1, todas con `expected [
'@/shared/lib/supabase/admin', …] to not include '@/shared/lib/supabase/admin'`. Pasan los 6 testigos de C3 y `supabase/server.ts`, que
  ya pasaban en HEAD y son la guarda de que no se abre de más.
- Los workflows y los scripts de `.github/respaldo/` no existían en HEAD. Lo que prueba que sus pruebas pueden caer son las mutaciones M6-M8
  y los pasos 6 y 7 de la autoprueba.

## Verificación (2026-11-17)

| Qué                                                                                          | Resultado                                                                                                                                                                       | Salida                               |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `pnpm lint`, `pnpm typecheck`                                                                | sin errores ni avisos                                                                                                                                                           | `verificacion.txt`                   |
| `pnpm test` › vitest                                                                         | 106 archivos, 1739 pruebas, 0 fallas (entre ellas las 15 de `admin.lint.test.ts` y las 38 de `workflows.test.ts`, con los dos workflows nuevos)                                 | `verificacion.txt`, `verde-lint.txt` |
| `pnpm test` › `test:kit`, con el entorno del bucle                                           | 49 pruebas, 42 pasan y 7 fallan (piloto y coordinador): leen `PILOTO_*` y `COORD_MERGE_AUTO` del entorno, como en P06, P22, P32 y P33                                           | `verificacion.txt`                   |
| `test:kit` sin `PILOTO_*`, `CARRILES_MAX` ni `COORD_*`                                       | 49/49                                                                                                                                                                           | `test-kit-sin-entorno-del-bucle.txt` |
| `bash scripts/mapa.sh --check`                                                               | verde                                                                                                                                                                           | `mapa-check.txt`                     |
| `node scripts/piloto/nivel.mjs --rango adc6832..HEAD`                                        | nivel 2 (`shared`), `toca_interfaz: false`, `database_types: false`                                                                                                             | `nivel.txt`                          |
| `node scripts/guardas/carriles.mjs adc6832 base/p23`                                         | «16 archivos de base/p23 cumplen»                                                                                                                                               | `carriles.txt`                       |
| Autoprueba local: `bash scripts/candado.sh respaldos -- bash .github/respaldo/autoprueba.sh` | `rc=0`, los 7 pasos, **sin cifrado** (paso 4b): en la máquina no hay `age`. El cifrado, la identidad que no es la pareja y `age --version` los corre el job `autoprueba` del PR | `autoprueba-local.txt`               |
| e2e dirigidos                                                                                | ninguno (`grep -rln "supabase/admin\|respaldo" e2e/` no da nada)                                                                                                                | —                                    |
| Nivel 2: `pnpm test:e2e:completo --project=escritorio`                                       | **no corrido**: falta Chromium (arriba)                                                                                                                                         | `e2e-navegador.txt`                  |

Lo que la autoprueba local dejó medido de los supuestos del plan:

- S1: `supabase db dump --db-url` sin `-f` escribe por stdout. El de datos ya empieza con `SET session_replication_role = replica`.
- S2: la pila temporal arranca con `--workdir .github/respaldo`, en 55341 y 55342 (`docker port`).
- S3: el contenedor se llama `supabase_db_calesa-restauracion`.
- S4: `session_replication_role` y la carga entera funcionan como `supabase_admin`. Como `postgres`, la carga cae (ver `decisiones.md`).
- S5 (el `age` de Ubuntu y el runner) y S6 (la forma de producción) siguen sin verificar.

La pila temporal queda abajo al terminar (`docker ps` sin contenedores `calesa-restauracion`).

## Mutaciones (`.piloto/salidas/P23/mutaciones.txt`)

Se revirtieron todas con `cp` y se comprobaron con `cmp`.

| Mn  | Qué se rompió                                                  | Qué cayó                                                                          |
| --- | -------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| M1  | se quita `src/app/api/horas/route.ts` de `RUTAS_CON_ADMIN`     | `admin.lint.test.ts`: esa ruta (1 falla)                                          |
| M2  | el bloque de las rutas va antes del de `src/app/**`            | `admin.lint.test.ts`: las 7 rutas                                                 |
| M3  | `RUTAS_CON_ADMIN = ['src/app/api/**/*.ts']`                    | testigos `api/otra/route.ts` y `api/solicitudes/ayudante.ts`                      |
| M4  | el bloque de las rutas pierde `SOLO_CLIENTES_DE_SHARED`        | `admin.lint.test.ts`: las 7 rutas                                                 |
| M5  | `INFRA_CON_ADMIN = ['src/modules/acceso/infra/**/*.ts']`       | testigo `acceso/infra/queries/perfiles.ts`                                        |
| M6  | `respaldo-diario.yml` sin `timeout-minutes`                    | `workflows.test.ts`: «el job respaldar no tiene timeout-minutes»                  |
| M7  | `restauracion-semanal.yml` con `actions/checkout@v7`           | `workflows.test.ts`: «no está fijada por SHA»                                     |
| M8  | `comprobar.sql` no mira las solicitudes (no estaba en el plan) | la autoprueba, en el paso 6: «comprobar.sh sin solicitudes pasó y tenía que caer» |

## Pendientes

- El job `autoprueba` de `restauracion-semanal.yml` corre por primera vez en el PR (sus `paths` lo disparan). Si cae por S5, el arreglo va
  en esta rama.
- `eslint.config.mjs` ya pasaba de 300 líneas antes de este paso (352) y ahora tiene 389. Es la configuración del kit, y ningún lint cuenta
  líneas en `.mjs`. Partirla es un paso propio de `base`.
