# P03 · Decisiones

Fórmulas de calculadora y escala, y precios (entities). Riesgo rojo; el plan lo aprobó la persona el 2026-11-05.

## Respuestas de la persona (2026-11-05)

Compuerta `producto` g-1793893742-31884: en las siete eligió la opción 1, la recomendada.

- **P1 · Textos de la tarjeta que B7 no fija.** Tamaño «Hasta 60 autos al mes» o «Más de 150 autos al mes», plazo «Funcionando en 3–4
  semanas» o «Funcionando en 2 semanas», y cuatro líneas por plan sacadas sólo de la tabla de §6.3, sin montos (`tarjetas.ts`).
- **P2 · La gráfica «Crecer sin contratar».** Pedido al coordinador: sumar un paso **P26** del carril `calculadora`, rojo, que dependa de
  P03 y construya el componente en `calculadora/features/escala/` (por su `client.ts`). P11 suma P26 a su `depende_de`. P03 deja listos
  los números y los textos (`calcularEscala`, `textosDeEscala`).
- **P3 · Mensaje de rango.** «Escribe un número entero entre 1 y 400.» y, en montos, «Escribe un monto entre US$ 100 y US$ 30.000, sin
  centavos.» (`rangos.ts`).
- **P4 · El «desde» de Grupo.** «Desde US$ 5.500 /mes», «Desde US$ 55.000 /año · ahorras desde US$ 11.000», «+ implementación única desde
  US$ 60.000»; en la tabla, «Desde US$ 5.500».
- **P5 · «Misma cantidad».** El texto completo de §5.3: «Con la misma cantidad de autos no necesitas contratar. Calesa te devuelve horas
  para vender más.»
- **P6 · Términos nuevos.** P03 usa estos nombres sin sinónimos; la persona los suma a §11 en la próxima versión de la semilla, que
  regenera `docs/GLOSARIO.md` (P03 no puede tocarlo): **plan** (Vitrina, Operación, Completo, Grupo), **pago anual**, **ahorro**,
  **supuesto**, **tiempo de respuesta**, **volatilidad**, **capacidad extra**, **«Crecer sin contratar»** y **datos del panel**.
- **P7 · El «sí» de §6.3.** Operación en «Portal «Mi vehículo»» y Completo en «Finanzas del dueño» son celdas incluidas (✓ con «Incluido»
  oculto). «Sí, consolidado» de Grupo queda como texto.

## Decisiones de la ejecución (2026-11-05)

- **Microdecisiones de textos.** Los mensajes de los campos de opciones: «Elige cuánto tardas en contestar.», «Elige la volatilidad.» y
  «Elige sí o no.». Las celdas de la tabla empiezan en mayúscula. La fila es «Ahorro», como en §6.3, y no «Ahorro anual».
- **El redondeo vive sólo en `resumen.ts`** (X3). `calcularFugas()` devuelve todo sin redondear y sus pruebas comparan el total con
  `toBeCloseTo(…, 2)`; una mutación que redondea cada fila antes de sumar hace caer el ejemplo 1 (4452 contra 4451,87).
- **`client.ts` de `calculadora` lleva sólo tipos.** Las funciones viajan por `index.ts`; el componente de la gráfica es de P26 (P2).
- **Las reglas cruzadas usan `cuandoPasaron()`.** En Zod 4.6.7, una regla sin `when` no corre si otro campo falló por **tipo** (un texto
  donde va un número), pero **sí corre** si falló por **rango**. Por eso «consultas ≥ autos» y «meta ≥ hoy» llevan
  `when: cuandoPasaron(…)`: corren aunque falle otro campo, por tipo o por rango, y no corren si falló uno de sus dos campos. Las pruebas
  cubren los dos casos (un campo ajeno que no es número y uno de los dos campos fuera de rango). El plan esperaba que la mutación sin
  `when` (M15, M23b) cayera por la prueba de «dos problemas» con un rango; cae por las de «no corre» y por la del campo que no es número.
- **Derivados de la semilla** (las pruebas dicen «derivado de §5.x»; salen de la fórmula literal, no son reglas nuevas):
  - D1: con el margen mayor que el precio, los días perdidos son 0 (el `max(0, …)` del costo).
  - D2: con una seña mayor que el precio, los saldos son 0 (el `max(0, …)` del saldo).
  - D3: la volatilidad baja y alta (los ejemplos sólo usan la media).
  - D4: las respuestas h4 y sig (los ejemplos sólo usan dia y h1).
  - F: un solo número en «Con Calesa» y los `max(vendedores, …)` y `max(administracion, …)`.
  - G: el épsilon de `techo` (7 → 29 da 58; con `ceil` solo daría 60).
  - H: las capacidades de ventas y de operación sin cruzar.
  - I: las cifras de la frase con punto de miles.
- **Archivos que el plan no listaba**, dentro de las rutas del paso:
  - `calculadora/entities/ejemplos.fixture.ts` y `planes/entities/x11.fixture.ts`: datos sólo de prueba (los ejemplos de §5.2 y la
    expresión que reconoce el exceso de autos de X11), para no copiarlos en cada test.
  - En `precios.ts`, `montoDelPlan()`, `autosDelPlan()` y `semanasDelPlan()`: los textos que comparten las tarjetas y la tabla, siempre
    desde `PLANES`. Llevan su prueba.
  - En `rangos.ts`, `cuandoPasaron()`, con su prueba.
  - `calculadora/index.ts` exporta además `TIEMPOS_DE_RESPUESTA` y `VOLATILIDADES`, las opciones de los dos campos de opciones, para que
    la pantalla y el panel las listen sin copiarlas.
- **Una entrada que no es objeto no corre las reglas cruzadas** (lo pidió la auditoría del informe). Con `null` o `undefined`, Zod deja
  un problema sin campo y la regla leía campos que no existen: el esquema lanzaba en vez de devolver el error. `cuandoPasaron()` frena la
  regla si hay un problema sin campo. Una guarda extra sobre el tipo del valor sobraba (su mutación no hacía caer nada), así que no está.
- **Un aviso para el coordinador (no es de P03):** el e2e `e2e/calculadora/planes.spec.ts` de P09 no tiene ruta donde montarse, porque
  `/planes` es de P08 y P08 depende de P09 (plan.yaml:200-210).
