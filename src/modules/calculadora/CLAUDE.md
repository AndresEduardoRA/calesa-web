# calculadora

Las fórmulas de la calculadora «Lo que se te escapa al mes» (semilla §5.2) y de la gráfica «Crecer sin contratar» (§5.3): las entradas, los datos del panel, los supuestos fijos, los cálculos y los textos con cifras.

## Tablas

- `config_calculadora` (semilla §3 y §9.2): los datos del panel. La leerá `infra/` (P09); `entities/config.ts` valida su fila con las mismas claves. Este módulo todavía no la lee.

## Entra y sale

- Entra: sólo `shared` (`lib/formato.ts`). `solicitudes` lo va a usar para el detalle por correo (§9.2).
- Sale, por `index.ts` (servidor): `esquemaEntradasCalculadora`, `esquemaConfigCalculadora`, `calcularFugas`, `resumenDeFugas`, `esquemaEntradasEscala`, `calcularEscala`, `textosDeEscala`, `TIEMPOS_DE_RESPUESTA`, `VOLATILIDADES` y sus tipos.
- Sale, por `client.ts`: sólo tipos (`EntradasCalculadora`, `TiempoRespuesta`, `ResultadoFugas`, `ResumenDeFugas`, `EntradasEscala`, `ResultadoEscala`, `TextosDeEscala`). La gráfica de escala, el componente, llega en su propio paso (P26, pedido al coordinador).

## Archivos clave

- `entities/rangos.ts` — `campoEntero()` y `campoMonto()`: un solo mensaje con el rango permitido; `cuandoPasaron()`, el `when` de las reglas cruzadas.
- `entities/entradas.ts` — los 5 datos del visitante (§5.2) y la regla «consultas ≥ autos».
- `entities/config.ts` — los datos del panel (`config_calculadora`), sin valores por defecto.
- `entities/supuestos.ts` — los supuestos fijos de §5.2, literales, cada uno `[mínimo, máximo]`.
- `entities/calculadora.ts` — `calcularFugas()`: los pasos 1-7 de §5.2, sin redondear.
- `entities/resumen.ts` — `resumenDeFugas()`: titular, rango, horas y filas, ya formateados.
- `entities/escala.ts` — `esquemaEntradasEscala` (la meta no puede ser menor que hoy), `calcularEscala()` con `techo(x) = ceil(x − 1e-9)` y `textosDeEscala()`.
- `entities/ejemplos.fixture.ts` — los datos de los ejemplos 1-3 de §5.2, sólo para las pruebas.

## No se rompe

- Las fórmulas y los supuestos son literales de la semilla (§5.2 y §5.3): sus pruebas usan exactamente los ejemplos 1, 2 y 3 y los casos A-E.
- Se redondea sólo al final, y sólo en `resumen.ts` (X3). `calcularFugas()` no redondea.
- Una regla cruzada corre aunque otro campo haya fallado, pero no si uno de sus campos falló (`cuandoPasaron`).
- Los datos del panel salen de la base: aquí no hay valores por defecto.

## Ojo

- Los textos con dinero y las fórmulas son de riesgo rojo: un cambio pide su prueba con el ejemplo de la semilla y su mutación.
- `client.ts` lleva sólo tipos: las funciones viajan por `index.ts`.
