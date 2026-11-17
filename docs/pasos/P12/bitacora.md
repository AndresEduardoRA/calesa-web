# Bitácora · P12 · Medición

## 2026-11-17

- Plan en `.piloto/planes/P12.md`, auditado en dos rondas (la primera bloqueó por el plazo de 26 h con `ultimo_ok` nulo; corregido). Compuerta `afuera` contestada: se parte el paso (ver `decisiones.md`).
- Se hizo la parte de P12: el módulo `src/modules/medicion/` (`entities/`: tipos de evento, eventos, WhatsApp, embudo, cupos, latidos; `infra/queries/`: embudo y latido; `index.ts`; ficha `CLAUDE.md`). No hay `client.ts`.
- Rojo primero: las 8 pruebas fallaban al importar contra HEAD (`.piloto/salidas/P12/rojo.txt`).
- Verde: `pnpm vitest run src/modules/medicion`: 8 archivos, 43 pruebas. `mapa.sh --check`: `.piloto/salidas/P12/mapa-check.txt`.
- Mutaciones M1–M11 del plan y M12 (el token de `/reunion/<token>`): todas hacen caer la prueba que el plan nombra y se revirtieron con `cp` + `cmp`; el nombre de la prueba que cae de cada una está en `.piloto/salidas/P12/mutaciones.txt`.
- `pnpm lint` y `pnpm typecheck` sin warnings; `bash scripts/mapa.sh --check` ok; `pnpm test` (Vitest): 78 archivos, 1454 pruebas, todas verdes (1455 con la de `/reunion`).
- `pnpm test:kit` (la segunda mitad de `pnpm test`): dentro de la sesión del piloto 5 pruebas de `scripts/` fallan porque heredan las variables `PILOTO_*` del bucle. Con esas variables quitadas (`.piloto/salidas/P12/test-kit-entorno-limpio.txt`) queda 1 fallo, que también falla contra `7836b08` en un worktree limpio: «el ciclo completo: publicar, sincronizar, integrar solo lo que se puede» (`scripts/coordinador/coordinador.test.mjs:102`, espera «CI en verde; es rojo» y recibe «integrado por el coordinador»). Es de `scripts/coordinador/` (una guarda, no es de este paso) y este paso sólo agrega `src/modules/medicion/`. Pendiente para el dueño de las guardas.
- No se corrió el comando completo de `verificacion`: su último tramo (`pnpm test:e2e e2e/tareas/whatsapp.spec.ts`) es de P34 y el spec no existe. e2e dirigidos: ninguno.
- e2e completo: no (nivel 1, sin disparadores; el spec whatsapp.spec.ts pasa a P34).
