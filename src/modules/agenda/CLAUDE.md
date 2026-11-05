# agenda

Horas disponibles y reparto parejo de la agenda de demos (§5.5, §5.6); por ahora sólo reglas puras.

## Entra y sale

- Entra: nada. No importa `solicitudes`: recibe el id y los datos que necesita. Desde P11 depende de `notificaciones`; hoy, de ningún módulo.
- Sale (`index.ts`): `horasDisponibles`, `horasParaVisitante`, `esZonaValida`, `esquemaZona`, los schemas de lo que lee la base y sus tipos.
- Tablas: `reuniones`, `horario_base`, `config_agenda`, `bloqueos`.

## Archivos clave

- `entities/config.ts` — schemas Zod de la configuración, el horario, las personas, los bloqueos y las reuniones (camelCase; `infra/` traduce las columnas). Las funciones puras no vuelven a validar: valida quien lee la base.
- `entities/horas.ts` — `horasDisponibles(entrada)`: inicios cada 30 min (X10) dentro del horario base, dentro de la ventana global y con al menos un candidato.
- `entities/elegibilidad.ts` — `esElegible` y `candidatosPara`: vendedores primero, admin sólo de respaldo (R4.9); `limitarA` deja un único candidato.
- `entities/tiempo.ts` — intervalos `[inicio, fin)`, día ISO de la semana y `semanaIso` en la zona del proyecto.
- `entities/zona.ts` — la zona del visitante (X1, R4.13): cualquier zona IANA; una inválida cae a La Paz.
- `entities/ejemplos.soporte.ts` — datos de los tests (`*.soporte.*`); no sale por `index.ts`.

## No se rompe

- La ventana global incluye sus dos bordes: `h ≥ ahora + anticipación` y `h ≤ ahora + horizonte`.
- El descanso cuenta en la reunión (`fin + descanso`) y en la hora candidata (`h + duración + descanso`); el bloqueo no suma descanso.
- Sólo cuentan las reuniones `confirmada`; el máximo por día es por persona y el día es el de la zona de la config, no el de UTC.
- Los instantes entran y salen como ISO; ningún `new Date()` sin argumento: `ahora` es una entrada.
- P05 repite estas reglas en SQL (`reservar_reunion`): si cambia una, cambia la otra.

## Ojo

- El paso de los inicios es fijo de 30 min y no depende de `duracionMin`: la duración sólo decide si el inicio cabe en el tramo.
- `Persona.ultimaReunionEn` no es una columna de `perfiles`: es el inicio de su última reunión no cancelada y lo arma `infra/`.
