# agenda

Horas disponibles y reparto parejo de la agenda de demos (§5.5, §5.6) y los casos públicos del visitante (horas de una semana, reservar, leer, cambiar y cancelar; §5.8, §6.4). Los casos todavía no tienen ruta (P36).

## Entra y sale

- Entra: ningún módulo. Usa `src/shared/lib/seguridad` (tokens y límite). No importa `solicitudes`: recibe el id y los datos que necesita. Los correos entran por `CorreosDeAgenda` y los momentos de los recordatorios por `MomentosDeRecordatorioDeAgenda`, que `src/app` llena con el notificador y `momentosDeRecordatorio` de `notificaciones`: la dependencia de §9.2 se cumple por composición, no por import (`infra/` no puede importar otro módulo).
- Sale (`index.ts`): `horasDisponibles`, `elegirAnfitrion`, `repartoParejo`, `HORA_OCUPADA`, `horasParaVisitante`, `esZonaValida`, `esquemaZona`, los schemas de lo que lee la base y sus tipos; los casos `horasParaSemana`, `reservar`, `leerReunion`, `cambiarReunion`, `cancelarReunion`, sus puertos (`LlamarRpc`, `CorreosDeAgenda`, `MomentosDeRecordatorioDeAgenda`, `DependenciasPublicas`), sus resultados y los textos de §6.5.
- Tablas: `reuniones`, `horario_base`, `config_agenda`, `bloqueos`, sólo por RPC (`datos_para_horas`, `reservar_reunion`, `cambiar_reunion`, `cancelar_reunion`; sólo `service_role`).

## Archivos clave

- `entities/config.ts` — schemas Zod de la configuración, el horario, las personas, los bloqueos y las reuniones (camelCase; `infra/` traduce las columnas). Las funciones puras no vuelven a validar: valida quien lee la base.
- `entities/horas.ts` — `horasDisponibles(entrada)`: inicios cada 30 min (X10) dentro del horario base, dentro de la ventana global y con al menos un candidato.
- `entities/elegibilidad.ts` — `esElegible` y `candidatosPara`: vendedores primero, admin sólo de respaldo (R4.9); `limitarA` deja un único candidato.
- `entities/anfitrion.ts` — `elegirAnfitrion`: el asignado si es elegible (X5); si no, `repartoParejo` por reuniones confirmadas de la semana ISO de La Paz. `cambiaAsignado` avisa que la solicitud pasa al anfitrión (auditoría `asignacion`).
- `entities/reparto.ts` — `repartoParejo`: menor conteo; empate: la última recibida más antigua (o nunca); empate: `creadoEn`; empate: id menor. Sirve también para los clics de WhatsApp.
- `entities/tiempo.ts` — intervalos `[inicio, fin)`, día ISO de la semana y `semanaIso` en la zona del proyecto.
- `entities/zona.ts` — la zona del visitante (X1, R4.13): cualquier zona IANA; una inválida cae a La Paz.
- `entities/respuestas.ts` — schemas de lo que devuelven `datos_para_horas` y reservar, cambiar y cancelar (`_resumen_reunion`).
- `entities/semana.ts` — `horasDeLaSemana`: la semana ISO en la zona del visitante y su vacío (`semana` u `horizonte`); `agruparPorDia`.
- `entities/gestion.ts` — `estadoDeGestion`: cambiable, fuera de plazo, puede volver a reservar o cerrada, con el reloj de la base.
- `infra/rpc.ts` — el puerto `LlamarRpc` y las cuatro llamadas, con sus argumentos fijados contra los tipos generados, la respuesta validada y la tabla de errores (P0001 → regla, PT409 → conflicto, lo demás → inesperado y un registro sin argumentos).
- `infra/tokens.ts` — `leerToken` (con punto, de solicitud; sin punto, de gestión) y `leerTokenDeGestion`.
- `infra/correos.ts` — qué correos salen, se programan y se cancelan al reservar, cambiar y cancelar, en orden; `despacharCorreos` los corre uno tras otro y un fallo no tumba el caso.
- `infra/casos/` — `horas.ts`, `reservar.ts`, `gestionar.ts` (los casos), `entrada.ts` (zona con la forma de la base, token, enlace de gestión) y `tipos.ts` (los puertos).
- `entities/ejemplos.soporte.ts`, `entities/respuestas.soporte.ts`, `infra/pruebas.soporte.ts` — datos y dobles de los tests (`*.soporte.*`); no salen por `index.ts`.

## No se rompe

- La ventana global incluye sus dos bordes: `h ≥ ahora + anticipación` y `h ≤ ahora + horizonte`.
- El descanso cuenta en la reunión (`fin + descanso`) y en la hora candidata (`h + duración + descanso`); el bloqueo no suma descanso.
- Sólo cuentan las reuniones `confirmada`; el máximo por día es por persona y el día es el de la zona de la config, no el de UTC.
- Un admin asignado no le gana a un vendedor elegible: el admin sólo entra como respaldo (R4.9).
- Los instantes entran y salen como ISO; ningún `new Date()` sin argumento: `ahora` es una entrada.
- P05 repite estas reglas en SQL (`reservar_reunion`): si cambia una, cambia la otra.
- Reservar y cambiar pasan por el límite de reservas de la IP antes de leer el token o tocar la base (falla cerrado); cancelar no cuenta. Turnstile no va en reservas (§4).
- Ninguna salida de un caso lleva el correo del anfitrión, el asignado, el hash ni el token de otra reunión; ningún `console.error` lleva argumentos, tokens ni datos de la persona.
- Los correos de cambiar y cancelar cancelan lo programado **antes** de programar lo nuevo.
- La respuesta de horas va agrupada por día (`dias: [{dia, horas: [{inicio, hora}]}]`): plana pasa los 20 KB con un horario de 7 × 24.

## Ojo

- El paso de los inicios es fijo de 30 min y no depende de `duracionMin`: la duración sólo decide si el inicio cabe en el tramo.
- `Persona.ultimaReunionEn` no es una columna de `perfiles`: es el inicio de su última reunión no cancelada y lo arma `infra/`.
- Los casos no tienen ruta hasta P36, que necesita el cliente admin en las rutas (P23). Su adaptador de `LlamarRpc` hace un único cast de los argumentos a los `Args` generados (el comentario de `infra/rpc.ts` dice por qué es seguro).
- La zona del visitante se valida con la forma de `_validar_zona` (Región/Ciudad o UTC, ≤ 64): una que Intl acepta y la base no (GMT) se rechaza antes de llamar.
