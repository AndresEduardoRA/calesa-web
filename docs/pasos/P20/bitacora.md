# P20 · Bitácora

## Qué se hizo

- `feat(equipo): normalizar y validar los códigos de prospección`: `prospeccion/entities/codigo.ts` (`normalizarCodigo`, `esCodigoValido`, `esquemaCodigoDeProspeccion`, `codigoDeRef`) con test; `index.ts` y ficha.
- `feat(equipo): leer las filas visibles del equipo para la portada`: `equipo/entities/miembro.ts` con test, `infra/cliente-publico.ts` y `infra/queries/equipo-visible.ts` (`'use cache'`, etiqueta `equipo`, 1 h) con sus tests; `index.ts` y ficha.
- `feat(equipo): dibujar la sección quiénes somos`: `SeccionQuienesSomos` con test y `pantallas/inicio.ts`.

## Lo corrido

- Plan auditado: observaciones, sin bloqueos; corregidas en el plan (`.piloto/planes/P20.respuestas.md`). Sin compuerta: P1 y P2 son microdecisiones.
- Pruebas en rojo primero (sin la implementación, «Failed to resolve import»): `.piloto/salidas/P20/rojo.txt`. Las de infra y del componente se escribieron junto con su código y se probaron por mutación.
- 55 pruebas de P20 en verde (5 archivos). Mutaciones: M1–M20 del plan, las 20 caen y se restauran (`cmp`): `.piloto/salidas/P20/mutaciones.txt`.
- `pnpm lint && pnpm typecheck && pnpm test && bash scripts/mapa.sh --check`: verde, `exit_total=0`, con el entorno del bucle sin `PILOTO_*` ni `COORD_*`: `.piloto/salidas/P20/final-sin-env.txt`.
- Con el entorno del bucle (`COORD_MERGE_AUTO`, `PILOTO_AUTO`…) fallan 5 pruebas **del kit** (`scripts/coordinador/coordinador.test.mjs` y `scripts/piloto/piloto.test.mjs`): no son de este paso ni tocan nada suyo, y pasan con esas variables sin definir (igual que anotó P04). Salida: `.piloto/salidas/P20/final.txt`.
- Los commits se hicieron con la autoría de los commits anteriores del repo (`GIT_AUTHOR_*` y `GIT_COMMITTER_*` sólo en esos comandos): el entorno no tiene `user.name` ni `user.email`.

e2e completo: no (nivel 1; la sección no se monta en ninguna ruta hasta P08 y ningún spec nombra estos módulos; CI pedirá el completo por e2e-dirigidos)
