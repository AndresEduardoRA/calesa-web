# P02 · Decisiones

Esquema, permisos, RLS, storage y semillas de datos. Riesgo rojo; el plan auditado se aprobó por `PILOTO_AUTO`.

## Autoelección (2026-11-16)

Tal cual la anotó el bucle (`hechos.json` › `autoelecciones`):

- 2026-11-16T22:36:22-04:00 · P02 · compuerta datos contestada sola (PILOTO_AUTO): aprobar

Con eso rigen las recomendadas de las siete preguntas del plan:

- **P1 · Lectura del visitante.** `anon` no tiene nada en `public`. Lee por el esquema `publico`, con `publico.equipo_visible()` y `publico.config_calculadora()` (`security definer`, de sólo lectura), y `publico` se suma a `[api] schemas` de `config.toml`.
  - Costo: `pnpm db:types` sólo genera `public`, así que un cliente tipado no compila `.schema('publico')`. Hasta que el carril `base` pase `db:types` a `--schema public,publico`, P20 y la calculadora necesitan un cast. Es una compuerta `afuera` a `base`, y también `guardas`, porque toca una línea `db:*` de `package.json`.
  - Exponer `publico` en el proyecto de la nube es compuerta `afuera` del paso de lanzamiento.
- **P2 · Lo que la matriz permite directo y §3 manda por RPC.** El estado de una solicitud (fila 9), `asignado_a` (35), borrar una solicitud (36) y `config_calculadora` (38) no tienen grant directo para `authenticated`: las filas prueban que lo directo se rechaza.
  - El caso permitido lo prueba P05 por sus RPC (X17: manda el kit).
  - `equipo.visible` sí queda directo para quien tiene `equipo.gestionar` (fila 39).
- **P3 · `perfiles.rol`, `activo` y `en_turno`.** Nadie los cambia directo, tampoco el admin: el trigger los rechaza.
  - Además, nadie puede desactivarse a sí mismo, tampoco desde una RPC (fila 37 y la 37b).
- **P4 · Claves sin punto de aplicación.** P02 carga sólo las 14 claves que tienen policy o trigger aquí. `solicitudes.reasignar`, `solicitudes.borrar`, `reuniones.cambiar` y `calculadora.configurar` entran con las RPC de P05.
- **P5 · Filas iniciales.** En las migraciones van las dos filas únicas de configuración (`on conflict (id) do nothing`) y el horario de B11 (`where not exists`), porque la nube no corre el seed. En `seed.sql` va la tarjeta del fundador.
  - Consecuencia: en producción la tarjeta del fundador no existe hasta que el admin la cree (P20) o la cargue el paso de lanzamiento.
- **P6 · Bucket `equipo`.** 5 MiB; `image/jpeg`, `image/png` y `image/webp`.
- **P7 · Editar y borrar notas.** Una clave nueva, `notas.gestionar` (admin: todos; vendedor: —), con sus policies de update y delete.

## Decisiones de la ejecución (2026-11-16)

- **Varias migraciones.** «Una migración nueva» del `terminado` se cumple con seis migraciones nuevas de 300 líneas o menos: `calesa_tablas_panel`, `calesa_tablas_sitio`, `calesa_permisos`, `calesa_rls`, `calesa_columnas_protegidas` y `calesa_publico_y_storage`. La base del kit no se toca.
- **La exclusión de reuniones con `_mas_minutos`.** La expresión literal de §3 (`fin + make_interval(mins => 15)`) no se puede indexar: `timestamptz + interval` es STABLE y una exclusión pide IMMUTABLE. Comprobado en PGlite: «functions in index expression must be marked IMMUTABLE».
  - `public._mas_minutos(timestamptz, int)` es `immutable` y suma sólo minutos, que no dependen de la zona horaria. Tiene el mismo significado que §3.
- **`horario_base` sin solapes.** Usa `tsrange(date '2000-01-03' + desde, date '2000-01-03' + hasta)`, una fecha fija, y no un tipo de rango propio, cuyas funciones nacerían con EXECUTE para PUBLIC.
- **Qué significan las funciones de permisos.**
  - `tiene_permiso(clave)` es la clave **sin acotar**: el usuario existe, está activo y su rol tiene la clave con alcance `todos`.
  - `ids_con_alcance(clave)` da `{uid}` si está activo y su rol tiene la clave con cualquier alcance; si no, `{}`. Nunca da null ni más de un id.
  - Las policies usan `T(k) or col = any (ids_con_alcance(k))`, las dos como InitPlan; la de `solicitudes` lo comprueba con EXPLAIN.
  - `puede_en_solicitud(id, clave)` es el `puede_*(id)` de las tablas hijas (notas, auditoría).
- **«Denegado» exacto.** Sin grant: 42501 sin hint. Policy de `with check`: 42501. Policy de `using`: 0 filas. Trigger: 42501 con la columna en el hint.
  - Donde §4 dice «0 filas» y el rol no tiene el grant (todo lo de `anon` en `public`, y lo que P2 deja sin grant), se espera 42501: es más estricto.
- **Invitaciones.** El admin sólo puede revocar una invitación pendiente: su policy de update es `using (estado = 'pendiente')` y `with check (estado = 'revocada')`. `aceptada` la pone el servidor.
  - Leer «servidor (acción del admin)» de §3 como un insert del admin bajo RLS es una decisión. La respaldan §3 («el panel escribe con Server Actions bajo RLS») y `.claude/rules/datos.md` (`auth.admin` se pide con el cliente de quien invita).
- **`ultimo_contacto_en` sólo avanza** (lo pidió la auditoría del informe). Directo, la escriben el vendedor (en las suyas) y el admin, pero el trigger la rechaza (`42501`, hint `ultimo_contacto_en`) en dos casos:
  - si va hacia atrás: la retención de C2 borraría la solicitud, y el vendedor no puede borrar;
  - si va más de un minuto al futuro: esquivaría la retención. El minuto de margen es por la hora del servidor de la app.
  - Sólo si la columna cambia: un valor futuro que dejó una RPC no bloquea editar otra columna (fila 9c).
  - Rechazar y no forzar `now()`: un error de validación lleva su campo en el `hint` (`.claude/rules/migraciones.md`), y forzar cambiaría en silencio lo que mandó la app.
- **FK sólo donde §3 dice FK.** `eventos`, `correos_salientes`, `auditoria`, `metricas_persona` y `solicitudes.ref_codigo` no tienen FK, para sobrevivir a un borrado.
  - Donde §3 no dice qué pasa al borrar, rige el valor de Postgres (`no action`).
- **Checks que §3 no nombra y que se sumaron:**
  - `reuniones.fin > inicio`;
  - `token_hash` de 32 bytes;
  - un largo máximo en los textos libres (`ref_codigo` de 2 a 20, `foto_ruta` de 1 a 200, `plantilla`, `tarea`, `clave`, `tabla`);
  - el `email` validado con `email::text ~ …`, para que no dependa del operador de `citext`.
- **La semilla de pruebas en `supabase/semillas/pruebas.sql`,** sumada a `[db.seed] sql_paths`. Existe en local y en `db:probar`, nunca en la nube.
  - Va bajo `semillas/` para que `scripts/e2e-dirigidos.mjs` la reconozca.
  - Sus usuarios están sólo en `auth.users` con id y email: no sirven para entrar por enlace mágico.
- **`pruebas.caso`, el ayudante de las pruebas de la base**, en el esquema `pruebas`, sin acceso para `anon` ni `authenticated`.
  - Es de invocador y sin `set`, porque `set_config('role', …)` no se puede en una función de definidor. Por eso splinter da un WARN de `search_path` en esa función, que sólo existe en local.
  - Toma como vacío el hint «Grant the required privileges…» que el Postgres de Supabase le pone a un permission denied. Así las mismas pruebas corren contra PGlite y contra la base real.
  - `definer:<X>` simula una RPC de definidor llamada por X: no cambia de rol y sólo pone el usuario.
  - `p_fila` es `text`, no `int`: hay filas como «32b» o «37b».
- **Términos nuevos para la próxima versión de la semilla** (P02 no toca `docs/GLOSARIO.md`, que sale de ella):
  - **clave de permiso** (`solicitudes.ver`…);
  - **alcance** (`propio`, `todos`).

## Para el coordinador (propuesto en la «Partición» del plan)

Líneas a sumar al `terminado` de **P05** (mismo carril):

- los casos permitidos de las filas 9, 35, 36 y 38, por `cambiar_estado_solicitud`, `reasignar_solicitud`, `borrar_solicitud` y `guardar_config_calculadora`;
- las claves `solicitudes.reasignar`, `solicitudes.borrar`, `reuniones.cambiar` y `calculadora.configurar`, en la migración de esas RPC;
- `cambiar_en_turno`, `reactivar_usuario` y `asignar_rol`;
- `guardar_config_agenda` y `guardar_horario_base`;
- variantes de `reasignar_solicitud` y `desactivar_usuario` que `authenticated` pueda ejecutar, con su chequeo de permiso (§4 l. 360 las deja sólo a `service_role`);
- la RPC de `limites`, que usa P06 (y que P06 pase a depender de P05);
- el recolector de fotos huérfanas del bucket `equipo`.

Sin dueño en `plan.yaml`:

- crear el perfil cuando se acepta una invitación.

Compuertas `afuera`:

- carril `base`: `--schema public,publico` en `db:types`;
- carril `base` (P14): `mis_permisos()` en `actionClient`;
- paso de lanzamiento: exponer `publico` en la nube.
