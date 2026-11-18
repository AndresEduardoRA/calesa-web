# P23 · Decisiones

Este paso abre el cliente admin a las rutas de §9.1 y arma los respaldos de X13. Es de riesgo rojo: el plan (`.piloto/planes/P23.md`) se
auditó en dos rondas, las dos con observaciones y ninguna bloqueó, y se aplicaron antes de la compuerta `datos`.

## Autoelección (2026-11-17)

Tal cual la anotó el bucle (`hechos.json` › `autoelecciones`):

- 2026-11-17T16:44:59-04:00 · P23 · compuerta datos contestada sola (PILOTO_AUTO): aprobar

«Aprobar» deja vigentes las recomendadas del plan:

- **P1.1 · El par de `age`.** La identidad (`AGE-SECRET-KEY-1…`) va en el secreto `RESPALDO_CLAVE` (el nombre de la semilla) y sólo la
  usa la restauración. El destinatario (`age1…`) va en la variable de repositorio `RESPALDO_DESTINATARIO` y lo usa el respaldo. El job que
  tiene la cadena de la base nunca tiene con qué descifrar. La restauración comprueba que la identidad sea la pareja antes de levantar
  nada.
- **P2.1 · Archivos exactos.** `DONDE_SE_PERMITE_EL_ADMIN` lista los siete `route.ts` de §9.3 y `src/modules/acceso/infra/auth-admin.ts`,
  sin globs. Un ayudante junto a una ruta, otra ruta o el nombre que P14 prefiera vuelven a `base`.
- **P3.1 · `age` de los paquetes de Ubuntu.** `sudo apt-get update && sudo apt-get install age`, en la imagen `ubuntu-24.04`: la versión la
  fija la imagen y el log imprime `age --version`. Sin acciones de terceros.
- **P4.1 · Lo de fuera del repo queda para P19.** El paso cierra con una compuerta `afuera` (abajo, «Para la persona»). Mientras no esté
  `RESPALDO_DESTINATARIO`, los jobs reales no corren y nada queda rojo.

## El lint del cliente admin

- **El orden de los bloques importa.** En flat config gana el último bloque que coincide. El que levantaba la prohibición
  (`src/shared/lib/supabase/**` más la lista) iba antes del de `src/app/**`, que la volvía a poner. Sumar las rutas a la lista no bastaba.
  Ahora cada grupo tiene su bloque: las rutas, después del de `src/app`, y `auth-admin.ts`, después del de `infra/`. Cada uno repite el
  resto de las restricciones de su carpeta, sin la del admin.
- **`DONDE_SE_PERMITE_EL_ADMIN` sigue existiendo** (lo nombra el `terminado`): es la unión de las dos listas y sale en el mensaje del error,
  así quien choca con la regla ve qué archivos sí pueden.
- **«acceso/infra» es `src/modules/acceso/infra/auth-admin.ts`**: la función de `auth.admin` de `.claude/rules/datos.md`. `pnpm
admin:crear` (P14) vive en `scripts/`, donde el lint no restringe el admin, así que no necesita lista.
- **La prueba lee la configuración real** con `ESLint#calculateConfigForFile`, que sólo resuelve la ruta: sirve para archivos que todavía no
  existen. Vive en `src/shared/lib/supabase/` porque es lo único del carril que Vitest incluye. Por eso el paso es de nivel 2.
- **El límite del lint:** `no-restricted-imports` mira sólo el import directo. Un archivo que importara un `route.ts` permitido heredaría
  el admin sin que el lint lo vea. Nadie importa un route handler en Next; si pasara, la regla iría en un paso de `base`.
- **Para P36 y quien venga:** ninguna página crea el cliente admin. P23 recomienda que `/reunion/[token]` lea la reunión por
  `/api/reservas` (un `GET` en el mismo `route.ts`, la «gestión de reunión» de §9.1). Es una recomendación de este paso: P11 sólo dejó dicho
  que cambiar y cancelar van por esa ruta (`docs/pasos/P11/decisiones.md:58`). Si P36 necesita otro archivo, es una compuerta `afuera` a
  `base`, que lo suma a `RUTAS_CON_ADMIN` con su caso en la prueba.

## Los respaldos

- **La carpeta es `.github/respaldo/`, no `.github/respaldos/`** como decía el plan. El `.gitignore` de la raíz ignora `respaldos/` en
  cualquier nivel (los volcados de la demo) y tapaba la carpeta. Ese archivo no es de `base`, y un `git add -f` dejaría fuera de `git
status` todo archivo nuevo. El singular no choca y la regla de la raíz sigue protegiendo los volcados.
- **El volcado es `supabase db dump`**, el `pg_dump` de §9.6. Lo trae la CLI de Supabase con la versión 17 de la base (`major_version =
17`), en dos partes: esquema, y datos con COPY. Va por tubería a `age -r`, así que del lado del respaldo nada queda sin cifrar en el
  disco.
- **Los roles no se vuelcan.** Se probó con `--role-only`, como la guía de Supabase. El volcado trae `GRANT SET ON PARAMETER … TO
supabase_realtime_admin`, y eso no se puede recrear en otra base de Supabase: cae con 42704 sin Realtime y con 42501 con él. El proyecto
  no crea roles propios (`grep` en `supabase/migrations/`), y el esquema sólo da permisos a `anon`, `authenticated`, `service_role` y
  `postgres`. **Por eso el rol de sólo lectura de producción tiene que leer por membresía** (`pg_read_all_data` y `bypassrls`), no con
  `GRANT` por tabla: un `GRANT … TO <rol propio>` en el esquema haría caer la restauración.
- **La base temporal es una pila de Supabase sin migraciones** (`.github/respaldo/supabase/config.toml`, `project_id =
calesa-restauracion`, puertos 55340-55349, el hueco libre del bloque 5). Un Postgres vacío no restaura `extensions.citext` ni la FK a
  `auth.users`. `supabase_temporal` quita las `SUPABASE_*` del entorno: bajo el candado de un carril, el `.env.carril` le cambiaría el
  `project_id` y los puertos.
- **La carga entra como `supabase_admin`**, el superusuario de la imagen local, cuya clave es la de la pila local, pública. Como `postgres`
  cae con 42501 en `storage.buckets_vectors`, una tabla de la plataforma en la que `postgres` no puede escribir y que el volcado de datos
  trae aunque esté vacía. La base es desechable.
- **Los logs no llevan valores.** `cargar.sh` usa `VERBOSITY=sqlstate` (un error sale como `ERROR:  42501`, sin el mensaje, que en un COPY
  trae la fila) y no muestra la salida normal. El error de `supabase db dump` va a una carpeta privada (`700`) que no se sube, y si falla se
  imprime su final sin cadenas de conexión. `comprobar.sql` sólo nombra tablas. Ningún script imprime una variable `RESPALDO_*`, tampoco
  la autoprueba con sus pares desechables.
- **Lo descifrado va a archivos de una carpeta privada que se borra al salir**, no a `<(…)`. Un fallo dentro de una sustitución de proceso
  no lo ve `pipefail` y dejaría cargar medio volcado.
- **`environment: respaldos` en los dos jobs reales.** Un `workflow_dispatch` puede lanzarse desde cualquier rama con su propio archivo. Un
  `if: github.ref == …` no protege; un Environment restringido a `main`, sí. La variable del destinatario queda en el repositorio: el `if`
  de un job no ve las variables del Environment, y el destinatario es público.
- **Horarios:** el respaldo, a las 08:00 UTC (04:00 La Paz, UTC−4 sin horario de verano). La restauración, el domingo a las 09:00 UTC, una
  hora después del respaldo de ese día.
- **La restauración cae mientras producción no tenga solicitudes**, como pide §9.6. Por eso se dispara a mano después de la prueba de humo
  de P19.
- **La autoprueba corre en los PR que tocan `.github/respaldo/`, los dos workflows o `supabase/migrations/`.** Una migración que quita o
  renombra una tabla de P02 cae en su PR, no el domingo. Corre sin secretos y con pares desechables.
- **Las fotos del bucket `equipo` no se respaldan:** `pg_dump` no copia archivos de Storage, y la semilla no lo pide.
- **S6, lo que ninguna autoprueba prueba:** el volcado y la carga usan la misma CLI e imagen sobre una base local. Producción puede tener
  otra versión del esquema `auth` o una extensión que la pila local no trae. La primera prueba real es el disparo a mano de P19.

## Paso propuesto al coordinador (2026-11-17)

`eslint.config.mjs` tenía 352 líneas y ahora tiene 389 (AGENTS.md: «> 300 líneas: se parte»). Lo pidió la auditoría del informe. Partirlo
pide archivos nuevos que hoy no son de nadie, así que no cabía en P23. El id es el siguiente libre de `plan.yaml`:

| Paso      | Qué hace                                                                                                                                                                                                                                                      | `modulos`                      | Riesgo | Depende de | Verificación                                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------ | ---------- | ------------------------------------------------------------------------------------ |
| siguiente | Partir `eslint.config.mjs` por responsabilidad: las restricciones de imports y las listas (`DONDE_SE_PERMITE_EL_ADMIN`) a `eslint/`, y el archivo raíz sólo compone. Sin cambiar ninguna regla: `admin.lint.test.ts` y el lint de todo el repo siguen iguales | `eslint.config.mjs`, `eslint/` | ámbar  | P23        | nivel 1 (`pnpm lint && pnpm typecheck && pnpm test && bash scripts/mapa.sh --check`) |

`eslint/` tendría que sumarse al `dueno_de` de `base` en `plan.yaml`.

## Para la persona (compuerta `afuera` al cerrar; lo hará P19)

La compuerta `afuera` del cierre se contestó sola, tal cual la anotó el bucle (`hechos.json` › `autoelecciones`):

- 2026-11-17T17:13:11-04:00 · P23 · compuerta afuera contestada sola (PILOTO_AUTO): seguir

«Seguir» publica P23 así. Los respaldos quedan apagados, sin error, hasta que P19 haga estos pasos:

1. `age-keygen -o calesa-respaldo.txt` en una máquina propia, con una copia fuera de GitHub: sin ella no se descifra un respaldo si se
   pierde el repo.
2. La línea `# public key: age1…` va a la **variable de repositorio** `RESPALDO_DESTINATARIO`.
3. En Settings › Environments se crea `respaldos`, con «Deployment branches» limitado a `main`.
4. En ese Environment, el archivo entero va al secreto `RESPALDO_CLAVE`. `RESPALDO_DB_URL` lleva la cadena del **pooler de sesión**: el
   runner no tiene IPv6. Va con un rol de sólo lectura que lee por membresía (`pg_read_all_data`, `bypassrls`) y sin `GRANT` por tabla.
5. Se dispara a mano `respaldo-diario.yml` desde `main`.
6. **Después de la prueba de humo de P19**, se dispara a mano `restauracion-semanal.yml`: es la primera prueba real contra producción (S6).
   Si cae por la forma de `auth` o por una extensión, el arreglo es un paso de `base`.
