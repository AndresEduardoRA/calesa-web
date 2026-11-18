# medicion

Eventos, métricas, embudo, cupos gratis y latidos (semilla §9.2; F8, X7, R4.4, R4.22, R5.2): el esquema de los eventos públicos, el enlace de WhatsApp y el destino cuando no hay nadie, el embudo del mes, los cupos, el estado de la tarea diaria y la tarea diaria misma, por puertos. Las rutas de WhatsApp y de eventos son de P37.

## Tablas

- Lee `metricas_diarias`, `metricas_persona` y `latidos` con la sesión de quien mira (`createClient()`), bajo la RLS: `metricas.ver` (vendedor `propio`, admin `todos`) y `actividad.ver` (sólo el admin).
- No escribe nada por sí mismo. `eventos` y `limites` los escriben las RPC de P31 y P32; las métricas, sus triggers (P31).
- `correrTareaDiaria` no toca la base: recibe sus puertos (`retencion`, `ponerAlDiaLosCorreos`, `medirCupos`, `registrarLatido`), que arma la ruta del cron (P42) sobre `retencion_diaria`, las RPC de P40 y el notificador de P41. Así escribe `latidos`.

## Entra y sale

- Entra: sólo `shared` (`lib/fechas`, `lib/errores`, `lib/supabase/server`, `types`). No depende de ningún módulo.
- Sale, por `index.ts` (servidor): `esquemaEventoPublico`, `paginaDelEvento`, `TIPOS_DE_EVENTO_PUBLICOS`, `enlaceDeWhatsApp`, `MENSAJE_DE_WHATSAPP`, `RUTA_SIN_WHATSAPP`, `leerEmbudoDelMes`, `fuenteDelEmbudo`, `evaluarCupos`, `textoDelAvisoDeCupo`, `leerLatidoDiario`, `estadoDeTarea`, `correrTareaDiaria`, `VUELTAS_DE_RETENCION` y sus tipos (`PuertosDeLaTarea`, `LatidoNuevo`, `ResumenDeLaTarea`, `Conteos`).
- Sin `client.ts` (nada viaja al navegador), `pantallas/` ni `shell.ts`: nada se dibuja aquí. El resumen y los banners del panel son de `acceso` (P14).

## Archivos clave

- `entities/eventos.ts` — `paginaDelEvento` (sólo la ruta, sin consulta, fragmento ni token de reunión) y `esquemaEventoPublico` (estricto: sólo `clic_agendar` y `calculadora_usada`, `pagina` y los cinco `utm_*`).
- `entities/whatsapp.ts` — el mensaje de D3, `enlaceDeWhatsApp` (E.164 → `wa.me`, o `null`) y `RUTA_SIN_WHATSAPP` (R4.10).
- `entities/embudo.ts` — `mesEnZona`, `rangoDelMes`, las sumas del equipo y propia, y `fuenteDelEmbudo` (qué tabla lee cada alcance).
- `entities/cupos.ts` — los umbrales de R5.2 y `evaluarCupos` (más del 80 %: `>`).
- `entities/latidos.ts` — `estadoDeTarea`: detenida si pasaron más de 26 h desde el último éxito o, sin éxito, desde que se creó la fila.
- `infra/queries/embudo.ts` y `latido.ts` — las dos lecturas del panel, de a lo sumo 31 filas y una fila.
- `entities/tarea-diaria.ts` — los puertos, el resumen y `armarErrorDelLatido` («<paso>: <codigo>», nunca el mensaje).
- `infra/tarea-diaria.ts` — `correrTareaDiaria`: retención (hasta 5 vueltas mientras `quedanMas`) → correos → cupos, sin que un fallo detenga a los demás, y un solo latido al final.

## No se rompe

- Un evento público nunca lleva datos personales: ni correo, ni ids, ni la consulta de la URL, ni el token de `/reunion/<token>` (se guarda `/reunion`) (X7). El número de WhatsApp sólo existe en el enlace de salida; nunca se registra.
- El embudo sale de `metricas_*` (≤ 31 filas por mes), nunca de contar `eventos`.
- Las lecturas no usan el cliente admin: un vendedor que pide el embudo del equipo recibe ceros (0 filas), no datos ajenos.
- Un fallo de lectura se devuelve como valor (`Resultado`) con un `console.error` con el código, sin filas.
- La tarea diaria: un paso que falla o lanza no detiene a los demás; el latido y los logs llevan el paso y el código, nunca el mensaje; si medir los cupos falla, van `null` («no medido»), nunca `[]`, que borraría un aviso vigente.

## Ojo

- Las rutas `GET /api/whatsapp` y `POST /api/eventos` con su e2e son de P37.
- Sin fila en `latidos` no hay banner de tarea detenida: la fila `diario` la crea P40 en su migración (con el upsert de `supabase/semillas/pruebas.sql`), o «la tarea nunca corrió» no se avisa.
- Dónde se guardan los cupos lo decide P40 (la recomendación es una columna `latidos.cupos`); sumarlos a `leerLatidoDiario` y `EstadoDeTarea` es de P42.
