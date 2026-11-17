# P11 · Decisiones

Fecha: 2026-11-17 (America/La_Paz). El plan (`.piloto/planes/P11.md`) se auditó en dos rondas: la primera bloqueó (`infra/` importaba
`notificaciones`, cosa que boundaries no permite) y la segunda dio observaciones, que se aplicaron antes de ejecutar. Terminó en la compuerta
`datos` del paso rojo, que se contestó sola:

- 2026-11-17T10:22:58-04:00 · P11 · compuerta datos contestada sola (PILOTO_AUTO): aprobar

## El `terminado` queda cumplido en parte: P11 se partió

P11 hace sólo **los casos públicos de la agenda del lado del servidor**, dentro de `src/modules/agenda/`: horas de una semana, reservar y
volver a reservar, leer, cambiar y cancelar, con sus correos. No hay rutas, pantallas ni e2e nuevos. Lo demás depende de piezas de otros
carriles que no existen ni en `main` (7836b08) ni en la rama sin integrar `origin/plan/pasos-propuestos` (7078f97, e7bf832):

- **El cliente admin en las rutas públicas** (P23, `base`): `DONDE_SE_PERMITE_EL_ADMIN = []` (`eslint.config.mjs:64`), y las RPC del
  visitante son sólo de `service_role`. Sin eso ninguna ruta puede llamarlas.
- **La CSP y los componentes de §8.5** (P22 y P24, `base`).
- **La gráfica «Crecer sin contratar»** (P26, `calculadora`): `calculadora/client.ts` sólo exporta tipos.
- **El reloj fijo de los e2e** (§9.7, `semilla.md:945`): `TIEMPO_FIJO` no existe y las RPC usan `now()` de la base.

El registro de correos (P27–P29) ya no es requisito: los casos escriben contra la interfaz del notificador, como dispuso e7bf832.

Pasos propuestos al coordinador. Los ids son propuestos: P34 ya está tomado en `origin/plan/pasos-propuestos`; si P35 o P36 ya se usaron, va
el siguiente libre.

| Paso | Qué hace                                                                                                                                                                              | `modulos`                                                                                                                                                                                                                                           | Riesgo | Depende de                                   | Verificación                                                                        |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------- | ----------------------------------------------------------------------------------- |
| P35  | Formulario de /agendar (paso 1: borrador en sessionStorage, prellenado, gráfica, aviso sin-whatsapp) y `/api/solicitudes` con Turnstile, límite y enlace con `ref`                    | `src/modules/solicitudes/features/formulario/`, `src/modules/solicitudes/infra/`, `src/modules/solicitudes/pantallas/`, `src/modules/solicitudes/client.ts`, `src/app/agendar/`, `src/app/api/solicitudes/`, `e2e/ventas/agenda/formulario.spec.ts` | rojo   | P11, P30, P33, P22, P23, P24, P26            | nivel 1 + `pnpm test:e2e e2e/ventas/agenda/formulario.spec.ts` (escritorio y movil) |
| P36  | Horas, reserva y gestión en pantalla (/agendar pasos 2 y 3, /reunion/[token], `/api/horas`, `/api/reservas`) y e2e con reloj fijo de los recorridos 1, 2, 4 y 5 y los estados de §6.5 | `src/modules/agenda/features/`, `src/modules/agenda/pantallas/`, `src/modules/agenda/client.ts`, `src/app/agendar/`, `src/app/reunion/`, `src/app/api/horas/`, `src/app/api/reservas/`, `e2e/ventas/agenda/`                                        | rojo   | P11, P35, P33, P23, P24 y los del reloj fijo | el `verificacion.comando` actual de P11 (nivel 2, `pnpm test:e2e:completo`)         |

Además: P09 pasaría a depender de P35, y P15 de P36.

## Lo que contestó la persona (compuerta `afuera` al cerrar)

La compuerta `afuera` de cierre preguntó si se suma a `plan.yaml` lo que falta para terminar /agendar y /reunion, con el reloj fijo. El
dueño contestó desde la terminal: «seguir (recomendado)». Queda para el coordinador sumar a `plan.yaml`:

- P35 y P36, como en la tabla de arriba;
- P22, P23, P24 y P26, como los propusieron P01 y P03;
- los dos pasos rojos del reloj fijo, uno `datos` y uno `base`.

Al cerrar, `main` (267ddb6) ya tenía P27–P34 y P11 con `depende_de: [P03, P04, P05, P06, P07, P30, P33]`; P35 y P36 siguen libres. Las
dos preguntas, con su recomendación:

- **P1 · Sumar a `plan.yaml` lo que falta.** Recomendado: P35 y P36 como arriba, más P22, P23, P24 y P26 (los propusieron P01 y P03).
- **P2 · El reloj fijo.** Recomendado: dos pasos rojos que fijen la hora sólo en las pruebas locales, sin efecto en producción: uno `datos`
  (la hora de la base) y uno `base` (la del servidor); P36 y P13 dependen de los dos. Nota para quien planifique el de `datos`:
  `public._ahora()` devuelve `now()` salvo que exista `pruebas.reloj` (la busca con `to_regclass`); esa tabla la crea sólo la semilla local
  `supabase/semillas/pruebas.sql`, la escribe el e2e como `postgres` y no tiene grant para `anon`, `authenticated` ni `service_role`; una
  prueba de `supabase/tests/` afirma `_ahora() = now()` sin la tabla y una guarda de `pnpm test` cae si una migración nombra `pruebas.reloj`.
  La alternativa es probar con horas relativas a la real, y el `terminado` dejaría de decir «con reloj fijo».

## Notas para los pasos que siguen

- **P35:** el `whatsapp` del formulario se valida con el check de la base `^\+[1-9]\d{7,14}$`
  (`supabase/migrations/20261117024000_calesa_tablas_panel.sql:128`), no con el `{6,14}` de `solicitudes/entities/repetidas.ts:20`. El
  recorrido 2 entra por `/agendar?autos=25&adm=3` (la calculadora pública es de P09).
- **P36:** cambiar y cancelar van por `/api/reservas` (§9.3 no tiene otra ruta de gestión). El cableado desde `src/app` arma
  `DependenciasPublicas`: `LlamarRpc` con un único cast de los argumentos a los `Args` generados (el comentario de `infra/rpc.ts` dice por qué
  es seguro), el notificador real (`crearNotificador`, que cumple `CorreosDeAgenda`) y `momentosDeRecordatorio`. `crearNotificador` exige un
  `registro: RegistroDeCorreos` y P29 salió del camino crítico: **qué registro usa P36 en producción queda pendiente de P36 o del
  coordinador**; sin él, «correos enviados» no tiene camino fuera de las pruebas. La respuesta de `/api/horas` es la de `horasParaSemana`.

## Decisiones no obvias

- **Los correos entran por puertos propios de `agenda`** (`CorreosDeAgenda`, `MomentosDeRecordatorioDeAgenda`), no por un import de
  `notificaciones`: boundaries no deja que `infra/` importe otro módulo (`eslint.config.mjs:220-233`). `infra/casos/tipos.test.ts` fija con
  `expectTypeOf` que el `Notificador`, `momentosDeRecordatorio` y los `DatosDeCorreo` de `notificaciones` los cumplen: si P07 cambia una
  firma, cae `pnpm typecheck`. La dependencia de §9.2 se cumple por composición en `src/app`.
- **La semana es la ISO (lunes 00:00 a lunes 00:00) en la zona del visitante**, no en la de La Paz: es la que ve en pantalla (X1, R4.13).
- **Cambiar cuenta en el límite de reservas de la IP y cancelar no**: cambiar toma una hora como reservar (§4 l. 402) y cancelar la libera.
  El límite va antes de leer el token o tocar la base, y falla cerrado.
- **Sin Turnstile en reservas**: la semilla lo pone sólo en el formulario y en el detalle de la calculadora (`semilla.md:401-402,932`).
- **La zona se valida con la forma de `_validar_zona`** (Región/Ciudad o UTC, hasta 64) además de Intl: una zona que Intl acepta y la base
  no (GMT, EST5EDT) se rechaza con «Elige una zona horaria válida.» y no como un `22023` de la base.
- **`22023` y `42501` de las RPC son `inesperado`**: son entradas mal armadas o permisos, no algo que la persona pueda arreglar. Se registra
  `agenda: <fn> <código>`, nunca los argumentos (token, hash, datos de la persona).
- **La respuesta de horas va agrupada por día** (`dias: [{dia, horas: [{inicio, hora}]}]`): con un horario de 7 × 24 pesa unos 18 KB y la
  forma plana, con `dia` en cada hora, pasaba los 20 KB de `docs/RENDIMIENTO.md`.
- **El texto de `cerrada` es el de E8** («Esta demo ya no está confirmada.») y el de fuera de plazo, el de E6.
- **El orden de los correos**: cancelar lo programado va primero (los recordatorios nuevos llevan los mismos ids, y cancelar después los
  borraría); los correos se mandan uno tras otro y un fallo o una excepción no tumban el caso. El aviso al equipo de una cancelación lleva el
  `inicio` de la reunión cancelada. Una solicitud sin importadora manda el `aviso-equipo` sin el campo (sólo lo admite opcional).
- **Los correos del resumen se validan con el check de la base** (`^[^@\s]+@[^@\s]+\.[^@\s]+$`), no con `z.email()`: el resumen se
  valida después de que la RPC hizo commit, y un correo que la base aceptó (`josé@…`, `a@b.c`) volvía la reserva hecha un «inesperado» sin
  correos (lo encontró la auditoría del informe). Si ese correo no le sirve al notificador, falla ese correo solo y se registra. Para P35:
  el formulario debería validar el correo con el mismo criterio que va a usar el notificador, para que no entre uno que después no recibe
  nada.
- **Cambiar compara la versión en milisegundos y manda a la base la que recibió**: si la versión leída no es la recibida, conflicto con el
  texto de E7 sin llamar a `cambiar_reunion`; si coincide, la base vuelve a comparar al microsegundo con la versión recibida (P36 tiene que
  devolver el `actualizadoEn` tal como lo entregó `leerReunion`).
- **Dos archivos que el plan no listaba**: `infra/casos/entrada.ts` (la zona con la forma de la base, el token, el instante, `validar` y el
  enlace de gestión, compartidos por los tres casos) y `entities/respuestas.soporte.ts` (las respuestas de ejemplo de la base, para que el
  commit de `entities/` no dependa de `infra/`). Los dos están dentro de `src/modules/agenda/`.
