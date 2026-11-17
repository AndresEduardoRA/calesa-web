# P31 · Decisiones

Las RPC del Meet, del WhatsApp, de los eventos y de la configuración de la calculadora, y los triggers de métricas. Es de riesgo rojo y
pasó por una compuerta `datos`. El plan auditado tuvo dos rondas: la 1.ª bloqueó (el nivel 2 sin el e2e completo) y dejó diez
observaciones; la 2.ª dejó dos observaciones sobre P7. Todas se resolvieron. Lo aprobó `PILOTO_AUTO`.

## Autoelección (2026-11-17)

Tal cual la anotó el bucle (`hechos.json` › `autoelecciones`):

- 2026-11-17T15:52:02-04:00 · P31 · compuerta datos contestada sola (PILOTO_AUTO): aprobar

Con eso rigen las recomendadas de las once preguntas del plan. Las de datos (P1–P3, P5, P9, P10) y las que rozan producto (P4, P6–P8,
P11) se decidieron en la misma compuerta (`PILOTO_AUTO` cubre las dos clases):

- **P1 · Quién ejecuta cada RPC.** `actualizar_meet` y `guardar_config_calculadora`, sólo `authenticated`; también se les quita EXECUTE
  a `service_role`, como en P05/P1. `actualizar_meet` actúa sólo sobre el perfil de quien llama si está activo, sin clave nueva.
  `guardar_config_calculadora` pide `calculadora.configurar` con alcance `todos`: sólo el admin, y la clave nace en su migración.
  `elegir_whatsapp` y `registrar_evento`, sólo `service_role`. **Se aparta a propósito de §4 l. 360** en `actualizar_meet`, por las
  mismas razones que P30/P1: la persona la llama desde `/panel/perfil` con su sesión, y sin sesión no hay cuyo Meet cambiar.
- **P2 · El Meet sólo por RPC.** `revoke update (enlace_meet) on perfiles from authenticated`. Nombre y WhatsApp siguen directos
  (fila 23). `_proteger_perfiles` no cambia: queda de red. Cambia la forma de §3 l. 282, no quién: la persona sigue cambiando su Meet.
- **P3 · `elegir_whatsapp` registra el clic** en la misma transacción, bajo el candado `calesa:whatsapp`. Sin nadie disponible, el
  clic queda igual con `perfil_id` null y la RPC devuelve null.
- **P4 · `registrar_evento` acepta todo tipo menos `clic_whatsapp`.** Los demás eventos (`formulario_enviado`,
  `detalle_calculadora`, `reunion_*`) los escribe el servidor de cada caso con esta RPC; las RPC de P05 y P30 no se tocan.
- **P5 · Las demos al cambiar el Meet.** Cambian las `confirmada` de esa persona con `inicio` futuro, que además suben
  `secuencia_ics` en 1. La RPC devuelve el resumen de cada una (`_resumen_reunion`). Con el mismo enlace no escribe nada y devuelve
  `reuniones: []`.
- **P6 · Qué día cuenta cada métrica:** el día local de `config_agenda.zona_horaria` (America/La_Paz).
  - `solicitudes` y `solicitudes_asignadas`, por el `creado_en` de la solicitud.
  - `reuniones_reservadas`, por el `creado_en` de la reunión.
  - `reuniones_realizadas`, por el `inicio` de la demo.
  - `ganadas`, por el momento en que pasa a `ganada`.
  - `clics_whatsapp` y `calculadoras`, por los eventos `clic_whatsapp` y `calculadora_usada`. `detalle_calculadora` no cuenta: es
    una solicitud y ya cuenta allí.
- **P7 · Una reasignación** mueve `solicitudes_asignadas` (cambio de `asignado_a`) y `reuniones_reservadas` (cambio de
  `anfitrion_id`) en el día original de la fila. `reuniones_realizadas` y `ganadas` quedan con quien estaba al marcarlas.
- **P8 · Nada resta.** Borrar una solicitud (a pedido o por retención), cancelar una demo, pasar de `realizada` a `descartada` o
  borrar eventos por retención no baja ningún contador. No hay relleno: los contadores empiezan en la migración.
- **P9 · La hora es `now()`** en `actualizar_meet` (para decidir qué es «futura»), en `elegir_whatsapp` (la semana) y en el trigger de
  `ganadas`. P38 la pasa a `_ahora()`.
- **P10 · La auditoría `config`** lleva `registro_id` = uuid nulo y `tabla` = la configuración. El mismo trigger está en
  `config_calculadora` y en `config_agenda`. `horario_base` lo decide P34.
- **P11 · El Meet no se vacía.** `actualizar_meet(null, …)` da `22023`, con hint `p_enlace_meet`. El turno, ser anfitrión y el alta lo
  exigen, y una demo no puede quedar sin enlace. Es más restrictiva que antes: hasta ahora quien no estaba en turno podía vaciarlo con
  un `update` directo.

## Lo no obvio (2026-11-17)

- **Orden de bloqueo de las métricas.** En cada trigger se toma primero la fila de `metricas_diarias` y después las de
  `metricas_persona`; si son dos, en orden de `perfil_id`. La fila diaria del día queda tomada hasta el commit, así que
  `crear_o_juntar_solicitud`, `reservar_reunion`, `elegir_whatsapp`, `registrar_evento` y `cambiar_estado_solicitud` del mismo día
  van en serie entre sí; con el volumen de una empresa no se nota. Los caminos que tocan varias filas de persona (reasignar,
  desactivar, el reparto) ya van en serie por el candado de agenda o el de solicitudes. Quien sume un trigger de métricas sigue el
  mismo orden: invertirlo puede dar `40P01`.
- **El costo de P7a.** En el embudo por persona (R4.4, `/panel`) puede verse una `ganada` sin su solicitud asignada: pasa cuando
  alguien cerró una venta y después le reasignaron la ficha. Quien la recibe ve la solicitud, pero no la `ganada`. En un mes, la
  conversión de quien cerró puede pasar del 100 %. Sólo toca métricas. Si después se elige la opción c, lo atribuido se recalcula
  desde la auditoría.
- **`actualizar_meet` toma el candado de agenda antes que el perfil.** `reservar_reunion` copia el Meet del perfil bajo ese candado;
  sin él, una reserva simultánea podría quedar con el enlace viejo. El perfil se bloquea con `for no key update`, como en
  `desactivar_usuario`.
- **El hint de un check es el nombre de la restricción** (`config_calculadora_precio_check`, `eventos_pagina_check`), igual que
  `crear_o_juntar_solicitud`: en un `check_violation`, `column_name` viene vacío. No hay traducción a columna. Un parámetro que falta
  lleva su nombre (`p_tasa`, `p_tipo`).
- **Errores nuevos de `_fallar`:** E18 «Los datos de la calculadora cambiaron mientras los mirabas. Recarga para ver lo último.» y
  E19 «Tu perfil cambió mientras lo mirabas. Recarga para ver lo último.», los dos `PT409`.
- **La auditoría `config` guarda sólo lo que cambió**, sin `actualizado_en`, `creado_en` ni `actualizado_por`. Guardar los mismos
  datos mueve la versión pero no audita.
- **Los ayudantes de métricas son de invocador** (`_dia_local`, `_sumar_diaria`, `_sumar_persona`). Los llaman los triggers, que son
  de definidor (las métricas no tienen grant de escritura), así que corren como su dueño. Nadie del API los ejecuta. La columna se
  valida contra una lista cerrada antes del `format('%I')`.
- **`database.types.ts` lista también `_dia_local`, `_sumar_diaria` y `_sumar_persona`**, como ya listaba los ayudantes de P05 y P30:
  `db:types` lee todo `public`.
- **Los ayudantes de `metricas.sql`** (`pruebas.metrica`, `pruebas.solicitud_del`) se definen en el primer bloque del archivo y no se
  deshacen. La semilla de pruebas ya tiene 296 líneas y no les cabían. Viven en el esquema `pruebas`, sin acceso para `anon` ni
  `authenticated`. Cuando se corre `metricas.sql` contra la base local, quedan allí y suman dos avisos
  `function_search_path_mutable` al splinter (son del esquema `pruebas`, como los otros 8).
- **Un cambio de anfitrión mueve `reuniones_reservadas` sin mirar el estado de la reunión**, fiel a C19. Hoy toda reunión nace
  `confirmada` (`reservar_reunion`) y cuenta al nacer, así que no hay desbalance. Quien sume otro camino de inserción con otro estado
  tiene que contarla al nacer o acotar el traspaso: si no, el cambio restaría al anfitrión anterior una reserva que nunca sumó (lo
  señaló la auditoría del informe).

## Para los pasos que siguen

- **Próxima semilla:**
  - §4 l. 360: sacar `actualizar_meet` de las funciones de `service_role`, porque pasa a `authenticated` sobre la fila propia.
    `elegir_whatsapp` sigue allí.
  - §3 l. 282: el Meet se cambia por RPC y no se vacía (P11a).
  - §3 l. 258: «resta y suma» sólo en `solicitudes_asignadas` y `reuniones_reservadas` (P7a).
  - §9 l. 938: quién escribe cada tipo de evento (P4a).
- **P14 (`/panel/perfil`):**
  - `actualizar_meet(p_enlace_meet, p_actualizado_en_esperado)` devuelve `{perfil: {id, enlaceMeet, actualizadoEn}, reuniones:
[{reunion, solicitud, anfitrion, anfitrionAnterior}]}`, con una entrada por cada `meet-cambiado` que hay que mandar. Con el mismo
    enlace devuelve `reuniones: []`.
  - Sus errores: `22023` (hint `p_enlace_meet` o `p_actualizado_en_esperado`), E11 (`42501`, inactivo) y E19 (`PT409`).
  - El Meet ya no se guarda con `.update()` (da `42501`) ni se vacía. El campo no ofrece borrarlo: con valor, «guardar» exige un enlace
    válido.
  - «Avisaremos a N visitantes» se cuenta antes de llamar, con una lectura acotada.
  - Guardar nombre o WhatsApp con `.update()` mueve `perfiles.actualizado_en`. Si el mismo «guardar» cambia también el Meet, primero
    se llama a `actualizar_meet` y después se hace el `.update()` con la versión que devuelve (o se relee); al revés, la RPC da E19.
  - Los recordatorios ya programados en Resend (§5.8) llevan el Meet viejo. Hay que reprogramarlos, o cancelarlos y volver a
    programarlos, con los datos de cada reunión devuelta.
- **P21 (`/panel/calculadora`):** `guardar_config_calculadora(p_precio, p_pct_sena, p_sena, p_moneda_local, p_pct_local,
p_volatilidad, p_sueldo, p_tasa, p_ciclo_dias, p_actualizado_en_esperado)` devuelve `{precio, pctSena, sena, monedaLocal, pctLocal,
volatilidad, sueldo, tasa, cicloDias, actualizadoEn}`. Sus errores: `22023`, con el parámetro o la restricción en `hint`; E11 sin la
  clave; E18 (`PT409`).
- **P37 (`/api/whatsapp`, `/api/eventos`):** `elegir_whatsapp(p_pagina, p_utm_*)` ya registra el clic, así que no se llama a
  `registrar_evento` para él. Devuelve `{perfilId, whatsapp}` o null; con null, `RUTA_SIN_WHATSAPP`. `registrar_evento` rechaza
  `clic_whatsapp` con `22023` (hint `p_tipo`).
- **P35 y P36:** escribir `formulario_enviado`, `detalle_calculadora` y `reunion_*` con `registrar_evento(…, p_solicitud_id)` después
  de la RPC del caso (P4a).
- **P34:** `_auditar_config` ya cubre `config_agenda`, así que `guardar_config_agenda` queda auditada sin más. Falta decidir
  `horario_base`. La fila 38 de la matriz se prueba por la RPC.
- **P38:** usan `now()` `actualizar_meet` (para decidir qué es «futura»), `elegir_whatsapp` (la semana) y `_metricas_solicitud` (el
  día de `ganadas`).
- **Carril `tareas` (`afuera`, sin compuerta):** `src/modules/medicion/CLAUDE.md` dice «Las rutas de WhatsApp y de eventos son de
  P34», pero ahora son de P37. Lo corrige su dueño.
