# P30 · Decisiones

Las RPC de solicitudes (crear o juntar, reasignar, desactivar, borrar) y la retención diaria. Es de riesgo rojo y pasó por una compuerta
`datos`. El plan auditado tuvo dos rondas: las dos dejaron observaciones, ninguna bloqueó, y todas se resolvieron. Lo aprobó
`PILOTO_AUTO`.

## Autoelección (2026-11-17)

Tal cual la anotó el bucle (`hechos.json` › `autoelecciones`):

- 2026-11-17T13:05:19-04:00 · P30 · compuerta datos contestada sola (PILOTO_AUTO): aprobar

Con eso rigen las recomendadas de las ocho preguntas del plan. P1 y P6–P8 son de datos y P2–P5 son reglas de producto, decididas dentro
de la misma compuerta (`PILOTO_AUTO` cubre las dos clases):

- **P1 · Reasignar, desactivar y borrar son del panel.** Sólo `authenticated`, cada una con su clave y alcance `todos`:
  `solicitudes.reasignar`, `usuarios.gestionar` y `solicitudes.borrar`. También se les quita EXECUTE a `service_role`, como en P05/P1.
  **Se aparta a propósito de §4 l. 360**, que dejaba `reasignar_solicitud` y `desactivar_usuario` sólo a `service_role`. Hay tres
  razones: son acciones del admin, que escribe bajo RLS; con `service_role` la auditoría quedaría sin actor; y las claves del
  `terminado` necesitan dónde aplicarse. Es más estricta: sin la clave nadie las ejecuta.
- **P2 · Qué cuenta en el reparto de solicitudes.** Las que la persona tiene asignadas con `creado_en` en la semana ISO local, más
  las que recibe antes en la misma llamada. Desempate: la más reciente de las que tenía, la más antigua primero (sin ninguna, primero);
  después `perfiles.creado_en` y después el id. Quien reparte varias calcula todas antes de escribir ninguna.
- **P3 · Una calculadora que llega con un `?ref` válido** sigue siendo `calculadora`, guarda `ref_codigo` y va al creador del enlace
  si está activo. `_limitar_a` mira ahora `ref_codigo` sin importar el origen, así que su agenda queda limitada al creador (R2.2,
  R4.20). Una repetida sólo llena `ref_codigo` si su asignado ya es el creador del enlace (R4.5 conserva el asignado).
- **P4 · Desactivar reparte todas las abiertas.** Las `nueva` van al reparto de solicitudes. Una `agendada` con su demo en el futuro
  sigue a su demo. **Apartamiento justificado de R3.3** («pasan al reparto parejo»): una `agendada` cuya demo ya empezó y nadie marcó
  pasa con su demo al admin que desactiva. Cambia `anfitrion_id` (R4.8), no el Meet ni `secuencia_ics`, y no hay correo. Lo único
  que falta es marcarla, y quien puede averiguar qué pasó es el admin, no un vendedor que no dio la demo.
- **P5 · El respaldo de una demo futura sin candidato** es el admin que desactiva, elegible sin contar el turno. Antes de todo se
  exigen su Meet (E13, §5.6 l. 515) y su WhatsApp (E17). Si tampoco está libre, E14 y no cambia nada.
- **P6 · Borrar a pedido** toma los correos con `para` igual al correo de la solicitud, con su `solicitud_id` o con el `reunion_id`
  de una de sus reuniones. Así entra el recordatorio al anfitrión. Borra los `programado` y `fallido` y devuelve sus `resend_id`; en
  los `enviado` y `cancelado` vacía `datos` y `adjunto_ics`.
- **P7 · Tras un borrado (a pedido o por retención) queda sólo la fila `borrado`.** Se borra la auditoría anterior de la solicitud y
  de sus reuniones. El actor es quien borra, o null en la retención.
- **P8 · `retencion_diaria` limpia todo §3 l. 300-302**: solicitudes sin contacto hace más de 24 meses, `eventos` de más de 24 meses,
  `correos_salientes` que no esperan envío con más de 90 días y `limites` de más de 2 días. Va con tope por corrida (1000 solicitudes
  y 10 000 de cada otra) y devuelve `quedanMas`.

## Lo no obvio (2026-11-17)

- **Con `search_path = ''`, `=` entre `citext` es `text = text` y distingue mayúsculas.** El operador de `citext` vive en
  `extensions`, que no está en el camino, y Postgres cae en el cast implícito a `text`. Medido en PGlite: dentro de una función así,
  `email = 'CLIENTE1@…'::extensions.citext` da 0 filas y `email operator(extensions.=) …` da 1. Por eso `crear_o_juntar_solicitud` y
  `borrar_solicitud` comparan el correo con `operator(extensions.=)`, y las mutaciones M36 y M37 lo defienden. Cualquier RPC que
  compare `citext` (invitaciones por email, por ejemplo) tiene el mismo problema. Las pruebas comparan con `lower(…::text)` por la
  misma razón.
- **El orden de los candados es agenda → solicitudes → filas, y solicitud → reunión.** Crear toma sólo el de solicitudes; reasignar,
  agenda y filas; desactivar, los tres; borrar, sólo la fila. Nadie toma el de agenda después del de solicitudes, así que no hay
  ciclo con `reservar_reunion` ni con `cancelar_reunion`, que bloquea primero la solicitud.
- **Desactivar toma el perfil con `for no key update`.** Basta para cambiar `activo` y `en_turno`, y no choca con el `KEY SHARE` que
  toman las FK de `notas` y `bloqueos` al insertar. Con `for update`, un insert de V1 a la vez podía dar `40P01`.
- **Las demos de quien se desactiva se listan bajo el candado de agenda y se releen con su bloqueo.** La que se canceló entre
  medio se salta: no hay E8 ni falla toda la desactivación. Reasignar busca su reunión con su propio `for update`, porque
  `_bloquear_vigente` daría E8 sin demo.
- **`_juntar_solicitud` hace más que `juntarSolicitud`.** No pone margen a una solicitud que no es de calculadora, y a una de
  calculadora no le pone autos > 400 (el par entero) ni administración > 80. Sin eso, un formulario de quien antes usó la calculadora
  fallaría con `22023`. Además mueve `ultimo_contacto_en`: la persona volvió a escribir (C2).
- **Un dato inválido al crear es `22023`** con la columna (un `not null`) o la restricción (un `check`) en `hint`. El límite real es
  el Zod del servidor (P35).
- **Errores nuevos de `_fallar`:** E11 (sin la clave, `42501`), E12 a E15 y E17 (`P0001`), y E16 (`PT409`). E17 es una regla más que
  la semilla, que sólo pide el Meet. Es más restrictiva y segura: el visitante recibe el WhatsApp del anfitrión.
- **`database.types.ts` lista también los ayudantes nuevos** (`_elegir_asignado`, `_juntar_solicitud`, `_pasar_reunion`,
  `_repartir_*`, `_bloquear_solicitudes`), igual que ya listaba los de P05: `db:types` lee todo `public`. Nadie más que las RPC los
  ejecuta (revoke a `public`, `anon` y `authenticated`).

## Para los pasos que siguen

- **Coordinador:**
  - Con P1 en a), a **P34** se le restan del `terminado` las «variantes de reasignar_solicitud y desactivar_usuario que authenticated
    pueda ejecutar» y las filas 35 y 36, que ya están hechas. Se le suma que `cambiar_en_turno(false)` reparta como desactivar (R3.3,
    «al pausar»), con `_repartir_reuniones` y `_repartir_solicitudes`.
  - La RPC que escribe `latidos` no tiene dueño en `plan.yaml`, y P13 la necesita.
- **Próxima semilla:** §4 l. 360 sin `reasignar_solicitud` ni `desactivar_usuario`, que pasan a `authenticated` con su clave; `_limitar_a`
  por `ref_codigo`; el término **solicitud juntada**.
- **Carril `solicitudes` (`afuera`):** `repetidas.ts` debería sumar las guardas de calculadora y la del enlace ajeno de
  `_juntar_solicitud`; si no, SQL y TS juntan distinto en esos casos. La ficha `src/modules/solicitudes/CLAUDE.md:27` dice P05 donde va
  P30.
- **P35** (`/api/solicitudes`): `crear_o_juntar_solicitud` devuelve `{id, juntada, origen, estado, creadoEn, asignado}`, con `asignado`
  `{id, nombre, email, whatsapp}` o null. Si `juntada`, no hay aviso nuevo; si `estado` es `agendada`, no ofrece reservar.
- **P13** (tarea diaria): `retencion_diaria()` devuelve `{solicitudes, eventos, correos, limites, quedanMas}`; mientras `quedanMas`, se
  vuelve a llamar con su propio tope.
- **P14 y P15:** con lo que devuelven `reasignar_solicitud` y `desactivar_usuario`, mandar `reunion-cambiada` al visitante,
  `reunion-cambiada-equipo` al anfitrión nuevo y al anterior y `reunion-nueva-anfitrion`. `borrar_solicitud` devuelve `resendIds`:
  cuando P15 los cancela en Resend la fila ya no está; si la cancelación falla tras sus reintentos, conviene dejar por la RPC de P27
  una fila `fallido` sin datos personales (`referencia = 'cancelar:<resend_id>'`) para que la tarea diaria reintente.
- **P27:** ya existen los índices `correos_salientes_para`, `_de_solicitud` y `_de_reunion`.
- **P31:** `_auditar_perfil` existe; se le suma `rol` con `create or replace`. Una demo ya empezada que pasó al admin al desactivar
  cuenta para el admin cuando se marque.
- **P38:** `crear_o_juntar_solicitud`, `reasignar_solicitud`, `desactivar_usuario`, `borrar_solicitud`, `retencion_diaria`,
  `_elegir_asignado`, `_juntar_solicitud` y `_repartir_reuniones` usan `now()` y pasan a `_ahora()`.
