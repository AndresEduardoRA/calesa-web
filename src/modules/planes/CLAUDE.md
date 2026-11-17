# planes

Los precios y planes de Calesa (semilla §5.4): el catálogo con sus reglas de precio, las tarjetas y la tabla completa de `/planes`.

## Tablas

- Ninguna: los precios son constantes de código (`entities/precios.ts`), la única fuente.

## Entra y sale

- Entra: sólo `shared` (`lib/formato.ts`). No depende de ningún módulo.
- Sale, por `index.ts` (servidor): `PLANES`, `pagoAnual`, `ahorroAnual` y los tipos `Plan` e `IdPlan`.
- Sale, por `pantallas/inicio.ts` (sólo `src/app`): `TarjetasConSelector` (Client Component), `tarjetasDePlanes` y `Tarjeta`.
- Sale, por `pantallas/planes.ts` (sólo `src/app`): `TarjetasConSelector`, `TablaCompleta`, `tarjetasDePlanes`, `tablaDePlanes`, `PIE_DE_TABLA`, `TEXTO_DE_CELDA` y sus tipos.
- P08 los monta en `/` y `/planes`; los e2e de pantalla son de P37 (P09 los deja probados con Vitest).

## Archivos clave

- `entities/precios.ts` — `PLANES` (Vitrina, Operación, Completo, Grupo), `pagoAnual()` (cuota · 10), `ahorroAnual()` (cuota · 12 − anual) y los textos que comparten tarjetas y tabla: `montoDelPlan()`, `autosDelPlan()` y `semanasDelPlan()`.
- `entities/tarjetas.ts` — `tarjetasDePlanes()`: tamaño, 4 líneas, plazo y los textos de Mensual y de Anual.
- `entities/tabla.ts` — `tablaDePlanes()`: las 4 secciones y 17 filas de §6.3, celda por celda; `PIE_DE_TABLA` y `TEXTO_DE_CELDA`.
- `entities/x11.fixture.ts` — la expresión que reconoce el exceso de autos, sólo para las pruebas.
- `features/precios/components/tarjetas-con-selector.tsx` — las 4 tarjetas y el selector Mensual / Anual (estado local, arranca en Mensual).
- `features/precios/components/tabla-completa.tsx` — la tabla de §6.3 con sus dos pies: encabezado pegajoso desde `md`, scroll propio y primera columna fija debajo.

## No se rompe

- Las cifras salen sólo de `PLANES`: el anual y el ahorro se calculan, y las tarjetas y la tabla no copian ningún número.
- Grupo lleva «desde» en sus cuatro montos; ningún otro plan.
- La regla de exceso de autos no aparece en ningún texto (X11), tampoco en lo dibujado: las pruebas de los componentes pasan el `textContent` por `NOMBRA_EL_EXCESO`.
- `NOMBRA_EL_EXCESO` está copiada en tres pruebas de `calculadora` (`entities/como-se-calculo.test.ts`, `entities/etiquetas.test.ts` y `features/publica/components/calculadora-publica.test.tsx`), porque el lint no deja importarla desde otro módulo: un cambio en `x11.fixture.ts` se repite allí.

## Ojo

- Los textos con dinero son de riesgo rojo: un cambio pide su prueba texto por texto y su mutación.
- `pantallas/` es sólo para `src/app`; el servidor usa `index.ts`.
