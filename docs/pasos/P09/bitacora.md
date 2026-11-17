# P09 · Bitácora

e2e completo: no (nivel 1 y sin disparadores del nivel 2, según `nivel.mjs`; corrido sólo el dirigido del paso,
`pnpm test:e2e e2e/calculadora/`, en escritorio y movil)

## Qué se hizo

- `feat(calculadora): dibujar la pantalla de precios`:
  - las tarjetas de los 4 planes con el selector Mensual / Anual y la tabla completa de §6.3 con sus dos pies, sin exceso de autos;
  - salen por `planes/pantallas/inicio.ts` y `planes.ts`.
- `feat(calculadora): leer los datos del panel para el visitante`:
  - `leerConfigCalculadora()` (`publico.config_calculadora()` como `anon`, en `'use cache'` con la etiqueta `calculadora`);
  - `leerFilaDeConfig()`;
  - `ETIQUETA_DE_CONFIG` en `index.ts`;
  - el e2e del ejemplo 1.
- `feat(calculadora): dibujar las secciones públicas de inicio`:
  - la calculadora: 5 datos, resultado, rango, desglose, horas, «Cómo se calculó», el evento y «Agendar demo»;
  - el bloque de prueba con el texto de A0.2;
  - salen por `calculadora/pantallas/inicio.ts`.
- El `terminado` queda **en parte**. Las pantallas no están montadas en ninguna ruta (P08) y el detalle por correo no está (P38, P39).
  `decisiones.md` explica la partición.

## Lo corrido

- **Pruebas en rojo primero**, contra HEAD (5f732e3) y antes del código de producto, en `.piloto/salidas/P09/*-rojo.txt`:
  - los 12 archivos nuevos caen al importar («Failed to resolve import»);
  - `config.test.ts` cae con 8 pruebas («leerFilaDeConfig is not a function»);
  - el e2e cae en el build: TS2305, sin `leerFilaDeConfig` (`e2e-rojo.txt`).
- **Mutaciones (26):** M1–M24 del plan, más M25 y M26 de la auditoría del informe.
  - M20 también contra el e2e, con la base real (`mut/M20-e2e.txt`).
  - M14 no hizo caer la prueba de la sección en la primera corrida. Se ajustó la prueba y desde entonces cae.
  - La corrida final, sobre el código ya formateado, da 24 de 24. Cada archivo se restauró con `cp` y se comprobó con `cmp`
    (`.piloto/salidas/P09/mutaciones.txt`).
- **`verificacion.comando` del paso, completo** (`.piloto/salidas/P09/final.txt`, `rc=0`):
  - `pnpm lint` y `pnpm typecheck` limpios;
  - vitest: 100 archivos y 1584 pruebas;
  - kit: 47 de 47;
  - `mapa.sh --check` en verde;
  - `pnpm test:e2e e2e/calculadora/`: 2 de 2 (escritorio y movil).
  - Se corrió con el entorno del bucle sin `PILOTO_*` ni `COORD_*` (salvo `PILOTO`). Con ese entorno fallan 7 pruebas del kit
    (`scripts/piloto/piloto.test.mjs` y `scripts/coordinador/coordinador.test.mjs`): leen `PILOTO_AUTO` y `COORD_MERGE_AUTO` (`test-verde.txt`). Sin él, 47 de 47
    (`test-kit-sin-entorno.txt`).
- **El primer `next build` de cada corrida** se cortó con `SecurityFatalError` de Next 16.4.3, que recomienda actualizar
  (`final-aviso-next.txt`, `e2e-aviso-next.txt`). Al reintentar, compila. No se actualizó Next: es una dependencia del carril `base`.
- **Commits:** sin identidad de git en el worktree, se firmaron con `git -c user.name=… -c user.email=…`, con la misma identidad de los
  commits de pasos anteriores.

## Tras la auditoría del informe

- `fix(calculadora): nombrar para el lector el plan recomendado de la tabla`. La prueba cayó primero (`fix-recomendado-rojo.txt`) y quedó
  en verde (`fix-recomendado-verde.txt`); M26, que borra el texto oculto, la hace caer.
- `fix(calculadora): medir en px los blancos táctiles de 44`. Es un cambio de clases (`min-h-[2.75rem]` → `min-h-[44px]`) sin prueba
  unitaria que lo vea: lo mide el e2e con el texto al 200 % de P37.
- M22 hace caer `calculadora-publica.test.tsx` porque ya no encuentra la etiqueta, no por su aserción de X11. Para probar esa aserción,
  M25 suma «US$ 25 por auto extra» a un texto del resultado, y la prueba cae sólo por esa aserción (`mut/M25-seccion.txt`).
- Después de los dos `fix`, el `verificacion.comando` completo otra vez en verde (`final-tras-fix.txt`, `rc=0`): lint y typecheck limpios, vitest 100 archivos y 1584 pruebas, kit 47 de 47, mapa, e2e 2 de 2. La primera corrida se cortó otra vez por el `SecurityFatalError` (`final-tras-fix-aviso-next.txt`).

## Pendientes (ajenos al paso)

- Las secciones no tienen e2e de pantalla hasta P37. Lo que toca interfaz quedó probado con Vitest (jsdom), no en un navegador.
- No se midió el presupuesto de JS de `/` (≤ 170 KB): no hay ruta. Lo mide P37 o P18.
- `scripts/e2e-dirigidos.mjs:172-174` y `e2e/soporte/sin-celular.ts:230` no leen las subcarpetas de `e2e/`. Por eso el CI del PR corre
  el completo y `publica.spec.ts` corre también en `movil`.
- `next build` con `SecurityFatalError` (Next 16.4.3): actualizar Next es del carril `base`.
- Con el entorno del bucle fallan 7 pruebas del kit (`scripts/piloto/piloto.test.mjs` y `scripts/coordinador/coordinador.test.mjs`): el
  `verificacion.comando` da rojo dentro del bucle por algo que el paso no toca.
- §15.1 de la semilla manda editar la cifra del cliente en `src/modules/sitio/`, pero vive en `src/modules/calculadora/entities/prueba.ts`.
