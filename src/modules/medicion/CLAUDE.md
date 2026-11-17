# medicion

Eventos, métricas, embudo, cupos gratis y latidos (semilla §9.2; F8, X7, R4.4, R4.22, R5.2): el esquema de los eventos públicos, el enlace de WhatsApp y el destino cuando no hay nadie, el embudo del mes, los cupos y el estado de la tarea diaria. Las rutas de WhatsApp y de eventos son de P34.

## Tablas

- Lee `metricas_diarias`, `metricas_persona` y `latidos` con la sesión de quien mira (`createClient()`), bajo la RLS: `metricas.ver` (vendedor `propio`, admin `todos`) y `actividad.ver` (sólo el admin).
- No escribe nada. `eventos` y `limites` los escriben las RPC de P31 y P32; las métricas, sus triggers (P31); `latidos`, la tarea diaria (P13).

## Entra y sale

- Entra: sólo `shared` (`lib/fechas`, `lib/errores`, `lib/supabase/server`, `types`). No depende de ningún módulo.
- Sale, por `index.ts` (servidor): `esquemaEventoPublico`, `paginaDelEvento`, `TIPOS_DE_EVENTO_PUBLICOS`, `enlaceDeWhatsApp`, `MENSAJE_DE_WHATSAPP`, `RUTA_SIN_WHATSAPP`, `leerEmbudoDelMes`, `fuenteDelEmbudo`, `evaluarCupos`, `textoDelAvisoDeCupo`, `leerLatidoDiario`, `estadoDeTarea` y sus tipos.
- Sin `client.ts` (nada viaja al navegador), `pantallas/` ni `shell.ts`: nada se dibuja aquí. El resumen y los banners del panel son de `acceso` (P14).

## Archivos clave

- `entities/eventos.ts` — `paginaDelEvento` (sólo la ruta, sin consulta ni fragmento) y `esquemaEventoPublico` (estricto: sólo `clic_agendar` y `calculadora_usada`, `pagina` y los cinco `utm_*`).
- `entities/whatsapp.ts` — el mensaje de D3, `enlaceDeWhatsApp` (E.164 → `wa.me`, o `null`) y `RUTA_SIN_WHATSAPP` (R4.10).
- `entities/embudo.ts` — `mesEnZona`, `rangoDelMes`, las sumas del equipo y propia, y `fuenteDelEmbudo` (qué tabla lee cada alcance).
- `entities/cupos.ts` — los umbrales de R5.2 y `evaluarCupos` (más del 80 %: `>`).
- `entities/latidos.ts` — `estadoDeTarea`: detenida si pasaron más de 26 h desde el último éxito o, sin éxito, desde que se creó la fila.
- `infra/queries/embudo.ts` y `latido.ts` — las dos lecturas del panel, de a lo sumo 31 filas y una fila.

## No se rompe

- Un evento público nunca lleva datos personales: ni correo, ni ids, ni la consulta de la URL (X7). El número de WhatsApp sólo existe en el enlace de salida; nunca se registra.
- El embudo sale de `metricas_*` (≤ 31 filas por mes), nunca de contar `eventos`.
- Las lecturas no usan el cliente admin: un vendedor que pide el embudo del equipo recibe ceros (0 filas), no datos ajenos.
- Un fallo de lectura se devuelve como valor (`Resultado`) con un `console.error` con el código, sin filas.

## Ojo

- La parte de P12 es el módulo. Faltan, y no son de este paso: `elegir_whatsapp`, `registrar_evento` y los triggers de métricas (P31, `datos`), `contar_envio` (P32), el contador sobre Supabase (P33, `base`) y las rutas `GET /api/whatsapp` y `POST /api/eventos` con su e2e (P34).
- Sin fila en `latidos` no hay banner de tarea detenida: el despliegue (P13/`datos`) debe crear la fila `diario`, o «la tarea nunca corrió» no se avisa.
- Dónde se guarda el resultado de los cupos para que el panel lo muestre no lo define la semilla: lo decide P13.
