# P07 · Bitácora

## Qué se hizo

- `feat(notificaciones): armar las plantillas de correo y el ics`: `entities/` con las 12 plantillas de §6.8 (datos Zod, plantillas,
  marca en HTML y texto, escape), `.ics` REQUEST y CANCEL, referencias idempotentes y momentos de los recordatorios, con sus pruebas;
  `index.ts` y `CLAUDE.md`.
- `feat(notificaciones): orquestar los envíos sobre el registro de correos`: la interfaz `RegistroDeCorreos`, los reintentos y todo
  `infra/` (`enviarAhora` con 2 reintentos, `programar`, `cancelar`, `cancelarDeReunion`, `cancelarDeSolicitud`, `reprogramar`,
  `reintentar`, `despacharVencidos`), con un registro y un correo falsos para las pruebas.
- El `terminado` queda **en parte**: el registro real en `correos_salientes` y el .ics adjunto dependen de pasos de otros carriles
  (P27, P28, P29 propuestos; ver `decisiones.md`).

## Lo corrido

- Pruebas en rojo primero (contra HEAD, sin el código de producto, «Failed to resolve import»): `.piloto/salidas/P07/rojo-entities.txt` y
  `.piloto/salidas/P07/rojo-infra.txt`. Nota: las pruebas y el código se escribieron en la misma pasada; el rojo se sacó quitando el código
  de producto y se restauró con `diff -r`.
- `pnpm exec vitest run src/modules/notificaciones`: 12 archivos, 119 pruebas en verde (la corrida completa de `verificacion.txt` las incluye).
- Mutaciones (17): M1–M15 del plan (con M11 en `entities/datos.ts`, donde vive la lógica) y M16–M17 de la auditoría del informe (el `;` y
  la `,` del .ics); las 17 hacen caer la prueba prevista y los archivos se restauraron con `cp` + `cmp`:
  `.piloto/salidas/P07/mutaciones.txt` (resultado) y `mutaciones-detalle.txt` (qué cambia cada una).
- `pnpm lint && pnpm typecheck && pnpm test && bash scripts/mapa.sh --check`: verde (57 archivos y 1253 pruebas de vitest, 45 del kit), con el
  entorno del bucle sin `PILOTO*` ni `COORD_*`: `.piloto/salidas/P07/verificacion.txt`.
- Con el entorno del bucle fallan pruebas **del kit** (`scripts/piloto/piloto.test.mjs` y `scripts/coordinador/coordinador.test.mjs`): leen
  `PILOTO_*` y `COORD_MERGE_AUTO=verde,ambar,rojo` del entorno. En la primera corrida fallaron 5 (esa salida se sobrescribió); sin `PILOTO*`
  queda 1 (`el ciclo completo…`: `.piloto/salidas/P07/kit-sin-piloto.txt`) y sin `COORD_MERGE_AUTO` pasan todas, como ya anotó P04. No son de
  este paso.
- Sin `.skip`, `.fixme` ni `.only` nuevos.

## Hallazgos

- La auditoría del informe encontró que el `;` del .ics no se escapaba (`'\;'` en JS vale `';'`) y que las dos pruebas daban por buena esa
  salida. Corregido con `String.raw`, con las expectativas arregladas y las mutaciones M16 y M17 (`fix(notificaciones): escapar el punto y coma
en el texto del ics`). También: dos números (duración, intentos) pasan por `formato.ts`, los imports a `shared` usan `@/shared/…` como los
  demás módulos y se arregló el markdown de la ficha.
- Prettier (formato al escribir) reformateaba el HTML dentro de las plantillas etiquetadas `html`: se importó la etiqueta como `seguro` (ver `decisiones.md`).
- No hay identidad de git configurada en este entorno: los commits llevan la de los commits anteriores del repo, pasada por variables de
  entorno en cada comando (nada se escribió en la configuración de git).

e2e completo: no (nivel 1, sin interfaz ni disparadores; sin e2e dirigidos)
