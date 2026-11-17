# P29 · Bitácora

e2e completo: no (paso de `src/modules/notificaciones/`, nivel 1, sin interfaz: ningún spec de `e2e/` toca el módulo; lo corre el CI del PR)

## Qué se hizo

- `a4a4871` · fecha con día en los correos: `entities/formato-correo.ts` usa `formatearFechaConDia`; pruebas actualizadas. Primero en rojo
  contra HEAD (8 fallos, `.piloto/salidas/P29/rojo-1.txt`).
- `9c762ce` · el .ics sale adjunto: `entities/adjunto-ics.ts` (`text/calendar; method=REQUEST|CANCEL`), `renderizar` devuelve `adjunto` y
  `infra/nucleo.ts › armar()` lo pone en el mensaje (enviar, programar, reintentar, despachar). Pruebas nuevas en rojo primero (8 fallos,
  `rojo-2.txt`): `entities/adjunto-ics.test.ts`, `infra/adjuntos.test.ts` y `render.test.ts`.
- `72039f6` · `registroDeSupabase(cliente)` sobre las 9 RPC de P27, `fila-de-correo.ts` (Zod y horas), la tabla de casos compartida
  (`casos-del-registro.soporte.ts`, 13 casos) que corren la memoria y el adaptador, el cliente falso, la memoria ajustada a P27 y la ficha.
- Ficha `src/modules/notificaciones/CLAUDE.md` al día. Sin cambios en `supabase/`, `src/shared` ni `eslint.config.mjs`.

## Lo corrido

- `pnpm lint`, `pnpm typecheck`, `bash scripts/mapa.sh --check`: verdes (`.piloto/salidas/P29/lint.txt`, `typecheck.txt`, `mapa.txt`).
- Vitest: 108 archivos, 1730 pruebas, todas verdes (`vitest.txt`).
- `pnpm test` completo (también corre `node --test` de `scripts/`): una falla ajena al paso, en `scripts/coordinador/coordinador.test.mjs:102`
  («el ciclo completo…»: espera «CI en verde; es rojo: lo integra la persona» y recibe «integrado por el coordinador»). No toqué `scripts/`;
  con el entorno del piloto, además fallan 6 pruebas de `scripts/piloto/` (`final.txt`); sin él, queda sólo esa (`test-sin-env.txt`). El
  entorno no tiene `user.name`/`user.email` de git: se probó con un autor por variables de entorno. La causa: la prueba hereda `COORD_MERGE_AUTO=verde,ambar,rojo` del entorno del piloto (`scripts/coordinador/coordinador.mjs:48`) y por eso integra el rojo; sin esa variable, las 6 pruebas del coordinador pasan. El CI no la tiene.
- Mutaciones (`mutaciones.txt`): 16 caen; 1 sobrevive y es equivalente (M17, el desempate por id en la memoria; ver `decisiones.md`).
- Commit 3: la tabla de casos corrida sobre la memoria de HEAD (antes del ajuste a P27) cae en 5 casos (`rojo-3.txt`: duplicado, las dos
  tablas de transiciones, el orden de `programadosDe` y registrar un `cancelado`). Las pruebas del adaptador se escribieron junto con el código
  (el archivo no existía): las mutaciones M1 a M9 son la prueba de que caen.

## Ojo

- Sin `db:probar`: no se tocó `supabase/`.
- Los commits los hice con el autor por variables de entorno (`GIT_AUTHOR_*`), porque el carril no tiene identidad de git configurada.
