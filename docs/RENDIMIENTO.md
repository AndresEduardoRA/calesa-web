# Escala y rendimiento

> Generado desde `docs/semilla/semilla.md` (versión 7). No se edita a mano: el cambio va en la semilla, que sube de versión.

Es el contenido de `docs/RENDIMIENTO.md` (lo genera `semilla-a-repo`). Rige además la regla `escala.md` del kit.

- **Toda lista del panel** (solicitudes, reuniones, notas, enlaces, equipo, usuarios, auditoría, correos) usa paginación por cursor `(creado_en, id)` descendente (reuniones próximas: `(inicio, id)` ascendente). Tamaño de página y tope de lo cargado: los de `src/shared/lib/paginacion.ts` del kit (`tamanoDePagina()`, `TOPE_DE_LO_CARGADO`), con keyset `leerCursor()`/`armarPagina()`; al llegar al tope se muestra «Mostrando las más recientes. Filtra para ver más.» Números en pantalla con `conteo.ts` del kit (`conteoAcotado()`).
- **Sin conteos exactos para mostrar**: el embudo y los números del resumen salen de `metricas_diarias` o `metricas_persona` (≤ 31 filas por mes). Las listas no muestran total. El banner de correos fallidos cuenta con `limit 10`.
- **Índices** que sostienen cada consulta: los de §3. Búsqueda por email exacto (índice), no por texto libre.
- **Horas disponibles**: una consulta por persona elegible acotada a `[ahora, ahora + horizonte]` usando `reuniones(anfitrion_id, inicio)` y el índice gist de bloqueos; respuesta ≤ 20 KB.
- **Volumen de prueba**: la semilla de rendimiento crea 30.000 solicitudes, 20.000 reuniones, 60.000 notas y 100.000 eventos en el proyecto de pruebas; las pruebas de rendimiento exigen que cada lista responda en < 300 ms en el servidor.
- **Presupuesto por pantalla**: `/` ≤ 170 KB de JavaScript comprimido, LCP ≤ 2,5 s en 4G lenta (Lighthouse móvil ≥ 90 en rendimiento y 100 en accesibilidad); `/agendar` ≤ 4 peticiones al cargar; cada página del panel ≤ 3 peticiones al cargar y ≤ 60 KB de datos.
- Páginas públicas estáticas con revalidación de 1 h (y revalidación inmediata al guardar equipo o datos de la calculadora). Imágenes con `next/image`, AVIF/WebP. Video con `preload="none"` y póster.
