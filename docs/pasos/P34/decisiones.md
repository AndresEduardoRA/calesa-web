# P34 · Decisiones

Turnos, acceso al panel y configuración de la agenda por RPC. Es de riesgo rojo y pasó por una compuerta `datos`. El plan auditado tuvo
dos rondas: la 1.ª bloqueó porque la pausa mandaba demos al admin fuera de turno (contra R4.9) y `asignar_rol` dejaba subir a un segundo
admin (contra X12). La 2.ª dejó observaciones, todas resueltas antes de la compuerta. Lo aprobó `PILOTO_AUTO`.

## Autoelección (2026-11-17)

Tal cual la anotó el bucle (`hechos.json` › `autoelecciones`):

- 2026-11-17T17:19:23-04:00 · P34 · compuerta datos contestada sola (PILOTO_AUTO): aprobar

Con eso rigen las recomendadas del plan: P1, P2 y P4–P12. P3 se retiró en la 2.ª ronda (quedó en P4), y desde entonces P12 es la del
horario vacío; la del recolector se fue a P40.

- **P1 · El perfil del invitado nace al aceptar**, por `aceptar_invitacion()` (sólo `authenticated`, sin parámetros), con una
  invitación `pendiente` y vigente para el correo de la sesión. Una revocada o vencida no crea nada (F5). **Se aparta de R4.14**, que lo
  crea al invitar, hacia lo más estricto: un invitado revocado puede tener usuario de Auth, pero sin perfil no ve nada.
- **P2 · El nombre sale de `invitaciones.nombre`** (2–80, not null), que el admin escribe al invitar, con `grant insert (nombre)`. La
  columna se agrega, se rellena con «Persona invitada» por si la nube tuviera filas y recién después pasa a not null.
- **P4 · `asignar_rol(p_usuario_id, p_rol, p_nombre)` es la RPC de `pnpm admin:crear`** (§9.7 l. 943): sólo `service_role`, sin vía de
  panel (§6.5 no la tiene). Bajo el candado `calesa:roles` crea el perfil del usuario de Auth o le fija el rol. Hace cumplir X12
  contando los inactivos: un segundo admin da E24 y bajar al único da E25. Un vendedor sin perfil entra por invitación (`22023`).
- **P5 · La pausa reparte con el turno exigido** (R3.3, R4.9): las demos futuras y las `nueva` van al reparto, y el admin entra sólo si
  está en turno. Si una demo no tiene candidato, la pausa entera falla con E20 y no cambia nada. Las `nueva` sin nadie en turno quedan
  sin asignar (§5.6 l. 512). Se quedan con la persona lo ya empezado y lo de su propio enlace de prospección (R2.2, R4.19, R4.20). La
  excepción de R4.3 (al admin aunque no esté en turno) sigue siendo sólo de desactivar.
- **P6 · El cambio de turno no se audita** (`auditoria.accion` no tiene `turno`).
- **P7 · Reactivar deja a la persona fuera de turno**: el admin la pone en turno aparte, como en el alta.
- **P8 · `guardar_config_agenda` no cambia la zona horaria**: queda `America/La_Paz`.
- **P9 · La versión del horario es la mayor `creado_en` de sus filas**, independiente de la de las reglas. Cada guardado reescribe las
  filas con `greatest(clock_timestamp(), versión + 1 µs)`. Si la tabla quedó vacía por fuera de la RPC, no hay versión que comparar.
- **P10 · El horario se audita** como fila `config`, con `tabla = 'horario_base'`, el uuid nulo como `registro_id` (la columna es not
  null, como en `_auditar_config`) y `{"tramos": […]}` de antes y de después, sólo si cambió.
- **P11 · Las demos que quedan fuera de un horario nuevo no se tocan**: el horario sólo decide qué horas se ofrecen.
- **P12 · El horario nunca queda vacío**: de 1 a 35 tramos, y `[]` da `22023` con `hint` `p_tramos`. Así `actualizadoEn` nunca es nulo.

## Lo no obvio

- **X12 como invariante de la base.** El índice único parcial `perfiles_un_admin` (`((true)) where rol = 'admin'`) deja un solo perfil
  admin por cualquier vía, también postgres y `service_role`, y cuenta los inactivos. Por eso `reactivar_usuario` no mira X12. Desde el
  panel, el único admin no puede quedar inactivo: sólo él tiene `usuarios.gestionar` y `_proteger_perfiles` le impide desactivarse. Si
  queda inactivo por fuera del API, `asignar_rol(A, 'admin')` lo vuelve activo. Para traspasar el admin a otra persona hace falta una
  RPC nueva.
- **Dos pruebas de `main` que subían a V2 como segundo admin se adaptaron** sin cambiar lo que prueban. En `config-calculadora.sql`, A
  baja a vendedor y vuelve (quedan dos filas `rol` y una `config`: `filas=3`). En `personas.sql`, A baja a vendedor sin actor antes de
  que V2 suba.
- **Apartamiento de `.claude/rules/migraciones.md:57` y `datos.md:29`:** `asignar_rol` no lleva `p_actualizado_en_esperado`. Fija un
  valor absoluto, es idempotente, va en serie bajo su candado, no pisa otra columna y la llama un script, no una pantalla que haya leído
  una versión.
- **La auditoría del alta del admin la escribe la RPC a mano** (`antes = {"rol": null}`), porque el trigger `auditar` es `after update of
activo, rol`. En el camino que actualiza la escribe el trigger. En los dos casos, el actor es `auth.uid()`, que es nulo para el
  script.
- **Los repartos de P30 quedan como envolturas** de una línea de `_repartir_reuniones(uuid, uuid, boolean)` y
  `_repartir_solicitudes(uuid, boolean)` con `false`: `desactivar_usuario` no cambia. Con la sobrecarga, `'public._repartir_reuniones'
::regproc` dejó de ser único, así que `usuarios-desactivar.sql` mira la forma en `(uuid, uuid, boolean)::regprocedure`. Es un cambio
  de una línea, que el plan no listaba.
- **El orden de los candados:** en la pausa es agenda → solicitudes → perfil, como al desactivar. `guardar_*` toman el de la agenda,
  porque la reserva lee las reglas y el horario bajo él. `asignar_rol` toma `calesa:roles`, que ninguna otra RPC toma: no hay ciclo.
- **El correo del perfil del invitado es el de la invitación**, que es lo que escribió el admin. El de Auth sólo sirve para buscarla, sin
  distinguir mayúsculas (`operator(extensions.=)`). Si ese correo ya es de otro perfil, E23.
- **Con `descanso_min` menor que 15**, la exclusión fija de `reuniones` sigue de red (P05): una reserva a menos de 15 min de otra cae en
  E1.
- **Errores nuevos de `_fallar`:** E20–E26. Se definen todos en la migración del turno, para recrear `_fallar` una sola vez.
- **`safeupdate` (el `fix` de la auditoría del informe):** PostgREST conecta como `authenticator`, que precarga `safeupdate`; un
  `delete` o un `update` sin `where` cae con `21000` aunque esté dentro de una RPC de definidor. `guardar_horario_base` borra con
  `where true`. PGlite y psql como postgres no lo ven: se probó conectando como `authenticator` a la base local.
- **`aceptar_invitacion` confía en el correo de `auth.users`** sin mirar `email_confirmed_at`, que el doble de PGlite no tiene. Vale
  porque `supabase/config.toml` exige confirmar el correo y la invitación crea el usuario de Auth antes de que nadie más pueda
  registrarse con ese correo (Auth no repite correos).
- **`_perfil_json` y los `_repartir_*` de tres argumentos** conservan EXECUTE para `service_role`, como los demás ayudantes (C10: se
  revocan a `public`, `anon` y `authenticated`). `_perfil_json` sale como campo calculado de `perfiles` en los tipos, igual que
  `_correo_json`. Sin EXECUTE, `authenticated` no puede pedirlo.
- **Una carrera entre `aceptar_invitacion` y `asignar_rol` sobre el mismo usuario** devolvería al script el `23505` de `perfiles_pkey`
  sin traducir. No tiene consecuencia de seguridad.
- **El recolector de fotos huérfanas**, que nombra el `terminado` de P34, lo cumple P40, como dice la partición.

## Para los pasos que siguen

- **Coordinador:** sumar a `plan.yaml` el paso **P40** · «Recolector de fotos huérfanas del bucket equipo»:
  - `carril: datos`, `riesgo: rojo`, `modulos: [supabase/, src/shared/types/]`, `depende_de: [P34]`;
  - `verificacion`: nivel 2, con el comando de P34;
  - `terminado`: una RPC sólo de `service_role`, de invocador y de sólo lectura, que lista por lotes (con cursor y tope por
    `_acotar_pagina`) los objetos del bucket `equipo` de más de 24 h que ninguna `equipo.foto_ruta` nombra; otra que, justo antes de
    borrar, confirma cuáles de una lista siguen huérfanas; el índice `equipo_foto_ruta`; y pruebas en `supabase/tests/` que fijan el tope
    en su propio archivo (`escala.sql` no mira lo que es sólo de `service_role`).
  - La confirmación **reduce** la carrera de la foto subida por hash (en la que «ya existe» cuenta como éxito), pero no la cierra: el
    objeto es viejo y la gracia de 24 h no lo protege. El plan de P40 la plantea como pregunta.

  **P13** suma P40 a su `depende_de`. A su `terminado` se agrega: «borra las fotos huérfanas de P40 con la API de Storage, confirmando
  cada lote justo antes de borrarlo». **Aviso:** los `modulos` de P13 (`plan.yaml:499`) no tienen un `infra/` para la API de Storage.

- **P14 (`acceso`):**
  - `aceptar_invitacion()` se llama tras el intercambio del código de ingreso, o en el marco si falta el perfil. Devuelve `{perfil: {id,
nombre, email, rol, activo, enTurno, actualizadoEn}, nueva}`; E23 (`42501`) si no hay invitación válida.
  - Invitar inserta `invitaciones (email, invitado_por, nombre)` bajo RLS y llama a `auth.admin.inviteUserByEmail`. Reenviar es revocar
    e invitar de nuevo, porque el grant de update es sólo `estado`. Al revocar conviene borrar el usuario de Auth que nunca entró.
  - No se invita un correo que ya tiene perfil: a quien está desactivado se lo reactiva (`reactivar_usuario(id, versión)` → `{perfil:
{id, activo, enTurno, actualizadoEn}}`). Si no, `aceptar_invitacion` da `nueva = false` y la invitación queda pendiente para
    siempre.
  - `admin:crear` crea el usuario de Auth y llama a `asignar_rol(id, 'admin', nombre)` con `service_role`. Devuelve `{perfil, cambio}`.
    Errores: E24, E25, y `22023` con `hint` `p_usuario_id`, `p_nombre`, `email` o la restricción.
  - `cambiar_en_turno(id, enTurno, versión)` devuelve `{perfil: {id, enTurno, actualizadoEn}, reuniones, solicitudes}`, lo mismo que
    `desactivar_usuario`, para los mismos correos (`reunion-cambiada` al visitante y los avisos al equipo). Errores: E11, E15, E16, E20
    (se muestra con su texto: el admin puede ponerse en turno y volver a pausar) y E26.
- **P15 (`ventas`):**
  - `guardar_config_agenda(duracion, descanso, anticipacion, horizonte, maximo, cancelar, versión)` devuelve `{duracionMin,
descansoMin, anticipacionMinHoras, horizonteDias, maxReunionesDia, cancelarHastaHoras, zonaHoraria, actualizadoEn}`. Errores: E11,
    E21, y `22023` con el parámetro o la restricción en `hint`.
  - `guardar_horario_base(tramos, versión)` recibe `[{diaSemana 1–7, desde "HH:MM", hasta "HH:MM"}]` (de 1 a 35 tramos, el horario
    entero) y devuelve `{tramos, actualizadoEn}`, ordenado. La versión es la de la respuesta anterior, o la mayor `creado_en` de
    `horario_base`, y nunca es nula. Errores: E11, E22, y `22023` con `hint` `p_tramos`, `horario_base_sin_solapes` o
    `horario_base_desde_antes_de_hasta`.
- **P14 y lanzamiento:** la nube tiene que exigir la confirmación del correo (`enable_confirmations`), y no se enciende ningún
  proveedor que dé correos sin verificar: si no, quien se registre con el correo de una invitación pendiente se queda con ella.
- **Todo paso que escriba una RPC:** nada de `delete` ni `update` sin `where` (`safeupdate`, arriba).
- **P38:** usan `now()` `cambiar_en_turno` (qué demo es futura, y la semana del reparto) y `aceptar_invitacion` (la expiración).
- **Próxima semilla:** R4.14 dice que el perfil nace al aceptar; `invitaciones.nombre`; en §4, `aceptar_invitacion` en `authenticated`
  y `asignar_rol` en `service_role`; X12 como invariante de la base.
