# P01 · Decisiones

Fecha: 2026-10-31 (America/La_Paz). El plan, auditado en dos rondas, lo aprobó la persona en la compuerta `datos` («aprobar»). No hubo
autoelecciones ámbar.

## Partición del paso

El `terminado` de P01 junta unas 11 intenciones en capas con verificación distinta (lib pura, layout, seguridad, workflows con compuerta
`guardas`, interfaz) y no cabía en 3 commits de código. **P01 hizo sólo la primera parte:** entorno de §4, correo por Resend y formato US$
(todo en `src/shared/config` y `src/shared/lib`, nivel 2 por `src/shared`, sin interfaz). Se proponen al coordinador, todos en el carril
`base`:

| Paso | Qué hace                                                                                                                                                                    | Riesgo                                       | Depende de |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ---------- |
| P22  | Layout: Archivo y JetBrains Mono con `next/font`, tema «system» con `.dark` (ya está), `@vercel/analytics` (si se aprueba su dependencia), CSP y cabeceras de §4, `noindex` | rojo                                         | P01        |
| P23  | `DONDE_SE_PERMITE_EL_ADMIN` con las rutas de §9.1, `respaldo-diario.yml` y `restauracion-semanal.yml` (X13)                                                                 | rojo; dispara la compuerta `guardas`         | P01, P02   |
| P24  | Componentes de §8.5 en `src/shared/ui` (sonner para avisos, el monto con `formatoUSD`)                                                                                      | rojo (código compartido, `compuertas_rojas`) | P01, P22   |
| P25  | Logos en `public/marca` e íconos del manifest                                                                                                                               | ámbar, pero su pregunta espera a la persona  | P01        |

- P22 y P24 se suman a las dependencias de los pasos con pantallas (P08, P09, P10, P11, P14, P15, P16, P17, P20 y P21); P23 a P11, P12,
  P13 y P19; P25 a P08 y P17. P23 va después de P02 porque la restauración semanal comprueba sus tablas.
- Quedan abiertas, para esos pasos: **`@vercel/analytics`** no está en `package.json` (dependencia nueva de P22, con la versión que dé npm
  el día que se instale), y **los logos** no están en el repo (P25: alguien tiene que entregarlos). La persona aprobó el plan sin
  contestarlas.
- Notas para sus planificadores: P22 va sin nonces en la CSP (con nonces las páginas públicas pasan a render dinámico); `next/font/google`
  baja las fuentes al compilar. En P23, `age -p` pide una terminal, así que en CI hace falta un par destinatario/identidad. P14 va a
  necesitar el cliente admin en `acceso/infra`, que no está en §9.1: será una compuerta `afuera` hacia `base`.

## Entorno

- **Lo de Calesa es obligatorio sólo en Vercel** (`VERCEL_ENV=preview|production`). Fuera de Vercel sólo se revisa su formato. Si se
  exigiera también ahí, se romperían `env:check local`, el `.env.local` que arma cada carril y el build de CI, que hoy traen sólo las tres
  variables del kit.
- **Todas en una vuelta.** La exigencia de Vercel es un `superRefine(…, { when: () => true })`. Sin `when`, Zod 4 la salta si el objeto
  ya falló, y `env:check` nombraría de a una por vuelta. Como le puede llegar un objeto a medio validar, lee cada valor como `unknown`.
- **`problemasDe()` da un problema por variable**, el primero. Un valor de puros espacios fallaba dos veces: por su formato (`falta`) y por
  la regla de Vercel.
- **`EMAIL_REMITENTE` y `EMAIL_REMITENTE_NOMBRE` también van en la lista de Vercel.** El kit los exige con un proveedor, pero su regla no
  corre si el objeto ya falló.
- **En Vercel el proveedor es `resend`** («en Vercel es resend»). `EMAIL_PROVEEDOR=resend` exige `RESEND_API_KEY` en cualquier entorno.
- **`EMAIL_AVISOS` y `EMAIL_PRIVACIDAD` tienen valor por defecto**: `equipo@getcalesa.com` y `privacidad@getcalesa.com` (F4). El remitente
  del ejemplo pasa a `hola@getcalesa.com` / «Calesa» (§4).
- **`RESPALDO_DB_URL` y `RESPALDO_CLAVE` no van en el esquema de la app**: son secretos de GitHub Actions y los declara P23.
- **`LEGAL_APROBADO`** (`si`/`no`) sólo se declara; que el build de producción caiga sin `si` es de P10.
- **`ADMIN_EMAIL`**: el ejemplo es `admin@ejemplo.com`. La cuenta real (X14) se carga sólo en Vercel y el repo no la repite.
- **`urlDelSitio(respaldo?)`** en vez de exigir `NEXT_PUBLIC_SITIO_URL` fuera de Vercel. §4 la pide en «todos» los entornos, pero CI y los
  carriles no la tienen.
  - Con la variable, devuelve la variable.
  - Sin ella y fuera de Vercel, devuelve el respaldo (el origen del pedido, para que el e2e apunte al puerto del carril) o
    `http://localhost:3000`.
  - **En Vercel nunca usa el respaldo**, porque sale de la cabecera Host, que manda el cliente: sin la variable, lanza. En producción la
    variable tiene que ser `https://`.
  - Recibe el entorno como parámetro (por defecto `entornoPublico()`), así que los tests no dependen del caché.

## Correo por Resend

- **Por `fetch`, sin el SDK.** El lint del kit prohíbe `resend` y `@react-email/*` (`NINGUN_SDK_DE_CORREO`), aunque el frontmatter de la
  semilla los liste. Por X17 manda el kit.
- **El archivo es `adaptadores/resend-api.ts`, no `resend.ts`.** El patrón `resend` de esa regla también atrapa un import local llamado
  `./resend`. Se cambió el nombre en vez de tocar la regla.
- **API contrastada con la documentación de Resend el 2026-10-31 (S1):**
  - Enviar: <https://resend.com/docs/api-reference/emails/send-email>. `POST /emails` responde `{ id }`; `to` admite hasta 50; las
    etiquetas sólo admiten `[A-Za-z0-9_-]`.
  - Actualizar: <https://resend.com/docs/api-reference/emails/update-email>. `PATCH /emails/{id}` con `{ scheduled_at }` responde
    `{ object, id }`.
  - Cancelar: <https://resend.com/docs/api-reference/emails/cancel-email>. `POST /emails/{id}/cancel` sin cuerpo responde `{ object, id }`.
  - Idempotencia: <https://resend.com/docs/dashboard/emails/idempotency-keys>. La misma clave con el mismo cuerpo da la misma respuesta,
    sin reenviar. Con otro cuerpo da `409 invalid_idempotent_request`, y con un pedido igual en curso, `409
concurrent_idempotent_requests`. La clave vive 24 h y mide de 1 a 256 caracteres; sólo la aceptan los envíos, no `PATCH` ni `cancel`.
  - Programar: <https://resend.com/docs/dashboard/emails/schedule-email>. **Hasta 30 días** adelante (confirma lo que suponen X6 y §5.8);
    un correo cancelado no se puede reprogramar.
  - Errores: <https://resend.com/docs/api-reference/errors> e <https://resend.com/docs/api-reference/introduction>.
- **C10, rehecha desde la tabla oficial:**
  - Cada status lleva su `name` en el mensaje, que es un código fijo (`daily_quota_exceeded`).
  - El `message` de la respuesta nunca va, porque puede traer direcciones. Tampoco un `name` que no tenga forma de código.
  - 400 y 422 dan `validacion`; 401 y 403 (clave restringida, dominio sin verificar), `inesperado`; 404, `no_encontrado`; 409, `conflicto`;
    429 (por segundo o cuota diaria o mensual), `inesperado`; cualquier otro status, `inesperado` con su status.
  - **El 451 no está en la documentación**, así que no lleva fila propia: cae en «otro status».
  - La documentación no muestra el cuerpo de un error. Los fakes lo arman con el `name` y el `message` documentados.
- **`RESEND_API_KEY` con «Full access»:** una clave restringida a enviar devuelve `401 restricted_api_key` al cancelar o reprogramar.
  `.env.example` lo dice.
- **Las etiquetas cambian `.` por `_`**: Resend no admite el punto y el contrato del kit sí.
- **Mailpit no programa:** `programarEmail`, `cancelarEmail` y `reprogramarEmail` dan `regla` sin red con Mailpit o `ninguno`, y
  `programaCorreos()` es `false`. En local, P07 registra lo programado en `correos_salientes` y lo manda a su hora.
- **Nota para P07 (referencias e idempotencia):** una referencia por cuerpo (`recordatorio24:<reunion>`). Cambiar la hora va por
  `reprogramarEmail` (`PATCH`, sin clave), nunca creando otro correo con la misma referencia. En el correo, `conflicto` (el 409) significa
  «la referencia ya tiene otro cuerpo, hay un pedido igual en curso u otro está cambiando ese correo». No es el «Recargar» de una pantalla
  (`src/shared/lib/errores.ts:7`): ese error no llega a una UI, lo trata P07. La clave dura 24 h.
- **Nota para P07 (React Email y el escape):** §6.8 pide plantillas de React Email, pero el lint lo prohíbe. Se pierde el escape del que
  depende el modelo de amenazas («los correos usan React Email (escapa)», semilla §4). P07 necesita otro escape, con pruebas que metan
  `<script>`, `"`, `&` y `'` en cada dato de la persona y comprueben que salen escapados en `html` y tal cual en `texto`:
  - `renderToStaticMarkup` de `react-dom/server`;
  - o un `escaparHtml()` propio.

## Formato US$

- **`formatoUSD` concatena «US$ » y choca con la cabecera del kit** (`formato.ts`: «nunca … concatenar símbolos»). Lo pide §5.1, porque
  `Intl` en `es-BO` escribe «USD». Por X17 se dice aquí, y la cabecera del archivo nombra la excepción.
- Va un espacio normal (U+0020) después de `US$`, como en los ejemplos de §5.1, y no el espacio duro de `Intl`. El rango usa la raya `–`
  (U+2013) entre espacios y no reordena los montos.
- **Negativos: la semilla no los define.** `-1234.5` da `-US$ 1.235`: `halfExpand` redondea la mitad alejándose de cero, simétrico al
  positivo. `-0.4` da `US$ 0`, nunca «-0». Lo que no es finito da `—`.
