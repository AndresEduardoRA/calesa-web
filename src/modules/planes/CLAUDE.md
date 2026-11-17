# planes

Los precios y planes de Calesa (semilla §5.4): el catálogo con sus reglas de precio, las tarjetas y la tabla completa de `/planes`.

## Tablas

- Ninguna: los precios son constantes de código (`entities/precios.ts`), la única fuente.

## Entra y sale

- Entra: sólo `shared` (`lib/formato.ts`). No depende de ningún módulo.
- Sale, por `index.ts` (servidor): `PLANES`, `pagoAnual`, `ahorroAnual` y los tipos `Plan` e `IdPlan`.
- Sale, por `pantallas/inicio.ts` (sólo `src/app`): `tarjetasDePlanes` y `Tarjeta`.
- Sale, por `pantallas/planes.ts` (sólo `src/app`): `tarjetasDePlanes`, `tablaDePlanes`, `PIE_DE_TABLA`, `TEXTO_DE_CELDA` y sus tipos.
- Los componentes (tarjetas dibujadas, selector Mensual/Anual, tabla con encabezado pegajoso) llegan con su pantalla y salen por esos mismos archivos de `pantallas/`.

## Archivos clave

- `entities/precios.ts` — `PLANES` (Vitrina, Operación, Completo, Grupo), `pagoAnual()` (cuota · 10), `ahorroAnual()` (cuota · 12 − anual) y los textos que comparten tarjetas y tabla: `montoDelPlan()`, `autosDelPlan()` y `semanasDelPlan()`.
- `entities/tarjetas.ts` — `tarjetasDePlanes()`: tamaño, 4 líneas, plazo y los textos de Mensual y de Anual.
- `entities/tabla.ts` — `tablaDePlanes()`: las 4 secciones y 17 filas de §6.3, celda por celda; `PIE_DE_TABLA` y `TEXTO_DE_CELDA`.
- `entities/x11.fixture.ts` — la expresión que reconoce el exceso de autos, sólo para las pruebas.

## No se rompe

- Las cifras salen sólo de `PLANES`: el anual y el ahorro se calculan, y las tarjetas y la tabla no copian ningún número.
- Grupo lleva «desde» en sus cuatro montos; ningún otro plan.
- La regla de exceso de autos no aparece en ningún texto (X11).

## Ojo

- Los textos con dinero son de riesgo rojo: un cambio pide su prueba texto por texto y su mutación.
- `pantallas/` es sólo para `src/app`; el servidor usa `index.ts`.
