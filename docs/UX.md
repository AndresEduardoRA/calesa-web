# Experiencia

> Generado desde `docs/semilla/semilla.md` (versión 7). No se edita a mano: el cambio va en la semilla, que sube de versión.

Es el contenido de `docs/UX.md`. Tono: español neutro latinoamericano, de tú; frases cortas; primero el dato; mayúscula solo al inicio; sin emojis; Calesa habla como empresa («Calesa te avisa»), nunca en nombre de un asesor (D6, E2, guía de voz del sistema de diseño).

### 6.1 Recorridos

1. **Dueño desde un video (celular)** (D1.1): entra a `/` → lee portada y problemas → «Quiero verlo con mis autos» → `/agendar` paso 1 (formulario + gráfica) → «Elegir día y hora» → paso 2 (calendario en su zona) → elige hora → «Confirmar reunión» → paso 3 «Tu demo está confirmada» con fecha, anfitrión y botón «Agregar a mi calendario» (.ics) → correo de confirmación.
2. **Dueño curioso** (D1.2): `/#calculadora` → llena 5 datos → ve rango → «Agendar demo» → `/agendar?autos=25&adm=3` con esos datos ya cargados; o «Te mando el detalle por correo» → nombre + email + casilla → recibe el detalle.
3. **Prefiere hablar** (D1.3): toca WhatsApp → `/api/whatsapp?p=<pagina>` → abre `wa.me/<numero del vendedor de turno>?text=Hola, vengo de calesa.app y quiero ver una demo con mis autos.`
4. **Agendado cambia o cancela** (D1.4): abre el enlace del correo → `/reunion/<token>` → «Cambiar hora» (mismo calendario) o «Cancelar reunión» (confirma) → correo con el cambio; después de cancelar puede «Elegir otra hora» (R4.16).
5. **Prospecto** (A4): recibe `calesa.app/agendar?ref=GT-02` por WhatsApp → mismo flujo; solo ve horas del vendedor que creó el enlace.
6. **Vendedor** (D1.5): recibe correo «Nueva demo: Importadora X, mar 3 nov 10:00» → entra a `/entrar` con su correo → enlace mágico → `/panel` ve su próxima reunión → después de la reunión marca «Realizada» y escribe una nota.
7. **Admin invita** (B19, R4.14): `/panel/usuarios` → «Invitar vendedor» → nombre y email → la persona recibe «Te invitaron al panel de Calesa» → entra → `/panel/perfil?bienvenida=1` pide WhatsApp y enlace de Meet → el admin la pone «En turno».

### 6.2 Inicio `/` — secciones y textos clave (B2)

Navegación fija: logo integrado · «El sistema» · «Planes» · «Preguntas» · botón «Agendar demo». En celular: menú en hoja inferior. Enlaces internos con desplazamiento suave y transición de vista entre páginas (B1.1).

1. **Portada.** Rótulo `PARA DUEÑOS DE IMPORTADORAS`. Título (display, expandido): «Vende más autos sin perder el control.» (B3). Subtítulo: «El sistema a medida para importadoras que compran en Copart, IAAI, Manheim, Japón, Corea o China y venden por redes y WhatsApp. Ventas, cotizaciones, logística y plata en un solo lugar.» Botones: «Quiero verlo con mis autos» (principal) y «Escribir por WhatsApp». Medio: video del dueño de 12 s en bucle, sin sonido, 4:5 (`public/media/portada.mp4` + `.webm`, ≤ 3 MB) con póster de la maqueta del cotizador; si el archivo no existe se muestra la maqueta animada (E5, X8). Botón «Pausar video» visible.
2. **Problemas** (rótulo `LO QUE TE CUESTA HOY`): «Cada consulta que no contestas es un auto que vende otro.» Seis tarjetas con ilustración lineal de marca: Consultas sin contestar · Cotizaciones en Excel · «¿Dónde está mi auto?» · Autos trabados en aduana · Ganancia a ciegas · El vendedor que se fue (textos de «Ruta Importa», E3).
3. **El sistema** (rótulo `UN SOLO LUGAR`): «Un solo sistema para tu importadora, del lote a la placa.» Cinco bloques alternados texto + maqueta: Reparto de consultas («Ninguna consulta se queda sin dueño.») · Cotizador («Precio puesto en tu ciudad en 30 segundos.») · Logística por fases y portal «Mi vehículo» («Tu cliente ve dónde está su auto sin llamar.») · Señas y saldos («Cada saldo con fecha y aviso.») · Finanzas del dueño («La ganancia de cada auto, al día.»). Las maquetas usan el auto ficticio (SUV 2021, VIN `1XXEJEMPLO0000001`, subasta US$ 9.800, grúa US$ 450, flete US$ 1.650, seguro y gastos US$ 300, seña US$ 2.000) y el rótulo «Ejemplo con datos ficticios» (G3).
4. **Calculadora** (`id="calculadora"`): «¿Cuánto se te escapa al mes?» Formulario de 5 datos a la izquierda, resultado a la derecha (abajo en celular), cifras que cuentan al cambiar (§5.2).
5. **Prueba** (rótulo `YA FUNCIONA`): «Ya funciona en una de las importadoras más grandes de Bolivia: 35 asesores y unos 40 autos al mes.» (A0.2, A2). Sin logo ni nombre.
6. **Planes**: cuatro tarjetas (§5.4) con selector Mensual / Anual y enlace «Ver la tabla completa» → `/planes`.
7. **Cómo empezamos**: 1 Diagnóstico («Conocemos cómo opera tu importadora y armamos la propuesta.») · 2 Firma y anticipo («El trabajo empieza con el anticipo cobrado.») · 3 Configuración («Tus pasos, tus documentos y tu equipo. De 2 a 12 semanas, según el plan.») · 4 Salida en vivo («Tu equipo trabaja con datos reales y firmas el acta de entrega.»).
8. **Quiénes somos**: filas visibles de `equipo` por `orden`: foto, nombre, cargo, frase. Fundador con la frase de A6.
9. **Preguntas frecuentes** (acordeón; JSON-LD FAQPage):
   - «¿Dónde se guardan mis datos?» → «En servidores en la nube, cifrados, con respaldos diarios. Los datos son de tu importadora.» (B21.1)
   - «¿Puedo llevarme mis datos?» → «Sí. Puedes exportar e importar tus datos en archivos CSV cuando quieras.» (B21.2)
   - «¿Aguanta si crecemos?» → «Crece contigo: el mismo sistema sirve con 5 o con 500 autos al mes, sin cambiar de herramienta.» (B21.2)
   - «¿Qué pasa si Calesa deja de existir?» → «Recibes el código actualizado de tu sistema y su documentación. Puedes seguir usándolo, modificarlo y contratar a otro programador para mantenerlo; solo no puedes revenderlo. Queda escrito en tu contrato.» (B21.3)
   - «¿Cuánto dura la demo y cuánto tarda en estar listo?» → «La demo dura 30 minutos. Según el plan, tu sistema funciona en 2, 3 a 4, 4 a 6 u 8 a 12 semanas.» (B21.4)
   - «¿Funciona en mi país?» → «Sí. Configuramos la aduana y los impuestos de tu país.» (B21.5)
   - «¿Cuánto cuesta?» → «Desde US$ 490 al mes más una implementación única. Mira la tabla completa en Planes.»
10. **Cierre**: panel ciruela, «Míralo funcionando con un auto de tu inventario.» + «Agendar demo».
Pie: logo blanco, enlaces (Planes, Agendar demo, Privacidad, Términos), «Responsable: Andrés Eduardo Rosas Alpiri · Santa Cruz de la Sierra, Bolivia · privacidad@getcalesa.com», «Última actualización: <fecha de §6.7>» (C5).

### 6.3 `/planes`

Título «Planes y precios». Selector Mensual / Anual. Cuatro tarjetas (§5.4). Tabla completa (encabezado pegajoso; en celular, desplazamiento horizontal dentro de la tabla con la primera columna fija):
- Montos: cuota mensual, pago anual, ahorro, implementación única.
- Tamaño: autos al mes (hasta 20 / 60 / 150 / más de 150); usuarios (hasta 10 / ilimitados / ilimitados / ilimitados); orígenes de compra (1 / 2 / todos / todos + zona franca); países de destino (1 / 1 / 1 / varios).
- Sistema: vitrina web, reparto de consultas y cotizador (todos); inventario, reservas, señas y saldos (desde Operación); roles, cartera transferible y auditoría (desde Operación); logística por fases con documentos (— / estándar / a medida / a medida por país); portal «Mi vehículo» (— / sí / con tu marca / con tu marca); finanzas del dueño (— / extra / sí / sí, consolidado).
- Servicio: funcionando en (2 / 3–4 / 4–6 / 8–12 semanas); respuesta del soporte (48 h / 24 h / 4 h / 2 h + gerente de cuenta); servidor, mejoras y cambios de impuestos (todos).
Celda incluida: ícono check + texto oculto «Incluido»; no incluida: guion + «No incluido». Pie con los dos textos de §5.4. Botón «Agendar demo».

### 6.4 `/agendar` (B8, B9, C4, D3)

**Paso 1 · Tus datos.** Campos: Nombre · Importadora · País (lista §6.6) · WhatsApp (prefijo según país + número) · Email · Autos que vendes al mes · Autos que quieres vender en 3 meses · Vendedores · Administración y logística · ¿Dónde compras? (casillas Copart, IAAI, Manheim, Japón, Corea, China) · casilla obligatoria «Acepto que Calesa me contacte por WhatsApp y correo. Ver privacidad.» · Turnstile. A la derecha (debajo en celular) la gráfica de §5.3 que se actualiza al escribir. Botón «Elegir día y hora». Debajo: «¿Prefieres escribir? Abrir WhatsApp».
**Paso 2 · Elige día y hora.** Zona detectada con `Intl` y selector «Ver horas en: …». Las horas llegan de `GET /api/horas?semana=AAAA-MM-DD&zona=<IANA>&t=<token>` (R4.20). Semana visible con días con horas disponibles resaltados; al elegir día, lista de horas. Botón «Confirmar reunión».
**Paso 3 · Confirmada.** «Tu demo está confirmada.» Fecha y hora en su zona, «Te atenderá <nombre>», enlace de Meet, «Agregar a mi calendario», «Cambiar o cancelar» (enlace de gestión), «Abrir WhatsApp con <nombre>».
El borrador del paso 1 se guarda en `sessionStorage` (con try/catch) para no perderlo sin conexión o al recargar (D4).

### 6.5 Inventario de pantallas

| Ruta | Rol | Contenido | Acciones | Vacío | Cargando | Error | Sin permiso | Sin conexión |
|---|---|---|---|---|---|---|---|---|
| `/` | todos | §6.2 | agendar, WhatsApp, calculadora, detalle por correo | Equipo sin filas: se oculta la sección | estático (SSG + revalidación 1 h) | calculadora: «No pudimos calcular. Revisa los datos.» | — | banner «Sin conexión. Lo que escribiste no se pierde.»; botones de envío desactivados |
| `/planes` | todos | §6.3 | selector, agendar | — | estático | — | — | banner |
| `/agendar` | todos | §6.4 | enviar, elegir hora, confirmar | «No hay horas libres esta semana. Mira la siguiente.» y, si no hay en 21 días, «Ahora no tenemos horas libres. Escríbenos por WhatsApp.» | esqueleto del calendario | «No pudimos guardar tus datos. Intenta de nuevo.» con «Reintentar»; hora ocupada: «Esa hora se acaba de ocupar. Elige otra.» | token vencido: «El enlace venció. Vuelve a llenar el formulario.»; con `?aviso=sin-whatsapp`: franja «Ahora no hay nadie en WhatsApp. Agenda tu demo aquí.» (R4.10) | banner; borrador en sessionStorage |
| `/reunion/[token]` | visitante con enlace | fecha, anfitrión, Meet, estado | cambiar, cancelar; si está cancelada, «Elegir otra hora» (R4.16) | — | esqueleto | «No pudimos cargar tu reunión.» + reintentar | token inválido: «Este enlace no es válido.»; fuera de plazo: §5.8 | banner |
| `/privacidad`, `/terminos` | todos | borrador aprobado por abogado (§6.7) | — | — | estático | — | — | — |
| `/entrar` | sin sesión | campo email | «Enviarme el enlace» | — | botón con indicador | correo no invitado: mismo mensaje que el éxito («Si tu correo está invitado, te llegó un enlace.») | — | banner |
| `/panel` | vendedor, admin | embudo del mes (admin: `metricas_diarias`; vendedor: `metricas_persona`, R4.4), próximas 5 reuniones, solicitudes sin reunión | ir a detalle | «No tienes reuniones próximas.» | esqueletos | «No pudimos cargar el resumen.» + reintentar | inactivo: «Tu acceso está pausado. Habla con el administrador.» | banner |
| `/panel/solicitudes` | vendedor (suyas), admin (todas) | lista paginada: fecha, nombre, importadora, país, estado, asignado (admin) | filtros por estado y origen; buscar por email (admin); «Cargar más» | «Todavía no hay solicitudes.» | esqueleto de filas | + reintentar | — | banner |
| `/panel/solicitudes/[id]` | dueño de la fila o admin | datos, gráfica guardada, reunión, notas, historial | cambiar estado (§5.7), nota, abrir WhatsApp, reasignar (admin, R4.2), borrar (admin, confirma escribiendo «BORRAR») | sin notas: «Sin notas todavía.» | esqueleto | + reintentar | ajena: «Esta solicitud no está asignada a ti.» | banner; nota sin enviar queda en el campo |
| `/panel/reuniones` | vendedor (suyas), admin | próximas y pasadas, paginadas | marcar realizada / no asistió (vía estado de la solicitud), reagendar (solo sus horas), cancelar (R4.1) | «No hay reuniones.» | esqueleto | + reintentar | — | banner |
| `/panel/disponibilidad` | vendedor (sus bloqueos), admin (horario común, reglas, bloqueos de todos) | calendario semanal | crear y borrar bloqueos; admin edita horario y reglas | «Sin bloqueos.» | esqueleto | + reintentar | vendedor en horario común: no se muestra | banner |
| `/panel/perfil` | vendedor, admin | nombre, email (solo lectura), WhatsApp, enlace de Meet | guardar; si cambia el Meet y tiene reuniones futuras, confirma «Avisaremos a N visitantes del nuevo enlace.» (R4.21) | — | — | validación por campo | — | banner |
| `/panel/prospeccion` | vendedor (suyos), admin | enlaces con código, etiqueta, solicitudes que trajo | crear, copiar, desactivar | «Crea tu primer enlace para un prospecto.» | esqueleto | código repetido: «Ese código ya existe.» | — | banner |
| `/panel/equipo` | admin | filas del equipo | crear, editar, subir foto (jpg/png/webp ≤ 2 MB), ordenar, ocultar, borrar | «Agrega a tu equipo.» | esqueleto | foto inválida: «La foto debe ser JPG, PNG o WebP de hasta 2 MB.» | vendedor: «Solo el administrador edita esta sección.» | banner |
| `/panel/calculadora` | admin | los 9 datos de `config_calculadora` con ayuda y el ejemplo 1 recalculado en vivo | guardar | — | — | validación por campo | vendedor: igual que arriba | banner |
| `/panel/usuarios` | admin | usuarios e invitaciones | invitar (nombre y email), reenviar invitación, revocar, poner/quitar en turno, desactivar/activar (R4.3) | «Invita a tu primer vendedor.» | esqueleto | email ya invitado: «Ya hay una invitación para ese correo.» | vendedor: igual que arriba | banner |
| `/panel/actividad` | admin | auditoría paginada y correos fallidos | reintentar correo | «Sin actividad.» | esqueleto | + reintentar | vendedor: igual que arriba | banner |
| 404 / error | todos | «No encontramos esta página.» / «Algo salió mal.» | volver al inicio | — | — | — | — | — |

Banner de tareas detenidas: si `latidos.diario.ultimo_ok` tiene más de 26 h, el admin ve «La tarea diaria no corre desde <fecha>.» (R4.22). Banner de cupos: si R5.2 detectó más del 80 % del plan gratis, «Te acercas al límite gratis de <base o correos>.» Banner de correos fallidos: si hay `correos_salientes` con `estado = fallido`, el admin ve en todo el panel «Hay N correos que no se pudieron enviar. Revisar.» (N con tope «más de 9»).

### 6.6 Listas fijas

**Países** (código, nombre, prefijo, zona por defecto): AR Argentina +54 America/Argentina/Buenos_Aires · BO Bolivia +591 America/La_Paz · CL Chile +56 America/Santiago · CO Colombia +57 America/Bogota · CR Costa Rica +506 America/Costa_Rica · EC Ecuador +593 America/Guayaquil · SV El Salvador +503 America/El_Salvador · GT Guatemala +502 America/Guatemala · HN Honduras +504 America/Tegucigalpa · MX México +52 America/Mexico_City · NI Nicaragua +505 America/Managua · PA Panamá +507 America/Panama · PY Paraguay +595 America/Asuncion · PE Perú +51 America/Lima · PR Puerto Rico +1 America/Puerto_Rico · DO República Dominicana +1 America/Santo_Domingo · UY Uruguay +598 America/Montevideo · VE Venezuela +58 America/Caracas · US Estados Unidos +1 America/New_York · XX Otro país (prefijo libre) zona detectada.
**Zonas del selector**: las de la lista anterior sin repetir, más la detectada si no está en la lista; se acepta cualquier zona IANA válida según `Intl.supportedValuesOf('timeZone')` (R4.13).

### 6.7 Textos legales (C5, H2)

`/privacidad` y `/terminos` se escriben como borrador con los títulos: responsable (Andrés Eduardo Rosas Alpiri, Santa Cruz de la Sierra, Bolivia, mientras Calesa no tenga razón social), correo de privacidad, datos que se recogen (§3), para qué, base (consentimiento de la casilla), cuánto tiempo (24 meses), con quién se comparten (proveedores de infraestructura y correo, sin nombrarlos por marca en la página), derechos y cómo pedir el borrado, cambios en la política, fecha de última actualización. Términos: uso del sitio, precios informativos sin impuestos, la propuesta y el contrato mandan, ley y tribunales de Bolivia. **No se publican en producción hasta que el abogado apruebe** y confirme si la dirección completa del responsable debe figurar (paso P19, rojo). Mientras tanto, en pruebas llevan la franja «Borrador: revisar con abogado».

### 6.8 Notificaciones

Todas salen de `EMAIL_REMITENTE`, en español, con logo, sin emojis. Las de evento salen en el momento; `recordatorio-24h`, `recordatorio-1h` y `solicitud-sin-reunion` (de formulario o prospección) se programan en Resend (X6). Las plantillas con identificador son de React Email (P07, 12 en total); invitación y enlace de acceso son plantillas de Supabase Auth enviadas por el SMTP de Resend (X9, R4.11).
| Plantilla | Evento | Para | Asunto |
|---|---|---|---|
| `reunion-confirmada` | Reunión reservada | visitante (+ .ics REQUEST) | «Tu demo con Calesa: mar 3 nov, 10:00» |
| `reunion-nueva-anfitrion` | Reunión reservada o recibida por reasignación | anfitrión | «Nueva demo: <importadora>, mar 3 nov, 10:00» |
| `reunion-cambiada` | Cambio de hora o de anfitrión (reagenda, reasignación, desactivación) | visitante (.ics, secuencia + 1) | «Cambió tu demo con Calesa: <nueva fecha>» |
| `reunion-cambiada-equipo` | El mismo cambio | anfitrión nuevo y anterior | «Cambio de demo: <importadora>» |
| `reunion-cancelada` | Cancelación (visitante, vendedor o admin) | visitante (.ics CANCEL) y anfitrión | «Se canceló tu demo con Calesa» |
| `recordatorio-24h` | 24 h antes | visitante | «Mañana es tu demo con Calesa» |
| `recordatorio-1h` | 1 h antes | visitante y anfitrión | «Tu demo con Calesa empieza en 1 hora» |
| `meet-cambiado` | El anfitrión cambió su enlace (R4.21) | visitante | «Cambió el enlace de tu demo con Calesa» |
| `detalle-calculadora` | Pidió el detalle (R4.18) | visitante | «Lo que se te escapa al mes: tu detalle» |
| `solicitud-sin-reunion` | 15 min sin reunión o solicitud de calculadora | asignado | «Nueva solicitud sin reunión: <importadora o nombre>» |
| `aviso-equipo` | Toda solicitud nueva y todo cambio o cancelación de reunión (B17) | `EMAIL_AVISOS` | «[Calesa] <tipo>: <importadora o nombre>» |
| `correo-fallido` | Un correo quedó `fallido` | `EMAIL_AVISOS` | «[Calesa] No se pudo enviar un correo» |
| (Supabase) | Invitación | invitado | «Te invitaron al panel de Calesa» |
| (Supabase) | Enlace de acceso | usuario | «Tu enlace para entrar a Calesa» |

`detalle-calculadora` lleva: los 5 datos ingresados, el rango y el mínimo, las 6 filas con mínimo y máximo, las horas, los datos del panel usados, un resumen de «cómo se calculó» en tres frases y el botón «Agendar demo» a `/agendar` con los datos cargados.

### 6.9 Microcopy

Botones: «Quiero verlo con mis autos», «Agendar demo», «Escribir por WhatsApp», «Elegir día y hora», «Confirmar reunión», «Cambiar hora», «Cancelar reunión», «Agregar a mi calendario», «Te mando el detalle por correo», «Enviarme el enlace», «Guardar», «Cargar más». Errores de campo: «Escribe tu nombre.», «Ese correo no parece válido.», «Revisa el número de WhatsApp.», «Marca la casilla para que podamos contactarte.», «Elige al menos un lugar donde compras.» Confirmaciones: «Guardado.», «Enlace copiado.», «Te enviamos el detalle a <email>.»

### 6.10 Accesibilidad y movimiento (D5, E7, B1.1)

WCAG 2.1 AA: contraste medido (§8); todo con teclado y foco visible (anillo 2 px `foco`, separación 2 px); áreas táctiles ≥ 44 px; etiquetas visibles en todos los campos; errores anunciados con `aria-live`; gráficas con tabla equivalente oculta para lectores; estados con ícono + palabra. Movimiento: entradas de 8–12 cuadros (≈ 300 ms) con desaceleración, sin rebotes; cifras que cuentan en 650 ms; transiciones de página con View Transitions; con `prefers-reduced-motion: reduce` todo se muestra sin animación y el video queda en póster.
