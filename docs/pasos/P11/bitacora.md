# P11 · Bitácora

e2e completo: no (1.ª vez, `next build` se cortó con `SecurityFatalError` de Next 16.4.3; 2.ª vez, la app compila pero en la máquina
del carril no está el navegador de Playwright, `chrome-headless-shell` 1248, y el único spec, `inicio`, no llega a abrirlo. El CI del PR
corre el completo en `escritorio` (archivos de `src/` sin spec que los nombre, `scripts/e2e-dirigidos.mjs`); `movil`, el completo de la
noche. Sin e2e dirigidos: el paso no agrega rutas ni pantallas)

## Qué se hizo

- `feat(ventas): agregar las reglas puras de los casos públicos de agenda`: `entities/respuestas.ts` (schemas de `datos_para_horas` y de
  `_resumen_reunion`), `entities/semana.ts` (la semana ISO en la zona del visitante, su vacío y `agruparPorDia`) y `entities/gestion.ts`
  (cambiable, fuera de plazo, puede volver a reservar o cerrada), con sus pruebas y las respuestas de ejemplo (`respuestas.soporte.ts`).
- `feat(ventas): llamar a las rpc de la agenda por un puerto validado`: `infra/rpc.ts` (`LlamarRpc`, las cuatro llamadas con los argumentos
  fijados contra los tipos generados, la respuesta validada y la tabla de errores) e `infra/tokens.ts` (los dos tokens), con sus pruebas y los
  dobles (`pruebas.soporte.ts`).
- `feat(ventas): armar los casos públicos de horas, reserva y gestión`: `infra/correos.ts`, `infra/casos/` (`horas.ts`, `reservar.ts`,
  `gestionar.ts`, `entrada.ts`, `tipos.ts`), `index.ts` y la ficha `CLAUDE.md`.
- Tras la auditoría del informe: `fix(ventas): validar los correos del resumen con el check de la base` (antes, `z.email()` podía volver
  una reserva ya hecha un «inesperado» sin correos) y `test(ventas): probar que los casos rechazan las entradas inválidas`.
- El `terminado` queda **en parte**: rutas, pantallas y e2e de /agendar y /reunion dependen de pasos que no existen (P22, P23, P24, P26 y el
  reloj fijo). Se proponen P35 y P36 (ver `decisiones.md`).

## Lo corrido

- Pruebas en rojo primero, contra HEAD (7836b08), antes del código de producto: los nueve archivos de conducta caen al importar
  («Failed to resolve import» / «Cannot find module») y `casos/tipos.test.ts` cae en `tsc` (TS2307): `.piloto/salidas/P11/rojo.txt`.
- `pnpm exec vitest run src/modules/agenda`: 17 archivos y 163 pruebas en verde, 71 nuevas (92 ya existían):
  `.piloto/salidas/P11/agenda.txt`.
- Mutaciones (19): M1–M17 del plan (M10 en `infra/casos/entrada.ts`, donde quedó la validación de la zona; M17 hace caer `pnpm typecheck`
  en `tipos.test.ts`), M18 (los correos del resumen con `z.email()`, el rojo del `fix`) y M19 (el instante de las entradas sin validar). Las
  19 hacen caer la prueba prevista y cada archivo se restauró con `cp` y se comprobó con `cmp`: `.piloto/salidas/P11/mutaciones.txt`.
- `verificacion.comando` del paso, completo, con el entorno del bucle sin `PILOTO_AUTO*` ni `COORD_*` (`.piloto/salidas/P11/final.txt`):
  `pnpm lint` y `pnpm typecheck` limpios, vitest 80 archivos y 1479 pruebas, kit 45 de 45, `mapa.sh --check`, `db:reset` y `db:probar` en
  verde. `pnpm test:e2e:completo` cayó en `next build` por el `SecurityFatalError` de Next 16.4.3 (`rc=1`). Al reintentarlo compiló, pero las
  dos corridas de `e2e/inicio.spec.ts` (escritorio y movil) fallaron al abrir el navegador: «Executable doesn't exist at
  …/chromium_headless_shell-1248/…» (`.piloto/salidas/P11/e2e-completo.txt`). No se instaló el navegador.
- Tras el `fix` y el `test`, otra vez todo el comando menos el e2e (`.piloto/salidas/P11/final-tras-fix.txt`, `rc=0`): lint y typecheck
  limpios, vitest 80 archivos y 1483 pruebas, kit 45 de 45, mapa, `db:reset` y `db:probar` en verde.
- Con el entorno del bucle fallan cinco pruebas **del kit** (`scripts/piloto/piloto.test.mjs`, `scripts/coordinador/coordinador.test.mjs`):
  leen `PILOTO_AUTO=producto,datos,guardas` y `COORD_MERGE_AUTO=verde,ambar,rojo`, que exporta el bucle (`.piloto/salidas/P11/test.txt`).
  Sin esas variables pasan las 45 (`.piloto/salidas/P11/test-kit-sin-entorno-del-bucle.txt`), como ya anotaron P04 y P07. No son de este
  paso: no toca `scripts/`.
- `node scripts/guardas/carriles.mjs 7836b08 ventas/p11`, sobre el rango completo: «25 archivos de ventas/p11 cumplen»
  (`.piloto/salidas/P11/carriles.txt`).
- `node scripts/piloto/nivel.mjs` sobre el rango: nivel 1, sin disparadores ni interfaz. No hay e2e dirigidos: ningún spec nombra agenda,
  reunión ni agendar, y este paso no agrega rutas.
- Sin `.skip`, `.fixme` ni `.only` nuevos.

## Hallazgos

- No hay identidad de git configurada en este entorno: los commits llevan la de los commits anteriores del repo, pasada con `git -c` en cada
  commit (nada se escribió en la configuración de git).
- La respuesta de horas en el peor caso (7 × 24, 336 inicios, zona de 30 caracteres) pesa menos de 20 KB agrupada por día (unos 18 KB por
  la cuenta del plan); la prueba lo mide con `JSON.stringify`.
- `next build` avisa de una vulnerabilidad conocida en Next 16.4.3 (`SecurityFatalError`, la 1.ª vez que corre). Actualizar Next no es de
  este paso: es una compuerta `dependencia`.
- La auditoría del informe encontró que `z.email()` en el resumen era más estricto que la base y corría después del commit de la RPC:
  corregido en el `fix`, con M18.
