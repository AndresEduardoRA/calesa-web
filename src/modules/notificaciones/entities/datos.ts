// Los datos de cada plantilla (§6.8), validados con Zod: lo que no valida no se manda ni se registra. camelCase; ids `z.guid()`; instantes ISO con
// zona; enlaces sólo http(s); todo texto de la persona con tope de largo y sin caracteres de control (§4).
import { z } from 'zod'

export const PLANTILLAS = [
  'reunion-confirmada',
  'reunion-nueva-anfitrion',
  'reunion-cambiada',
  'reunion-cambiada-equipo',
  'reunion-cancelada',
  'recordatorio-24h',
  'recordatorio-1h',
  'meet-cambiado',
  'detalle-calculadora',
  'solicitud-sin-reunion',
  'aviso-equipo',
  'correo-fallido',
] as const

export type Plantilla = (typeof PLANTILLAS)[number]

const LARGO_NOMBRE = 200
const LARGO_TEXTO = 500

function sinControl(valor: string): boolean {
  return !Array.from(valor).some((c) => {
    const codigo = c.charCodeAt(0)
    return codigo < 32 || codigo === 127
  })
}

const texto = (maximo: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maximo)
    .refine(sinControl, { error: 'No admite caracteres de control.' })
const nombre = texto(LARGO_NOMBRE)
const frase = texto(LARGO_TEXTO)
const guid = z.guid()
const instante = z.iso.datetime({ offset: true })
const enlace = z.url({ protocol: /^https?$/ })
const correo = z.email()
const zona = z.string().refine(
  (valor) => {
    try {
      new Intl.DateTimeFormat('es', { timeZone: valor })
      return true
    } catch {
      return false
    }
  },
  { error: 'Zona horaria desconocida.' },
)

export const esquemaReunion = z.object({
  reunionId: guid,
  solicitudId: guid,
  inicio: instante,
  fin: instante,
  zonaVisitante: zona,
  enlaceMeet: enlace,
  secuencia: z.number().int().min(0),
  visitante: z.object({ nombre, email: correo }),
  importadora: nombre.nullable(),
  anfitrion: z.object({ id: guid, nombre, email: correo }),
})
export type Reunion = z.infer<typeof esquemaReunion>

const reunion = esquemaReunion.shape
const de = <T extends Plantilla>(plantilla: T) => z.literal(plantilla)
const etiquetaYValor = z.object({ etiqueta: nombre, valor: frase })
const monto = z.number().finite().min(0)

export const esquemaDatos = z.discriminatedUnion('plantilla', [
  z.object({
    plantilla: de('reunion-confirmada'),
    reunion: z.object(reunion),
    // Opcional: un correo que se vuelve a armar desde el registro sale sin él (no se guarda, ver `datosParaGuardar`).
    enlaceGestion: enlace.optional(),
  }),
  z.object({
    plantilla: de('reunion-nueva-anfitrion'),
    reunion: z.object(reunion),
    motivo: z.enum(['reserva', 'reasignacion']),
  }),
  z.object({
    plantilla: de('reunion-cambiada'),
    reunion: z.object(reunion),
    inicioAnterior: instante,
    enlaceGestion: enlace.optional(),
  }),
  z.object({
    plantilla: de('reunion-cambiada-equipo'),
    reunion: z.object(reunion),
    inicioAnterior: instante,
    anfitrionAnterior: z.object({ nombre }).optional(),
    destinatario: z.enum(['nuevo', 'anterior']),
    motivo: z.enum(['reagenda', 'reasignacion', 'desactivacion']),
  }),
  z.object({
    plantilla: de('reunion-cancelada'),
    reunion: z.object(reunion),
    destinatario: z.enum(['visitante', 'anfitrion']),
    canceladaPor: z.enum(['visitante', 'equipo']),
  }),
  z.object({
    plantilla: de('recordatorio-24h'),
    reunion: z.object(reunion),
    enlaceGestion: enlace.optional(),
  }),
  z.object({
    plantilla: de('recordatorio-1h'),
    reunion: z.object(reunion),
    destinatario: z.enum(['visitante', 'anfitrion']),
  }),
  z.object({ plantilla: de('meet-cambiado'), reunion: z.object(reunion), cambioEn: instante }),
  z.object({
    plantilla: de('detalle-calculadora'),
    solicitudId: guid,
    nombre,
    // Texto ya formateado por quien llama (con `formato.ts`): el módulo no conoce la calculadora.
    entradas: z.array(etiquetaYValor).length(5),
    rango: z.object({ minimo: monto, maximo: monto }),
    filas: z.array(z.object({ nombre, minimo: monto, maximo: monto })).length(6),
    horas: monto,
    datosPanel: z.array(etiquetaYValor).max(20),
    resumen: z.array(frase).length(3),
    enlaceAgendar: enlace,
    pedidoEn: instante,
  }),
  z.object({
    plantilla: de('solicitud-sin-reunion'),
    solicitudId: guid,
    nombre,
    importadora: nombre.optional(),
    origen: z.enum(['formulario', 'prospeccion', 'calculadora']),
    creadaEn: instante,
  }),
  z.object({
    plantilla: de('aviso-equipo'),
    tipo: z.enum(['solicitud-nueva', 'reunion-cambiada', 'reunion-cancelada']),
    solicitudId: guid,
    nombre,
    importadora: nombre.optional(),
    inicio: instante.optional(),
    ocurridoEn: instante,
  }),
  z.object({
    plantilla: de('correo-fallido'),
    correoId: guid,
    plantillaFallida: z.enum(PLANTILLAS),
    paraFallido: texto(320),
    ultimoError: frase,
    intentos: z.number().int().min(0),
    // Se copian de la fila que falló: el borrado de datos de una solicitud (R4.17) también vacía este aviso.
    reunionId: guid.optional(),
    solicitudId: guid.optional(),
  }),
])

export type DatosDeCorreo = z.infer<typeof esquemaDatos>
export type DatosDe<P extends Plantilla> = Extract<DatosDeCorreo, { plantilla: P }>

// Las plantillas del equipo salen siempre a `EMAIL_AVISOS`; las demás, a quien llama.
export function esParaElEquipo(plantilla: Plantilla): boolean {
  return plantilla === 'aviso-equipo' || plantilla === 'correo-fallido'
}

// Los ids con que se registra el correo (`reunion_id`, `solicitud_id`), según la plantilla.
export function idsDe(datos: DatosDeCorreo): {
  reunionId: string | null
  solicitudId: string | null
} {
  if ('reunion' in datos)
    return { reunionId: datos.reunion.reunionId, solicitudId: datos.reunion.solicitudId }
  if (datos.plantilla === 'correo-fallido')
    return { reunionId: datos.reunionId ?? null, solicitudId: datos.solicitudId ?? null }
  return { reunionId: null, solicitudId: datos.solicitudId }
}

// Lo que se guarda en `correos_salientes.datos`: nunca el enlace de gestión (lleva el token en claro; la base sólo guarda su hash).
export function datosParaGuardar(datos: DatosDeCorreo): Record<string, unknown> {
  if ('enlaceGestion' in datos) {
    const { enlaceGestion: _quitado, ...resto } = datos
    return resto
  }
  return { ...datos }
}
