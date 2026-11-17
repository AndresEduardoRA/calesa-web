# calculadora

Las fórmulas de la calculadora «Lo que se te escapa al mes» (semilla §5.2) y de la gráfica «Crecer sin contratar» (§5.3): las entradas, los datos del panel, los supuestos fijos, los cálculos y los textos con cifras; la sección pública de la calculadora y el bloque de prueba de `/` (§6.2, secciones 4 y 5).

## Tablas

- `config_calculadora` (semilla §3 y §9.2): los datos del panel. Se lee como `anon` por `publico.config_calculadora()` (`infra/queries/config-publica.ts`), en `'use cache'` con la etiqueta `calculadora` (`ETIQUETA_DE_CONFIG`) y `cacheLife('hours')`, o `'minutes'` si falla. La respuesta va sin tipo y pasa por `leerFilaDeConfig()`. La escribe el panel (P21) por su RPC e invalida esa etiqueta.

## Entra y sale

- Entra: sólo `shared` (`lib/formato.ts`). `solicitudes` lo va a usar para el detalle por correo (§9.2).
- Sale, por `index.ts` (servidor): `esquemaEntradasCalculadora`, `esquemaConfigCalculadora`, `calcularFugas`, `resumenDeFugas`, `esquemaEntradasEscala`, `calcularEscala`, `textosDeEscala`, `TIEMPOS_DE_RESPUESTA`, `VOLATILIDADES`, `ETIQUETA_DE_CONFIG` y sus tipos.
- Sale, por `pantallas/inicio.ts` (sólo `src/app`): `SeccionCalculadora`, `BloqueDePrueba` y `leerConfigCalculadora`. P08 los usa en `/` así: un Server Component async dentro de `<Suspense fallback={null}>` que hace `<SeccionCalculadora config={await leerConfigCalculadora()} />` (como `equipo`). Los e2e de pantalla son de P37.
- Sale, por `client.ts`: sólo tipos (`EntradasCalculadora`, `TiempoRespuesta`, `ResultadoFugas`, `ResumenDeFugas`, `EntradasEscala`, `ResultadoEscala`, `TextosDeEscala`). La gráfica de escala, el componente, llega en su propio paso (P26, pedido al coordinador).

## Archivos clave

- `entities/rangos.ts` — `campoEntero()` y `campoMonto()`: un solo mensaje con el rango permitido; `cuandoPasaron()`, el `when` de las reglas cruzadas.
- `entities/entradas.ts` — los 5 datos del visitante (§5.2) y la regla «consultas ≥ autos».
- `entities/config.ts` — los datos del panel (`config_calculadora`), sin valores por defecto; `leerFilaDeConfig()` acepta sólo un arreglo de exactamente una fila válida (lo demás es `inesperado`).
- `entities/supuestos.ts` — los supuestos fijos de §5.2, literales, cada uno `[mínimo, máximo]`.
- `entities/calculadora.ts` — `calcularFugas()`: los pasos 1-7 de §5.2, sin redondear.
- `entities/resumen.ts` — `resumenDeFugas()`: titular, rango, horas y filas, ya formateados.
- `entities/escala.ts` — `esquemaEntradasEscala` (la meta no puede ser menor que hoy), `calcularEscala()` con `techo(x) = ceil(x − 1e-9)` y `textosDeEscala()`.
- `entities/ejemplos.fixture.ts` — los datos de los ejemplos 1-3 de §5.2, sólo para las pruebas.
- `entities/como-se-calculo.ts` — `comoSeCalculo(config)`: la entrada, una frase por fuga y los 9 datos del panel; `ETIQUETAS_DE_CONFIG` (P21 las reusa).
- `entities/etiquetas.ts` — `ETIQUETAS_DEL_FORMULARIO`: las 5 etiquetas y las 4 opciones de «¿Cuánto tardas…?» (P38 las usa en el correo).
- `entities/agendar.ts` — `enlaceParaAgendar()`: `/agendar?autos=…&adm=…` (recorrido 2).
- `entities/prueba.ts` — el rótulo y el texto exacto de A0.2.
- `infra/cliente-publico.ts` — el cliente `anon` sin cookies sobre `publico` (copia del de `equipo`; TODO de `base`).
- `features/publica/schemas/formulario.ts` — `entradasDelFormulario()`: del texto a las entradas; un campo vacío no da error.
- `features/publica/components/calculadora-publica.tsx` — la calculadora (Client Component): formulario, resultado, desglose, «Cómo se calculó» y el evento `calesa:evento` (`hooks/use-evento-del-primer-resultado.ts`).

## No se rompe

- Las fórmulas y los supuestos son literales de la semilla (§5.2 y §5.3): sus pruebas usan exactamente los ejemplos 1, 2 y 3 y los casos A-E.
- Se redondea sólo al final, y sólo en `resumen.ts` (X3). `calcularFugas()` no redondea.
- Una regla cruzada corre aunque otro campo haya fallado, pero no si uno de sus campos falló (`cuandoPasaron`).
- Los datos del panel salen de la base: aquí no hay valores por defecto.
- Ningún texto de la calculadora nombra el exceso de autos (X11): «Margen promedio de cada auto» y «tu margen», nunca «por auto».
- Con los datos del panel en fallo, la calculadora dice «No pudimos calcular. Revisa los datos.» y no muestra cifras ni «Cómo se calculó».
- `calesa:evento` sale una sola vez por carga, con `{ tipo: 'calculadora_usada' }` y nada del visitante (X7).

## Ojo

- Los textos con dinero y las fórmulas son de riesgo rojo: un cambio pide su prueba con el ejemplo de la semilla y su mutación.
- `client.ts` lleva sólo tipos: las funciones viajan por `index.ts`; los componentes, por `pantallas/`.
- `NOMBRA_EL_EXCESO` (de `planes/entities/x11.fixture.ts`) está copiada en `entities/como-se-calculo.test.ts`, `entities/etiquetas.test.ts` y `features/publica/components/calculadora-publica.test.tsx`: el lint no deja importarla de otro módulo. Si cambia allá, se cambia en las tres.
- «Agendar demo» es un `<a>` y no `<Link>`: con `typedRoutes`, `/agendar` no compila hasta que exista la ruta (P35/P36).
