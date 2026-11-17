# P03 · Bitácora

e2e completo: no (nivel 1, sin interfaz ni spec que nombre el módulo; lo corre CI por huérfanos)

## Qué se hizo

- `a6fa584` feat(calculadora): las fugas del mes. Esquemas de entradas y de datos del panel, supuestos, fórmula y resumen (§5.2; B4, X3).
- `acd6732` feat(calculadora): la escala «Crecer sin contratar» (§5.3; B8).
- `d8675ea` feat(calculadora): el catálogo de planes, las tarjetas y la tabla, por `index.ts` y `pantallas/` (§5.4 y §6.3; B6, B7, X11).
- `e4c91d8` fix(calculadora): una entrada que no es objeto (`null`, `undefined`, un texto) no corre las reglas cruzadas; lo pidió la
  auditoría del informe. Pruebas en rojo primero: `.piloto/salidas/P03/rojo-fix.txt` (11 fallan) y, con el caso de la
  lista y la prueba de `rangos` que entraron, `rojo-fix-2.txt` (11 fallan contra el `rangos.ts` de antes del fix).
- A3 no pide conducta en P03: el embudo es de P12 y P14.

## Pruebas en rojo primero (contra HEAD `090f985`)

- `.piloto/salidas/P03/rojo-calculadora.txt`: 7 archivos de prueba fallan, porque los módulos no existen.
- `.piloto/salidas/P03/rojo-planes.txt`: 3 archivos de prueba fallan, por lo mismo.

## Verificación (2026-11-05)

| Qué                             | Resultado                                                                                     |
| ------------------------------- | --------------------------------------------------------------------------------------------- |
| `pnpm lint`                     | 0 problemas (`lint.txt`)                                                                      |
| `pnpm typecheck`                | sin errores (`typecheck.txt`)                                                                 |
| Vitest (`pnpm exec vitest run`) | 36 archivos, 886 pruebas, 0 fallas (`verificacion.txt`); las de P03: 10 archivos, 134 pruebas |
| `pnpm test:kit`                 | 41 pruebas, **1 falla** (`test-kit.txt`), que ya estaba en `main` (abajo)                     |
| `bash scripts/mapa.sh --check`  | pasa (`mapa.txt`)                                                                             |
| `verificacion.comando` del paso | **rc 1**, sólo por `test:kit` (`verificacion.txt`)                                            |
| e2e                             | ninguno dirigido: ningún spec nombra `calculadora` ni `planes`                                |

Las salidas están en `.piloto/salidas/P03/`.

## Mutaciones

Todas caen. Una por vez, se restauran con `cp` y se confirman con `cmp`. Las salidas están en `.piloto/salidas/P03/mutaciones-*.txt`.

| Mn   | Qué se rompe                                       | Cae                                              |
| ---- | -------------------------------------------------- | ------------------------------------------------ |
| M1   | `cf = c`                                           | ejemplos 1 y 2, ventas                           |
| M2   | `dia_auto` con `/ 360`                             | días                                             |
| M3   | sin `max(0)` del costo                             | D1                                               |
| M4   | cambio sin mirar `moneda_local`                    | ejemplo 3                                        |
| M5   | cambio sin `no_ajusta`                             | cambio                                           |
| M6   | sin `max(0)` del saldo                             | D2                                               |
| M7   | `atraso[0]` en los dos escenarios                  | saldos máx                                       |
| M8   | `h_cot` sin `pct_cotiza`                           | tiempo                                           |
| M9   | tiempo con `/ 160`                                 | tiempo                                           |
| M10  | total sin olvidos                                  | total                                            |
| M11  | redondear cada fila antes de sumar                 | total con `toBeCloseTo`                          |
| M12  | `VOLATILIDAD.alta = [0.01, 0.02]`                  | supuestos y D3                                   |
| M13  | `PROBABILIDAD_TARDE.sig = 0.8`                     | supuestos y D4                                   |
| M14  | sin la regla «consultas ≥ autos»                   | entradas                                         |
| M15  | la regla sin `when`                                | entradas: «no corre» y «otro campo no es número» |
| M15b | la regla con `when: () => true`                    | entradas: «no corre»                             |
| M16  | horas con `Math.floor`                             | resumen «77 a 139»                               |
| M17  | titular con el máximo                              | resumen                                          |
| M18  | `techo` sin `− 1e-9`                               | G                                                |
| M19  | sin `max(administracion)`                          | F                                                |
| M20  | sin `max(vendedores)`                              | F                                                |
| M21  | capacidades cruzadas                               | H                                                |
| M22  | sin «misma cantidad»                               | D                                                |
| M23  | sin la regla de la meta                            | E                                                |
| M23b | la regla de la meta sin `when`                     | «otro campo no es número» y «no corre»           |
| M23c | la regla de la meta con `when: () => true`         | «no corre»                                       |
| M24  | sin el «un solo número»                            | F                                                |
| M25  | `pagoAnual = cuota · 12`                           | precios, tarjetas y tabla (corridas aparte)      |
| M26  | `ahorro = cuota · 11 − anual`                      | precios                                          |
| M27  | Grupo sin `desde`                                  | tarjetas y tabla                                 |
| M28  | anual sin «· ahorras …»                            | tarjetas                                         |
| M29  | Vitrina con inventario                             | tabla                                            |
| M30  | una palabra del pie                                | tabla                                            |
| M31  | precio desde 300                                   | config                                           |
| M32  | cuota de Vitrina 491                               | tarjetas y tabla (corridas aparte)               |
| M33  | implementación de Operación 12001                  | tarjetas y tabla (corridas aparte)               |
| M34a | tope de Completo 151                               | tarjetas y tabla (corridas aparte)               |
| M34b | semanas de Grupo [8, 13]                           | tarjetas y tabla (corridas aparte)               |
| M35  | `cuandoPasaron()` sin frenar un problema sin campo | rangos, entradas y escala (corridas aparte)      |

- La primera corrida de M15 y M15b no aplicó la mutación: el texto buscado no coincidía por las comillas («el texto aparece 0 veces» en
  `mutaciones-fugas.txt`). Se repitieron en `mutaciones-fugas-2.txt`, y caen.
- Tras el fix se repitieron M15, M15b, M23, M23b y M23c (`mutaciones-when-tras-fix.txt`), y caen. M35 está en `mutaciones-fix.txt`; una
  primera versión del fix con una guarda extra sobre el tipo del valor dejaba sobrevivir su mutación, y esa guarda se quitó.

## Pendiente fuera del paso

- **`pnpm test` falla en `main` desde `73401c2`.** `piloto.config` pasó a `COORD_MERGE_AUTO=verde,ambar,rojo`, y
  `scripts/coordinador/coordinador.test.mjs:102` sigue esperando que un paso rojo lo integre la persona. Son guardas del kit, fuera del
  carril; mientras no se arregle en `main`, el `verificacion.comando` de este paso (y el de cualquier otro) da rc 1.
- Pedidos de las respuestas: el paso P26 (coordinador) y los términos de P6 (próxima versión de la semilla).
