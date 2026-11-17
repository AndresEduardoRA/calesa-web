# Decisiones · P12 · Medición

## 2026-11-17 · P1 · se parte el paso (compuerta `afuera`)

Respuesta de la persona, tal cual: «aprobar partir (Recommended)».

- P12 queda con el módulo `medicion`: esquema de eventos públicos, enlace de WhatsApp y destino sin nadie, embudo, cupos, latidos y su ficha.
- `GET /api/whatsapp`, `POST /api/eventos` y `e2e/tareas/whatsapp.spec.ts` pasan a **P34** (carril `tareas`, ámbar), con `depende_de: [P12, P31, P33]`. Faltan en la base `elegir_whatsapp`, `registrar_evento` y los triggers de métricas (P31), `contar_envio` (P32) y el contador sobre Supabase (P33), y `plan.yaml` no los tiene.
- Para el coordinador: P12 con `depende_de: [P05, P06]`, `modulos: [src/modules/medicion/]`, comando `pnpm lint && pnpm typecheck && pnpm test && bash scripts/mapa.sh --check` y un `terminado` sin las rutas ni el e2e; P17 suma P34 a su `depende_de` (su e2e comprueba que el clic queda guardado).
- Lo que P34 decide con P31: si `elegir_whatsapp` registra el clic en la misma transacción (así dos clics a la vez no eligen igual) o lo registra la ruta.

## 2026-11-17 · P2 · banner de tarea detenida sin latido (autoelegida: la recomendada del plan)

- Sin fila en `latidos` no hay banner (`desde = null`): no hay de dónde contar.
- Con la fila y `ultimo_ok` nulo, está detenida sólo si pasaron más de 26 h desde `creado_en` (R4.22 dice «en 26 h»); `desde = creado_en`. Justo 26 h no.
- Pendiente para P13/`datos`: crear la fila `latidos('diario')` al desplegar, o «la tarea nunca corrió» no se avisa.

## 2026-11-17 · P3 · texto del aviso de cupos (autoelegida: la recomendada del plan)

«Te acercas al límite gratis de la base de datos.» y «Te acercas al límite gratis de correos.». Es una constante en `entities/cupos.ts`.

## 2026-11-17 · Otras decisiones no obvias

- Umbral de base: 400 000 000 bytes (decimales, no 400 MiB): avisa un poco antes. «Más del 80 %» es `>`: en el umbral justo no avisa (R5.2).
- `paginaDelEvento` corta en el primer `?` o `#`: nunca se guarda una consulta (X7). Y `/reunion/<token>` se guarda como `/reunion`: el token da acceso a la reunión de una solicitud (lo vio el auditor del informe; el plan no lo cubría). El esquema de `POST /api/eventos` es estricto: una clave de más (`email`, `solicitud_id`, `perfil_id`) hace fallar todo.
- Sin `client.ts`: la semilla no hace depender `sitio` de `medicion` y el oyente de P17 sólo lee atributos `data-evento`; si P17 lo necesita, lo pide.
- `leerEmbudoDelMes` corre con la sesión de quien mira: un vendedor que pide el embudo del equipo recibe ceros por la RLS, no datos ajenos. `fuenteDelEmbudo` sólo elige la tabla.
- Pendiente para P13: dónde se guarda el resultado de los cupos para que el panel lo muestre; la semilla no lo define.
- Términos para la próxima versión de la semilla (`GLOSARIO.md` se genera de ella y no se toca): **latido**, **cupos gratis**, **evento público**.
