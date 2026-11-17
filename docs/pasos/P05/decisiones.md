# P05 · Decisiones

Agenda en SQL (datos_para_horas, reservar, cambiar y cancelar reunión) y máquina de estados con su auditoría. Riesgo rojo: el plan
auditado (dos rondas, observaciones resueltas, ninguna bloqueó) se aprobó por `PILOTO_AUTO`.

## Autoelección (2026-11-17)

Tal cual la anotó el bucle (`hechos.json` › `autoelecciones`):

- 2026-11-17T08:28:56-04:00 · P05 · compuerta datos contestada sola (PILOTO_AUTO): aprobar

Con eso rigen las recomendadas de las cinco preguntas del plan:

- **P1 · Quién ejecuta las RPC del panel.** Dos entradas por acción. La del visitante, por token (`cambiar_reunion`,
  `cancelar_reunion`), sólo `service_role`, como dice §4 l. 360. La del panel (`cambiar_reunion_panel`, `cancelar_reunion_panel`),
  sólo `authenticated`, con la clave nueva `reuniones.cambiar` (vendedor `propio`, admin `todos`) contra `anfitrion_id`. Las del panel
  y `cambiar_estado_solicitud` le quitan EXECUTE también a `service_role`: sin sesión no hay a quién atribuir el cambio. P30 y P31
  siguen la misma regla para reasignar, desactivar y el Meet.
- **P2 · Volver a reservar tras cancelar (R4.16).** Fila nueva con el `token_hash` nuevo; la cancelada queda cancelada. Un token de
  gestión identifica la **solicitud**: `datos_para_horas`, `cambiar_reunion` y `cancelar_reunion` por token actúan sobre la reunión
  confirmada vigente, así el enlace del primer correo sigue sirviendo.
- **P3 · Un admin asignado no le gana a un vendedor elegible**, ni al reservar ni al cambiar la hora por enlace (I2 de P04
  confirmado): el asignado o el anfitrión actual va primero sólo si está entre los candidatos, y con un vendedor elegible los
  candidatos son sólo vendedores. Lo respaldan §5.5 l. 495 y R2.3 (`semilla.md:1093`, «el mismo **vendedor**»).
- **P4 · El desempate «última reunión»** es el inicio de su última reunión no cancelada (I10 de P04 confirmado; puede estar en el
  futuro).
- **P5 · Reagendar desde el panel exige `en_turno` y la ventana de C2**, igual que `candidatosPara` y `horasDisponibles` de P04. Un
  vendedor no cambia su propio `en_turno`: para mover la reunión de alguien fuera de turno, el admin lo pone en turno (y entonces
  vuelve a recibir solicitudes y clics) o reasigna la reunión (P30). `exigir_turno = false` existe en `_es_elegible` y
  `_candidatos_reunion` para P30 (reasignar, desactivar sin reemplazo); en P05 nadie lo usa.

## Partición (2026-11-17)

El `terminado` de P05 (14 RPC, tres familias de triggers y tres archivos de pruebas) no cabía en un plan de 60 KB ni en 3 commits de
código. P05 hizo la agenda en SQL y la máquina de estados; el resto se propone así, los dos del carril `datos` y rojos, con
`modulos: [supabase/, src/shared/types/]`:

- **P30 · RPC de solicitudes: crear o juntar, reasignar, desactivar, borrar y retención** (`depende_de: [P05]`):
  `crear_o_juntar_solicitud` (reparto de solicitudes §5.6 l. 512, prospección R4.19, repetidas R4.5 con auditoría `juntada`, que
  suma la acción al check de `auditoria`), `reasignar_solicitud` (R4.2, con y sin hueco), `desactivar_usuario` (R3.3, R4.3: también
  reparte las solicitudes abiertas, por eso va con el reparto de solicitudes; auditoría `activo`), `borrar_solicitud` (R4.17),
  `retencion_diaria` (C2), las claves `solicitudes.reasignar` y `solicitudes.borrar`; pruebas `solicitudes-rpc.sql` y `retencion.sql`.
- **P31 · RPC del Meet, WhatsApp, eventos y configuración; triggers de métricas** (`depende_de: [P05]`): `actualizar_meet` (R4.21),
  `elegir_whatsapp` (§5.6 l. 516), `registrar_evento`, `guardar_config_calculadora` (clave `calculadora.configurar`), los triggers de
  `metricas_diarias` y `metricas_persona`, la auditoría `rol` y `config`; pruebas `personas.sql` y `metricas.sql`.

Para el coordinador, los `depende_de` que cambian: **P11** + P30; **P12** + P31; **P13** + P30; **P14** + P30 y P31; **P15** + P30;
**P21** + P31. Lo que P02 propuso sumar a P05 (`cambiar_en_turno`, `reactivar_usuario`, `asignar_rol`, `guardar_config_agenda`,
`guardar_horario_base`, la RPC de `limites`, el recolector de fotos; `docs/pasos/P02/decisiones.md:66-80`) sigue pendiente.

## Decisiones del paso (2026-11-17)

- **Un solo candado de agenda** (`_bloquear_agenda`, `pg_advisory_xact_lock(hashtext('calesa:agenda'))`) en reservar y en los dos
  «cambiar», en vez del candado por hora de §5.6 l. 517: la exclusión de la tabla no protege el máximo diario ni el conteo semanal,
  y dos reservas a horas distintas del mismo día podrían pasar el máximo. Serializa todas las reservas: con el volumen de una
  empresa (decenas por día) no se nota.
- **Orden de bloqueo: la solicitud y después la reunión**, en reservar, cambiar y cancelar (`_bloquear_vigente`) y en
  `cambiar_estado_solicitud` (cuyo trigger toca la reunión después de la solicitud). Así dos de ellas a la vez no se bloquean entre
  sí (`40P01`). `cambiar_estado_solicitud` y cancelar no toman el candado de agenda: no leen elegibilidad.
- **El descanso que vale es el vigente** (`config_agenda.descanso_min`); la exclusión de la tabla (15 fijo) queda de red. Si el
  primero del orden choca con ella (`23P01`), se intenta el siguiente candidato (§5.6 l. 517).
- **Errores.** `P0001` con los textos de `docs/UX.md` para las reglas (una sola función, `_fallar`, con la tabla E del plan),
  `PT409` sólo cuando no coincide `p_actualizado_en_esperado`, `42501` cuando el panel no puede tocar esa fila, `22023` con el campo
  en el hint para lo mal formado. Un token que no existe da siempre «Este enlace no es válido.» (misma respuesta).
- **`datos_para_horas` no entrega contactos del equipo:** `whatsapp` y `enlaceMeet` de cada persona llegan como `'•'` o `null`
  (dicen si los tiene). Con token suma `reunion`, con el WhatsApp y el nombre del anfitrión y el Meet de esa reunión, que son del
  visitante. No aplica el plazo: la página necesita los datos para decir que venció. No es STABLE: sus errores salen por `_fallar`.
- **La máquina de estados valida sólo el `update`**, para cualquier rol (también `service_role` directo); el `insert` lo cuida la
  RPC de creación (P30). Mueve `ultimo_contacto_en` a `now()` en cada cambio (C2). Su tabla repite la de
  `src/modules/solicitudes/entities/estados.ts`.
- **El actor de `cambiar_estado_solicitud` sale del alcance** de `solicitudes.estado` (`todos` = admin, `propio` = vendedor), nunca
  del rol: así el panel no hace las transiciones del servidor ni el vendedor `descartada → nueva`. La descripción de esa clave pasa a
  «Cambiar el estado de una solicitud y registrar el último contacto.».
- **El resumen se lee en otra sentencia.** `_resumen_reunion` es STABLE: llamado en la misma sentencia que inserta la reunión, no la
  ve (devolvía null). `reservar_reunion` guarda el id y lo lee después.
- **Pruebas.** `pruebas.error` compara SQLSTATE y texto exacto (los E son casi todos `P0001` sin hint). Los ayudantes de datos
  (`pruebas.solicitud`, `pruebas.reunion`, `pruebas.token`, `pruebas.hora`, `pruebas.abrir_agenda`, `pruebas.claves`) corren con el
  rol de la sesión: dentro del `p_sql` de `caso` o `error` el rol cambiado no tiene `usage` en `pruebas`, y daría `42501` por el
  esquema. `reservas.sql` se partió en `reservas-horas.sql` (`datos_para_horas` y grants) por el tope de 300 líneas.
  `pruebas.solicitud(asignado, estado, origen, ref)` arma un correo único en vez de recibirlo (el plan decía `(asignado, email, …)`):
  ninguna prueba necesita un correo dado, y el estado sí.

## Pendiente de otro carril (2026-11-17)

La ficha `src/modules/solicitudes/CLAUDE.md` (carril de `solicitudes`, no se toca desde aquí) quedó corta en dos líneas: dice que
`crear_o_juntar_solicitud` lo hace P05 (ahora es de P30) y que el panel cancela por `cancelar_reunion` (desde el panel es
`cancelar_reunion_panel`; `cancelar_reunion` es la del enlace del visitante). Lo actualiza su dueño cuando toque el módulo.
