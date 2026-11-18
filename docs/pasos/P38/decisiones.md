# P38 · Decisiones

Fecha: 2026-11-17 (America/La_Paz). Paso rojo del carril `datos`: el reloj fijo de la base en las pruebas locales (origen:
`docs/pasos/P11/decisiones.md:44-51`; semilla §9.7 `semilla.md:945`, R4.22 `semilla.md:1137`). El plan (`.piloto/planes/P38.md`) se
auditó en dos rondas: las dos dieron observaciones, que se aplicaron antes de ejecutar. La compuerta `datos` se contestó sola:

- 2026-11-17T18:46:25-04:00 · P38 · compuerta datos contestada sola (PILOTO_AUTO): aprobar

«Aprobar» aceptó las cuatro recomendadas:

- **P1.1 · Un instante fijo.** Con la fila puesta, `public._ahora()` devuelve esa hora, quieta, en cada llamada (lo que dice §9.7 y lo
  que hará `TIEMPO_FIJO` en el servidor, P39). Para que pase el tiempo, la prueba mueve la fila. Costo: lo que se crea con el reloj
  quieto empata en `creado_en`, y los listados `(creado_en desc, id desc)` ordenan esas filas por id.
- **P2.1 · Toda la base menos las versiones.** Pasan a `_ahora()` las funciones (lo que comparan y lo que escriben) y los 22 defaults de
  hora de `public`. Quedan con el reloj real `actualizado_en` y `horario_base.creado_en` (la versión de `guardar_horario_base`).
- **P3.1 · `_ahora()` la ejecutan `authenticated` y `service_role`; no `anon` ni PUBLIC.** Hace falta: `_proteger_solicitudes` es de
  invocador y corre como `authenticated`, y los defaults se evalúan con el rol que inserta (`authenticated` inserta directo
  `invitaciones`, `bloqueos`, `notas`, `enlaces_prospeccion` y `equipo`). Queda en la API como `rpc/_ahora`: devuelve la hora y nada más.
- **P4.1 · Para el coordinador:** el ayudante del e2e que fija y suelta el reloj (`e2e/soporte/reloj.ts`, sobre `sql()` de
  `e2e/soporte/sql.ts`, como `postgres`) no está en los `modulos` de nadie. Se propone sumarlo a los `modulos` de **P36**, el primero que
  lo usa (P13 también lo necesita). P38 no lo necesita para su `terminado`.

## Decisiones no obvias

- **`_ahora()` es de definidor** (`security definer`, `set search_path = ''`, `stable`). Si fuera de invocador, `to_regclass` daría
  `42501` a `authenticated` (sin usage en el esquema `pruebas`) desde un trigger o un default, y la base local se portaría distinto que
  la nube. Lee la tabla con SQL dinámico, para que compilar la función no la busque. Sin el esquema, sin la tabla o con la tabla vacía,
  devuelve `now()`.
- **La tabla va en una semilla propia** (`supabase/semillas/reloj.sql`, al final de `sql_paths` de `supabase/config.toml`), no en
  `semillas/pruebas.sql`: ésa tiene 296 líneas y con la tabla pasaba de 300. Nace vacía (así ninguna prueba existente cambia), con RLS sin
  policies y sin grants para `anon`, `authenticated` ni `service_role`. Su dueño es `postgres`: se comprobó en la base real
  (`.piloto/salidas/P38/real-authenticator.txt`).
- **El criterio (C3):** toda lectura del presente en una función de `public` es `(select public._ahora())`, por sustitución literal de
  `now()` en la definición vigente; nada más cambia (firma, `security definer`, `set`, volatilidad; `create or replace` conserva dueño y
  grants). Va envuelta en `select`, como `(select auth.uid())`, para que sea InitPlan y se evalúe una vez por consulta también cuando no
  es clave de índice (`retencion_diaria` sobre `limites`, el filtro de 30 días de `crear_o_juntar_solicitud`). Los defaults no admiten
  subconsultas: van con `public._ahora()` a secas.
- **Quedan con el reloj real:** las versiones de edición (`clock_timestamp()` en `_tocar_actualizado_en` y `guardar_horario_base`: si
  se quedaran quietas, dos ediciones darían `PT409`) y `_validar_zona` (su `now() at time zone p_zona` sólo prueba que la zona exista).
  Fuera de `public`, los ayudantes de prueba `pruebas.solicitud` (su `consentimiento_en`) y `pruebas.hora` siguen en `now()`.
- **«Una migración nombra `pruebas.reloj`»** no se puede cumplir al pie de la letra: la migración de `_ahora()` tiene que nombrarla para
  el `to_regclass`. La guarda (`supabase/tests/reloj.test.ts`) cae si una migración la nombra fuera de las definiciones de
  `public._ahora` (regex `"?pruebas"?\s*\.\s*"?reloj\b`, contando comentarios y cuerpos de otras funciones), y lee la carpeta tal como
  está. Por eso los comentarios de las migraciones de P38 dicen «la tabla `reloj` del esquema `pruebas`», sin el punto.
- **Las pruebas se partieron por commit**, con nombres distintos de los del plan: `reloj.sql` (T1–T6), `reloj-rpc-sitio.sql` (A1–A7),
  `reloj-rpc-panel.sql` (B1–B8), `reloj-guarda.sql` (C8, la guarda del catálogo) y `reloj-copias.test.ts` (C7.3, las copias fieles).
  Así cada commit pasa sus verificaciones solo. `reloj.sql` corre último (orden por nombre) y su bloque de la tabla vacía descubre una
  fila que se escapó de otro bloque.
- **`crear_o_juntar_solicitud` pasa de 80 líneas** (91): la copia literal que exige C3 la repite tal cual; partirla sería cambiar la
  función, fuera de este paso.
- **`reloj-guarda.sql` también cuenta que sigan los 22 defaults en `_ahora()`** (con `>= 22`): una tabla nueva con su `creado_en` en
  `_ahora()` no la rompe; una en `now()`, sí.

## Notas para los pasos que siguen

- **Toda RPC, trigger o default nuevo de `public`:** la hora es `(select public._ahora())` (en un default, `public._ahora()`). Si no,
  cae `supabase/tests/reloj-guarda.sql`. Una función que redefina una de las 17 parte de la copia de P38 (la vigente). La guarda mira
  sólo `public`: una función de `publico` (la que ejecuta `anon`) que necesite la hora tiene que ser de definidor para llamar a
  `_ahora()` (anon no tiene EXECUTE), y conviene sumar `publico` a la guarda en ese paso.
- **P36 y P13 (e2e con reloj fijo):** el contrato, como `postgres` (`e2e/soporte/sql.ts`): fijar =
  `insert into pruebas.reloj (ahora) values ($1) on conflict (id) do update set ahora = excluded.ahora`; soltar =
  `delete from pruebas.reloj where id = 1`. Toda spec que lo fija lo suelta al terminar (CI corre en shards, cada uno desde `db:reset`).
  Con el reloj quieto, lo creado empata en `creado_en` (no comparar su orden, o mover el reloj entre una y otra), y los envíos del mismo
  IP comparten la ventana de `limites` mientras el reloj no se mueva. `pruebas.hora(d, 'HH:MI')` sigue contando desde la fecha real.
- **P39 (la hora del servidor, `TIEMPO_FIJO`):** misma semántica (instante quieto, P1.1) y mismo instante de §9.7
  (`2026-11-02 08:00 America/La_Paz` = `2026-11-02 12:00Z`), para que la base y la app vean la misma hora.
- **Coordinador:** sumar `e2e/soporte/reloj.ts` a los `modulos` de P36 (P4.1).
