# P27 · Decisiones

Las RPC del registro de correos (`correos_salientes`, X6). Es de riesgo rojo y pasó por una compuerta `datos`. El plan auditado tuvo dos
rondas: las dos dejaron observaciones, ninguna bloqueó, y todas se resolvieron. Lo aprobó `PILOTO_AUTO`.

## Autoelección (2026-11-17)

Tal cual la anotó el bucle (`hechos.json` › `autoelecciones`):

- 2026-11-17T14:44:54-04:00 · P27 · compuerta datos contestada sola (PILOTO_AUTO): aprobar

Con eso rige la recomendada de la única pregunta del plan:

- **P1 · Las `marcar_*` no llevan `p_actualizado_en_esperado`.** La guarda es la tabla de transiciones: la fila se toma `for update` y
  se valida su estado actual (`_tomar_correo`). `correos_salientes` no tiene `actualizado_en`, el contrato de P07 (`RegistroDeCorreos`)
  no trae versión y nadie edita un correo a mano: escriben el envío, el despacho y, más adelante, el webhook. Un cambio que llega tarde
  choca con la tabla (`P0001`) y no pisa nada en silencio. **Se aparta a propósito de `docs/semilla/semilla.md:296`** («las de edición
  llevan `p_actualizado_en_esperado` y responden `PT409`») y de `.claude/rules/migraciones.md`. Para la próxima semilla, en §3 l. 296:
  «las RPC del registro de correos se guardan por transición de estado, sin versión». Se revierte con una migración que sume el
  parámetro.

## Decisiones no obvias (2026-11-17)

- **Nueve RPC en tres migraciones** (`calesa_registrar_correos`, `calesa_correos_vencidos`, `calesa_marcar_correos`), todas `security
definer`, `set search_path = ''`, `revoke all … from public, anon, authenticated` y `grant execute … to service_role`. Los tres
  ayudantes (`_correo_json`, `_correo_invalido`, `_tomar_correo`) no son de definidor y tampoco los ejecutan `anon` ni `authenticated`.
- **La respuesta es la fila con las 14 claves de `FilaDeCorreo`**, en camelCase y sin `creadoEn`, y las fechas en ISO con zona
  (`_correo_json`, `stable` porque `to_jsonb(timestamptz)` depende de `TimeZone`).
- **Sin fila, `null` y no un error.** `P0002` caería en `inesperado` (`src/shared/lib/errores.ts`); con `null`, P29 da `no_encontrado`.
  Vale para `correo_por_referencia`, `correo_por_id` y las cuatro `marcar_*`.
- **Errores:** `22023` «Un dato del correo no es válido.» con el parámetro en `hint`; `23505` «Ya existe un correo con esa referencia.»
  (hint `p_referencia`), que P29 lee como `duplicado`; `P0001` «Un correo <estado> no pasa a <destino>.». Nunca `40001` ni `PT409`.
- **La tabla de transiciones:** desde `programado` o `fallido`, las cuatro marcas; `enviado` es terminal; `cancelado` sólo vuelve a
  cancelarse, sin cambios ni error (dos cancelaciones a la vez no fallan): sobre un `cancelado`, `marcar_correo_cancelado` devuelve la
  fila sin hacer `update` (el plan decía «hace un `update`» en todas; la conducta es la misma y no escribe de balde). `fallido →
cancelado` no lo usa P07, pero se permite para que un fallido de una reunión cancelada deje de reintentarse.
- **`marcar_correo_reprogramado` lleva `p_cambiar_resend_id`** para distinguir el `undefined` del `null` del contrato: sin la bandera
  `resend_id` queda como estaba; con `true` se pisa con `p_resend_id`, aunque sea nulo. Un `p_resend_id` sin la bandera da `22023`
  (`hint p_resend_id`): un id de Resend no se descarta en silencio.
- **`registrar_correo` no acepta `cancelado`** (P07 registra después de mandar) y exige el campo de cada estado: `programado` su hora,
  `enviado` su `enviado_en`, `fallido` su error.
- **`para` admite varios destinatarios separados por coma**, cada uno con la regla de email de P02
  (`20261117024000_calesa_tablas_panel.sql:55`), porque `nucleo.ts` de P07 los une así. De 3 a 1000 caracteres.
- **El error del proveedor se corta a 1000 caracteres** al registrar y al marcar fallido: registrar un fallo no puede fallar por un
  mensaje largo.
- **La referencia, hasta 256** (el tope de `src/shared/lib/email/tipos.ts`). Dos filas sin referencia conviven.
- **La base no valida la plantilla** (el catálogo vive en TypeScript, P07) ni que la reunión o la solicitud existan (sin FK, a propósito
  desde P02).
- **`correos_vencidos` recibe la hora** (`p_ahora`): ninguna RPC de P27 lee `now()`, así que a P38 no le queda nada que pasar a
  `_ahora()` aquí. Tampoco `marcar_correo_reprogramado` compara la hora con `now()`: con el reloj fijo de las e2e, la hora de la app no
  es la de la base; «no programar en el pasado» es de P07.
- **Índice nuevo `correos_salientes_vencidos (programado_para, id) where estado = 'programado' and resend_id is null`.** El plan
  genérico de la consulta de vencidos, con 20 000 filas, lo usa sin `Seq Scan` ni `Sort`. PGlite acepta `explain (generic_plan)`, así
  que no hizo falta el respaldo con literales.
- **Las dos listas ordenan antes de cortar y agregan en el mismo orden**
  (`jsonb_agg(… order by …)` sobre un subselect con `order by … limit`). Con `_acotar_pagina(p_tope, 50, 100)`.
- **M32 la atrapa la forma, no la conducta.** Quitar el `order by` del subselect de vencidos no cambia el resultado con pocas filas: el
  plan recorre el índice parcial, que ya sale ordenado. La atrapa la prueba de forma del bloque de volumen (`prosrc` con
  `order by c.programado_para, c.id limit`).
- **`_correo_json` aparece en `database.types.ts` como campo calculado de `correos_salientes`** (`ComputedFields: '_correo_json'`):
  PostgREST trata así toda función de `public` que recibe la fila de una tabla. Sin efecto: nadie lo selecciona, `select('*')` no lo
  trae y sólo `service_role` puede ejecutarlo.
- **No se prueban carreras**: PGlite es una sola conexión y el kit no tiene `db:carreras`. La serialización la da el `for update` de
  `_tomar_correo`, y una prueba de forma lo fija.

## Avisos para otros pasos

- **P29 (carril `notificaciones`)** · el mapeo del contrato:
  - un argumento opcional nulo se omite (los tipos generados no admiten `null`: `p_x?: string`);
  - `marcarReprogramado(id, hora)` → sin `p_resend_id` ni `p_cambiar_resend_id`; `(id, hora, null)` → `p_cambiar_resend_id: true`;
    `(id, hora, 're_…')` → los dos;
  - `null` → `no_encontrado`; `23505` → `duplicado`; `22023` y `P0001` → `regla` (`errorDePostgrest`);
  - validar la respuesta con Zod: las 14 claves y fechas ISO con zona.
- **P29 y P13:** `cancelarFilas` y `programadosDe` ignoran los `fallido`. Un fallido de una reunión que se cancela, con su hora por
  delante, lo vuelve a programar `reintentar`. La base ya admite `fallido → cancelado`; falta quien lo use.
- **P15:** la fila `cancelar:<resend_id>` que propuso P30 entra por `registrar_correo` con `p_estado = 'fallido'`, un `p_para` válido sin
  datos de la persona (por ejemplo, el de `EMAIL_AVISOS`) y `p_ultimo_error`. Ojo: como `fallido` con una plantilla fuera del catálogo,
  la tomarían `reintentar` y `reenviar` de P07 (la marcarían `fallido` otra vez al no poder armarla) y la contaría el banner de fallidos
  (§6.5). P15 y P40 deben acordar cómo se distingue (por ejemplo, el prefijo `cancelar:` en la referencia) antes de usarla.
- **P38:** ninguna RPC de P27 lee `now()`; sólo el `default` de `creado_en`.
- **Al coordinador · paso propuesto (id sugerido P40) · «RPC de correos para el webhook y la tarea diaria»** · `carril: datos` ·
  `riesgo: rojo` · `modulos: [supabase/, src/shared/types/]` · `depende_de: [P27]` · terminado: `correo_por_resend_id` con su índice
  `(resend_id) where resend_id is not null`; las marcas del webhook (R5.3: entregado, rebotado y fallido, desde `programado` y desde
  `enviado`); `correos_fallidos(p_tope)` para el reintento diario (§9 l. 953) con su índice `(creado_en, id) where estado = 'fallido'`;
  sólo `service_role`; pruebas en `supabase/tests/`; tipos regenerados. P13 suma P40 a su `depende_de`, y también P29 si escribe el
  registro. Nada de esto estaba en el `terminado` de P27, y P13 (carril `tareas`) no tiene `supabase/` en sus `modulos`.
