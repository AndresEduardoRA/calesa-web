# P04 · Bitácora

## Qué se hizo

- `feat(ventas): calcular las horas disponibles de la agenda`: `config`, `tiempo`, `elegibilidad`, `horas`, `zona` y
  `ejemplos.soporte` de `agenda/entities`, con tests; `agenda/index.ts` y `agenda/CLAUDE.md`.
- `feat(ventas): elegir el anfitrión con reparto parejo`: `reparto` y `anfitrion`, con tests; export y ficha al día.
- `feat(ventas): validar estados y juntar solicitudes repetidas`: `estados` y `repetidas` de `solicitudes/entities`, con tests;
  `solicitudes/index.ts` y `solicitudes/CLAUDE.md`.

## Lo corrido

- Pruebas en rojo primero (contra HEAD, «Failed to resolve import»): `.piloto/salidas/P04/rojo-*.txt`.
- `pnpm exec vitest run src/modules`: 9 archivos, 240 pruebas en verde (agenda 7 archivos, solicitudes 2): `.piloto/salidas/P04/vitest-modulos.txt`.
- Mutaciones: 51 (las 37 del plan, 13 de la auditoría del plan y M51, de la auditoría del informe); la primera ronda dejó 4 vivas (M37, M38, M49, M50) por aserciones débiles
  (`toMatchObject({ cambios: {} })` acepta cualquier objeto; un empate por `creadoEn` escondía `excluirReunionId`; faltaba una reunión
  de otra semana). Se reforzaron las pruebas y las 51 mueren: `.piloto/salidas/P04/mut/resultado.txt`.
- `pnpm lint && pnpm typecheck && pnpm test && bash scripts/mapa.sh --check`: verde (992 pruebas de vitest y 41 del kit; `exit_total=0` y `mapa --check exit=0` en la salida) con el entorno
  del bucle sin `COORD_*`: `.piloto/salidas/P04/verificacion-sin-env-coord.txt`.
- Con el entorno del bucle (`COORD_MERGE_AUTO=verde,ambar,rojo` de `piloto.config`) falla una prueba **del kit**
  (`scripts/coordinador/coordinador.test.mjs`, «el ciclo completo…», espera que P01 rojo lo integre la persona): no es de este paso ni
  toca nada suyo, y pasa con esa variable sin definir. Salida: `.piloto/salidas/P04/verificacion.txt`.

- La auditoría del informe encontró que `elegirAnfitrion` comparaba `h` como texto (una hora válida con `Z` o `-04:00` daba «Esa hora
  se acaba de ocupar»). Corregido comparando por instante, con su prueba y la mutación M51.

e2e completo: no (nivel 1, sin interfaz ni disparadores; sin e2e dirigidos)
