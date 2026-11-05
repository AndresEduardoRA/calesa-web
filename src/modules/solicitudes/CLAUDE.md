# solicitudes

Estados de la solicitud (§5.7) y juntar repetidas (R4.5); por ahora sólo reglas puras.

## Entra y sale

- Entra: nada. Desde P11 depende de `agenda` y `notificaciones` (§9.2); hoy, de ningún módulo. Sus `entities` no importan `agenda`: el efecto en la reunión es una unión local (`EfectoEnReunion`).
- Sale (`index.ts`): `ESTADOS_SOLICITUD`, `esquemaEstadoSolicitud`, `transicionPermitida`, `estadosPosibles`, `CAMBIO_NO_PERMITIDO`, `juntarSolicitud`, `VENTANA_REPETIDAS_DIAS`, los schemas de campos y sus tipos.
- Tablas: `solicitudes`, `notas`.

## Archivos clave

- `entities/estados.ts` — la tabla de §5.7 como datos: `transicionPermitida` dice `{ ok, reunion }` o «Ese cambio de estado no está permitido.»; `estadosPosibles` lista los destinos que ofrece el detalle del panel.
- `entities/repetidas.ts` — `juntarSolicitud`: si el correo tiene una solicitud `nueva` o `agendada` de los últimos 30 días, devuelve `{ tipo: 'juntar', id, cambios }`; si no, `{ tipo: 'crear' }`.

## No se rompe

- La autoridad de las transiciones es el trigger `before update` de P05 (R4.7); estas funciones repiten su tabla. Si cambia una, cambia la otra.
- Juntar nunca pisa un campo con valor, nunca cambia `origen`, `estado`, `asignado_a` ni `creadoEn`, y mantiene `autosMeta ≥ autosHoy`.
- La ventana de 30 días incluye su borde; el correo se compara sin mayúsculas ni espacios de borde (es `citext`).
- «Después del inicio» es `ahora ≥ inicio` de la reunión, comparando instantes.

## Ojo

- `Actor` sale del servidor o de `puede(permisos, 'solicitudes.estado', alcance)` (`propio` o `todos`); nunca de `if (rol === …)` en la interfaz. Quién puede tocar qué solicitud lo dicen `puede()` y la RLS, no `transicionPermitida`.
- `agendada → nueva` sólo la hace el servidor: el panel cancela por `cancelar_reunion`, que actúa como servidor.
- Asignar una solicitud nueva (§5.6) no está aquí: lo hace `crear_o_juntar_solicitud` en P05.
