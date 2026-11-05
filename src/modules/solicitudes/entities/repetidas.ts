// Solicitud repetida (R4.5, §5.6): el mismo correo con una solicitud abierta de los últimos 30 días
// se junta con ella en vez de crear otra. Puro: recibe las solicitudes del correo y dice qué hacer.
import { z } from 'zod'
import { esquemaEstadoSolicitud } from './estados'

export const VENTANA_REPETIDAS_DIAS = 30
const MS_POR_DIA = 86_400_000

const entero = (min: number, max: number) => z.number().int().min(min).max(max).nullable()
const texto = (max: number) => z.string().min(1).max(max).nullable()

export const esquemaCamposSolicitud = z.object({
  importadora: z.string().min(2).max(120).nullable(),
  pais: z
    .string()
    .regex(/^[A-Z]{2}$/, { error: 'Elige un país de la lista.' })
    .nullable(),
  whatsapp: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/, { error: 'Escribe el WhatsApp con el prefijo del país.' })
    .nullable(),
  autosHoy: entero(1, 2000),
  autosMeta: entero(1, 5000),
  vendedores: entero(1, 500),
  administracion: entero(1, 500),
  origenes: z.array(z.enum(['copart', 'iaai', 'manheim', 'japon', 'corea', 'china'])),
  calcMargen: entero(100, 30000),
  calcConsultas: entero(10, 5000),
  calcRespuesta: z.enum(['h1', 'h4', 'dia', 'sig']).nullable(),
  refCodigo: texto(20),
  utmSource: texto(100),
  utmMedium: texto(100),
  utmCampaign: texto(100),
  utmTerm: texto(100),
  utmContent: texto(100),
  paginaOrigen: texto(200),
})

export const esquemaSolicitudAbierta = esquemaCamposSolicitud.extend({
  id: z.guid(),
  email: z.string(),
  estado: esquemaEstadoSolicitud,
  origen: z.enum(['formulario', 'calculadora', 'prospeccion']),
  creadoEn: z.iso.datetime({ offset: true }),
})

export type CamposSolicitud = z.infer<typeof esquemaCamposSolicitud>
export type SolicitudAbierta = z.infer<typeof esquemaSolicitudAbierta>

export type ResultadoJuntar =
  { tipo: 'crear' } | { tipo: 'juntar'; id: string; cambios: Partial<CamposSolicitud> }

// Campos que se llenan sólo si estaban vacíos. Los demás tienen su propia regla.
const CAMPOS_SIMPLES = [
  'importadora',
  'pais',
  'whatsapp',
  'vendedores',
  'administracion',
  'calcMargen',
  'calcConsultas',
  'calcRespuesta',
  'refCodigo',
  'utmSource',
  'utmMedium',
  'utmCampaign',
  'utmTerm',
  'utmContent',
  'paginaOrigen',
] as const

function llenarVacios(
  existente: CamposSolicitud,
  nuevos: CamposSolicitud,
): Partial<CamposSolicitud> {
  const cambios: Partial<CamposSolicitud> = {}
  for (const clave of CAMPOS_SIMPLES) {
    const valor = nuevos[clave]
    if (existente[clave] === null && valor !== null) {
      Object.assign(cambios, { [clave]: valor })
    }
  }
  return cambios
}

// El par de autos se junta entero para no romper `autos_meta >= autos_hoy`: nada se pisa y no
// entra un valor que dejaría la meta por debajo de los autos de hoy.
function cambiosDeAutos(
  existente: CamposSolicitud,
  nuevos: CamposSolicitud,
): Partial<CamposSolicitud> {
  const hoy = existente.autosHoy ?? nuevos.autosHoy
  const meta = existente.autosMeta ?? nuevos.autosMeta
  if (hoy !== null && meta !== null && meta < hoy) {
    return {}
  }
  const cambios: Partial<CamposSolicitud> = {}
  if (existente.autosHoy === null && nuevos.autosHoy !== null) {
    cambios.autosHoy = nuevos.autosHoy
  }
  if (existente.autosMeta === null && nuevos.autosMeta !== null) {
    cambios.autosMeta = nuevos.autosMeta
  }
  return cambios
}

function cambiosDeOrigenes(
  existente: CamposSolicitud,
  nuevos: CamposSolicitud,
): Partial<CamposSolicitud> {
  const faltan = nuevos.origenes.filter(
    (o, i, todos) => !existente.origenes.includes(o) && todos.indexOf(o) === i,
  )
  return faltan.length > 0 ? { origenes: [...existente.origenes, ...faltan] } : {}
}

const normalizar = (email: string): string => email.trim().toLowerCase()

export function juntarSolicitud(entrada: {
  ahora: string
  email: string
  campos: CamposSolicitud
  existentes: SolicitudAbierta[]
}): ResultadoJuntar {
  const desde = Date.parse(entrada.ahora) - VENTANA_REPETIDAS_DIAS * MS_POR_DIA
  const [elegida] = entrada.existentes
    .filter(
      (s) =>
        normalizar(s.email) === normalizar(entrada.email) &&
        (s.estado === 'nueva' || s.estado === 'agendada') &&
        Date.parse(s.creadoEn) >= desde,
    )
    .sort((a, b) => Date.parse(b.creadoEn) - Date.parse(a.creadoEn))
  if (!elegida) {
    return { tipo: 'crear' }
  }
  return {
    tipo: 'juntar',
    id: elegida.id,
    cambios: {
      ...llenarVacios(elegida, entrada.campos),
      ...cambiosDeAutos(elegida, entrada.campos),
      ...cambiosDeOrigenes(elegida, entrada.campos),
    },
  }
}
