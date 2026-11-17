import { z } from 'zod'

import type { Resultado } from '../errores'

// Un archivo adjunto (el .ics de una reunión, por ejemplo). El contenido viaja en base64 para cruzar JSON y el registro de correos
// sin cambios. Los topes dejan el correo muy por debajo de los 40 MB de Resend y de los 25 MB que aceptan los buzones comunes.
const MAX_ADJUNTOS = 5
const MAX_BYTES_POR_ADJUNTO = 5 * 1024 * 1024
// Letras, números, espacio, `.`, `_`, `-` y paréntesis: ninguna ruta, ninguna barra y ningún salto de línea que se cuele a una cabecera.
const NOMBRE_DE_ADJUNTO = /^[\p{L}\p{N}][\p{L}\p{N} ._()-]{0,149}$/u
// `tipo/subtipo` con parámetros opcionales (`text/calendar; method=REQUEST`), en una sola línea.
const TIPO_MIME = /^[a-z]+\/[a-z0-9.+-]+(?:; ?[a-z-]+=[A-Za-z0-9._-]+)*$/i

export const esquemaDeAdjunto = z.object({
  nombre: z.string().regex(NOMBRE_DE_ADJUNTO),
  tipo: z.string().max(100).regex(TIPO_MIME),
  contenido: z
    .base64()
    .min(1)
    .max(Math.ceil(MAX_BYTES_POR_ADJUNTO / 3) * 4)
    .refine((base64) => Buffer.byteLength(base64, 'base64') <= MAX_BYTES_POR_ADJUNTO),
})

// El contrato de un correo que manda la app, el mismo para todo proveedor. Las plantillas viven en el repo (en código) y llegan
// aquí ya como `html` y `texto`: nada se guarda en el panel de un proveedor, ni se usan sus audiencias, broadcasts o plantillas.
export const esquemaDeMensaje = z.object({
  para: z.union([z.email(), z.array(z.email()).min(1).max(50)]),
  asunto: z.string().trim().min(1).max(200),
  html: z.string().min(1),
  texto: z.string().trim().min(1),
  adjuntos: z.array(esquemaDeAdjunto).max(MAX_ADJUNTOS).optional(),
  // Para buscar o agrupar en el proveedor (`tipo: invitacion`): claves y valores cortos, sin datos de personas.
  etiquetas: z
    .record(z.string().regex(/^[a-z0-9_-]{1,40}$/), z.string().regex(/^[a-zA-Z0-9_.-]{1,80}$/))
    .optional(),
  // La clave de idempotencia (`recordatorio24:<reunion>`): el proveedor no manda dos veces el mismo correo con la misma
  // referencia. Una referencia por cuerpo: el mismo con otro cuerpo es un `conflicto`. Mailpit la ignora.
  referencia: z
    .string()
    .regex(/^[A-Za-z0-9_:.-]{1,256}$/)
    .optional(),
})

// Cuándo sale un correo programado: ISO 8601 con zona (`2026-11-05T14:00:00-04:00`), nunca una hora sin zona.
export const esquemaDeCuando = z.iso.datetime({ offset: true })
// El id que devolvió el proveedor al programarlo (Resend: un UUID).
export const esquemaDeIdDeEmail = z.guid()

export type AdjuntoDeEmail = z.infer<typeof esquemaDeAdjunto>
export type MensajeDeEmail = z.infer<typeof esquemaDeMensaje>
export type Remitente = { email: string; nombre: string }
export type EnvioDeEmail = { id: string }

// Un adaptador por proveedor, por su API REST: recibe el mensaje ya validado y el remitente de la configuración.
export type AdaptadorDeEmail = (
  mensaje: MensajeDeEmail,
  remitente: Remitente,
) => Promise<Resultado<EnvioDeEmail>>

export const destinatarios = (para: MensajeDeEmail['para']): string[] =>
  Array.isArray(para) ? [...para] : [para]
