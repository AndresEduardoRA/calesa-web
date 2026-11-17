# P09 · Decisiones

Fecha: 2026-11-17 (America/La_Paz). Calculadora pública, planes y tabla completa, prueba del cliente. Riesgo rojo. El plan
(`.piloto/planes/P09.md`) se auditó en dos rondas, las dos con observaciones y sin bloqueos; se aplicaron todas antes de ejecutar. Terminó
en la compuerta `datos` del paso rojo, que se contestó sola:

- 2026-11-17T12:18:43-04:00 · P09 · compuerta datos contestada sola (PILOTO_AUTO): aprobar

Con eso rigen las recomendadas de las cinco preguntas del plan:

- **P1 · Sin ruta pública.** `/` y `/planes` son de P08 (`sitio`), que depende de P09. P09 deja las pantallas listas por `pantallas/`,
  probadas con Vitest, y un e2e que lee los datos del panel como `anon` y reproduce el ejemplo 1. Los e2e de pantalla van a P37.
- **P2 · El detalle por correo** (B5, R4.18) sale de P09: lo hacen P38 (`calculadora`) y P39 (`ventas`). P09 no dibuja el botón «Te mando
  el detalle por correo», para no ofrecer algo que no funciona.
- **P3 · Sin los componentes de §8.5** (P24): HTML nativo, los tokens y el `Button` del kit, dentro de `features/`. P37 los cambia.
- **P4 · Los textos de «Cómo se calculó»**: una frase de entrada, una por fuga y los 9 datos del panel (`entities/como-se-calculo.ts`).
- **P5 · Las etiquetas**: «Autos que vendes al mes», «Margen promedio de cada auto», «Consultas que recibes al mes», «¿Cuánto tardas en
  contestar una consulta?» (En menos de 1 hora / En 1 a 4 horas / En el mismo día / Al día siguiente) y «Personas en administración y
  logística».

## El `terminado` queda cumplido en parte: P09 se partió

Faltan tres piezas que son de otros carriles y no existen: la ruta (`sitio`), `/api/solicitudes` (`ventas`) y los componentes de §8.5
(`base`). P09 hace lo que cabe en `src/modules/calculadora/`, `src/modules/planes/` y `e2e/calculadora/`. Pasos propuestos al coordinador
(si P37, P38 o P39 ya se usaron, va el siguiente libre):

| Paso                                                  | Qué hace                                                                                                                                                                                                                                                                             | `modulos`                                                                                                                                                 | Riesgo | Depende de    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------- |
| P37                                                   | Calculadora y planes en `/` y `/planes`: cifras que cuentan en 650 ms, componentes de §8.5, «Agendar demo» con `<Link>` y e2e de pantalla en escritorio y movil (el ejemplo 1 en `/#calculadora`, los errores, el evento, el selector Anual, la tabla con su pie, el texto al 200 %) | `src/modules/calculadora/features/publica/`, `src/modules/planes/features/`, `e2e/calculadora/publica.spec.ts`, `e2e/calculadora/planes.spec.ts`          | rojo   | P09, P08, P24 |
| P38                                                   | Detalle por correo, lado calculadora: `datosDelDetalle(entradas, config)` con la forma de `detalle-calculadora` (`notificaciones/entities/datos.ts:119-132`, resumen de 3 frases) y el formulario que manda a `/api/solicitudes`                                                     | `src/modules/calculadora/entities/`, `src/modules/calculadora/features/publica/`, `src/modules/calculadora/index.ts`, `src/modules/calculadora/CLAUDE.md` | rojo   | P37, P22, P24 |
| P39 (carril `ventas`, o sumado al `terminado` de P35) | `/api/solicitudes` acepta el origen `calculadora`, valida con `esquemaEntradasCalculadora`, recalcula en el servidor (R4.18), lee los datos del panel, crea o junta la solicitud y manda `detalle-calculadora`; e2e con Mailpit                                                      | `src/app/api/solicitudes/`, `src/modules/solicitudes/infra/`, `e2e/ventas/agenda/detalle-calculadora.spec.ts`                                             | rojo   | P35, P38      |

La dependencia P09 → P35 que propuso P11 pasa a ser P39 → P35.

## Decisiones no obvias

- **El e2e de P09 no abre ninguna página.** `e2e/calculadora/publica.spec.ts` lee `publico.config_calculadora()` como `anon` (`set role
anon` en la base local), pasa la fila por `leerFilaDeConfig`, `calcularFugas` y `resumenDeFugas`, y comprueba US$ 4.452,
  «US$ 4.452 – US$ 8.935» y «77 a 139». No escribe la fila, a propósito: prueba los valores iniciales de la migración. Si la fila cambió,
  falla con «la fila config_calculadora no tiene los valores iniciales: corre pnpm db:reset».
- **«Agendar demo» es un `<a>` y no `<Link>`.** Con `typedRoutes`, `href="/agendar?…"` no compila mientras no exista la ruta (P35/P36).
  Un cast a `Route` escondería lo mismo, así que se dejó el `<a>`. P37 lo cambia por `<Link>`.
- **`ETIQUETAS_DEL_FORMULARIO` vive en `entities/etiquetas.ts`**, no en el formulario. Así el correo de P38 usa los mismos textos que la
  pantalla (lo pidió la 2.ª ronda de auditoría del plan).
- **La expresión de X11 está copiada en tres pruebas de `calculadora`.** El lint no deja importar `planes/entities/x11.fixture.ts` desde
  otro módulo (`eslint.config.mjs:230-243`). Las dos fichas lo dicen: si cambia allá, se cambia en las tres.
- **Ningún texto dice «por auto».** `NOMBRA_EL_EXCESO` da positivo con «por auto» en cualquier texto. Por eso «Margen promedio de cada
  auto» y «Cada venta perdida te cuesta tu margen».
- **El selector Mensual / Anual vive en el estado del componente, no en la URL.** No filtra registros, y con `nuqs` la sección necesitaría
  `Suspense`: el HTML estático saldría sin tarjetas.
- **El desglose quedó en su propio componente** (`desglose-de-fugas.tsx`, que el plan no listaba). Después de Prettier, `ResultadoDeFugas`
  pasaba las 80 líneas por función.
- **Para que M14 cayera, la prueba de la sección pasa por incompleto y vuelve a listo.** Cambiar un dato con el resultado ya listo no
  vuelve a correr el efecto aunque falte la marca, así que esa prueba no detectaba la mutación.
- **La marca `@sin-celular-archivo` del spec no tiene efecto todavía.** `e2e/soporte/sin-celular.ts:230` sólo lee la raíz de `e2e/`, así
  que el spec corre también en `movil` (y pasa en los dos). La marca queda porque es la que pide `.claude/rules/e2e.md`.

## Microdecisiones

- **Textos.**
  - Resultado: «Llena los 5 datos para ver cuánto se te escapa.» y, con algún campo marcado, «Revisa los datos marcados para ver cuánto
    se te escapa.».
  - Etiquetas del resultado: «Estimación», «Se te escapan cada mes, como mínimo» y «Horas a mano al mes:». Columnas del desglose: «Fuga»,
    «Mínimo» y «Máximo».
  - Leyenda del selector: «Forma de pago» (oculta). Opción vacía del select: «Elige una opción». Título de la sección: «¿Cuánto se te
    escapa al mes?».
- **El rótulo «Ya funciona» y «Estimación»** van en el estilo etiqueta de §8: 12 px, mono, +0,06 em, y las mayúsculas por CSS.
- **El formulario no va en un bloque plegable:** es una sección pública de 5 campos, no un formulario del panel.
- **Montos en texto con `tabular-nums`** hasta que P24 traiga el componente de montos.
- **El desglose no lleva fila «Total»:** el titular y el rango ya la dicen.
- **`calesa:evento` lleva `detail: { tipo: 'calculadora_usada' }`**, para P17.
- **El encabezado de la tabla es pegajoso sólo desde `md`**, porque debajo la tabla tiene su propio `overflow-x`.
- **El cliente público es copia del de `equipo`:** no se puede importar de otro módulo, y el TODO de `base` sigue.

## Para el coordinador

- Sumar P37, P38 y P39 (o lo de P39 al `terminado` de P35). P22 y P24 siguen fuera de `plan.yaml`.
- `scripts/e2e-dirigidos.mjs:172-174` y `e2e/soporte/sin-celular.ts:230` no leen las subcarpetas de `e2e/`. Un spec en
  `e2e/calculadora/` nunca es dirigido y su marca sin celular no se aplica.
- Siguen pendientes de `base`:
  - el cliente de Supabase sin cookies;
  - `db:types` con el esquema `publico`;
  - Next 16.4.3: `next build` se corta la primera vez con `SecurityFatalError` y recomienda actualizar.
- **Términos para la próxima semilla:** «forma de pago» (Mensual / Anual), «Cómo se calculó» y «bloque de prueba».
