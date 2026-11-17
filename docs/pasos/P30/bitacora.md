# P30 · Bitácora

e2e completo: no (la primera corrida de `next build` se cortó con `SecurityFatalError`, un aviso de vulnerabilidad de Next.js, y
actualizar Next es una dependencia; el reintento compiló y el único spec no abrió el navegador: falta `chrome-headless-shell` 1248 en la
máquina del carril. Lo corre el CI)

## Qué se hizo

| Commit    | Asunto                                                          | Qué lleva                                                                                                                                                                                                                                                                                                                                                                      |
| --------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `44bc3ea` | `feat(datos): crear o juntar solicitudes con reparto parejo`    | `calesa_crear_solicitud`: `juntada` en el check de `auditoria`, `_bloquear_solicitudes`, `_elegir_asignado` (reparto parejo de solicitudes), `_limitar_a` por `ref_codigo`, `_juntar_solicitud` y `crear_o_juntar_solicitud` (sólo `service_role`). `solicitudes-rpc.sql` y `solicitudes-repetidas.sql`. Tipos.                                                                |
| `dab2a9c` | `feat(datos): traspasar solicitudes entre personas del panel`   | `calesa_reasignar_desactivar`: `_fallar` con E11–E17, `_pasar_reunion`, `reasignar_solicitud`, `_auditar_perfil` y su trigger, `_repartir_reuniones`, `_repartir_solicitudes` y `desactivar_usuario` (sólo `authenticated` con su clave), la clave `solicitudes.reasignar`. `solicitudes-reasignar.sql` y `usuarios-desactivar.sql`; la clave en `permisos-calesa.sql`. Tipos. |
| `4d8886d` | `feat(datos): borrar datos personales a pedido o por retención` | `calesa_borrar_retencion`: índices de `correos_salientes` por `para`, `solicitud_id` y `reunion_id`, `borrar_solicitud` (sólo `authenticated`, `solicitudes.borrar`) y `retencion_diaria` (sólo `service_role`). `retencion.sql`; la clave en `permisos-calesa.sql`. Tipos.                                                                                                    |

`src/shared/types/database.types.ts` se regeneró en cada commit sobre su propio árbol: las migraciones siguientes se apartaron mientras
tanto (`commit1.txt`…`commit3.txt`). Las pruebas que endurecieron las mutaciones se plegaron en su commit con `fixup` y `autosquash`,
todo local. El `autosquash` sólo cambió pruebas (no migraciones ni tipos), y el árbol final de cada commit volvió a pasar entero en
PGlite (`arbol-<commit>.txt`: 113, 123 y 128 bloques).

## Pruebas en rojo primero (`.piloto/salidas/P30/`)

- `rojo-<archivo>.txt`: contra HEAD `321adfb`, antes de las migraciones, caen los 26 bloques de los cinco archivos nuevos: 25 por `42883`
  (la función no existe) y el del check de `auditoria` por `23514` (todavía no admite `juntada`). En `permisos-calesa.sql` cae el bloque del catálogo: faltan `solicitudes.reasignar` y `solicitudes.borrar`.

## Verificación (2026-11-17)

Cada salida abre con el HEAD y la hora y termina con su `rc=`, salvo `mutaciones.txt`, que termina con su conteo.

| Qué                                                                                                                           | Resultado                                                                                                                                | Salida                                   |
| ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Prueba final sobre `4d8886d` (`pnpm db:reset && pnpm db:types && pnpm db:probar && pnpm lint && pnpm typecheck && pnpm test`) | Pasan todos los pasos hasta vitest (89 archivos, 1556/1556). Cae sólo `test:kit`, con 41/48 y rc 1: los 7 dependen del entorno del bucle | `prueba-final.txt`                       |
| `pnpm -s test:kit` con `env -u` de cada variable `PILOTO*`, `COORD_*` y `CARRILES_MAX` (la línea exacta está en la salida)    | 48/48, rc 0                                                                                                                              | `test-kit-sin-entorno.txt`               |
| Base real (`supabase_db_calesa-web-datos`, psql con `ON_ERROR_STOP=1` y el candado)                                           | rc 0 en las cinco pruebas nuevas, `permisos-calesa` y `privilegios-de-anon`, con las pruebas finales y tras `db:reset` en `4d8886d`      | `real-*.txt`                             |
| `pnpm db:lint`                                                                                                                | rc 0, `"results":[]`                                                                                                                     | `db-lint.txt`                            |
| Splinter (`scripts/splinter.sql`)                                                                                             | rc 0 y 0 filas `ERROR`. De lo nuevo, el `WARN` de definidor ejecutable por `authenticated` sólo lo dan las tres del panel, a propósito   | `splinter.txt`                           |
| Mutaciones (48)                                                                                                               | caen las 48; cada una restaurada y comparada con `cmp`                                                                                   | `mutaciones.txt`                         |
| `nivel.mjs --rango 321adfb..HEAD`                                                                                             | nivel 2 (`rls` y `estructura`), sin interfaz                                                                                             | `nivel.txt`                              |
| `mapa.sh --check`                                                                                                             | rc 0                                                                                                                                     | `mapa-check.txt`                         |
| `pnpm test:e2e:completo --project=escritorio`                                                                                 | no corrió (ver el marcador arriba)                                                                                                       | `e2e-completo.txt`, `e2e-completo-2.txt` |

- **e2e dirigidos:** ninguno. Ni una interfaz ni una ruta llaman todavía a estas RPC.
- **Mutaciones que sobrevivieron y se arreglaron:**
  - M1 (contar sin el filtro de semana) se vio a mano antes de correrla, sin salida guardada: el bloque «reparto · menos» suma a V2 otra
    solicitud de la semana pasada, y ahora cae.
  - M26 (EXECUTE de desactivar también a `service_role`): sin sesión, E11 también es `42501`. Las pruebas de grants de las tres del
    panel miran ahora `has_function_privilege('service_role', …)`; M38 y M39 cubren reasignar y borrar.
- **Fallo encontrado y arreglado:** con `search_path = ''`, `=` entre `citext` distinguía mayúsculas: crear no juntaba `Repe@…` con
  `REPE@…` y borrar no tomaba un `para` en mayúsculas. Ahora va `operator(extensions.=)` (M36 y M37).
- **Carreras:** el kit no tiene `db:carreras`, así que dos conexiones a la vez no se probaron. Las defienden el orden de los candados y
  los bloques de forma (M7, M13c, M24c, M24d2).

## Pendientes (no son de este paso)

- `pnpm test` dentro del bucle termina con rc 1 por 7 tests del kit que heredan el entorno del bucle (como en P05 y P32). Le toca al
  carril `calidad`.
- `next build` se cortó con `SecurityFatalError` en la primera corrida del e2e. Actualizar Next es una dependencia: va en su propio
  paso, con su compuerta.
- Faltan los navegadores de Playwright en la máquina del carril.
- El repo no tiene identidad de git: los commits usan la de los commits anteriores del carril, pasada con `git -c`.
- Los avisos `afuera` (`repetidas.ts`, la RPC de `latidos`, el `terminado` de P34) están en `decisiones.md`.
