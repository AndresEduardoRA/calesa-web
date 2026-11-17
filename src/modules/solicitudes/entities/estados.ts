// Estados de la solicitud (§5.7, R4.7). Funciones puras: dicen si un cambio vale y qué efecto tiene
// en la reunión. La autoridad es el trigger de la base; quién puede tocar *qué* solicitud («propio» o
// «todos») lo dicen `puede()` y la RLS, no esto.
import { z } from 'zod'

export const ESTADOS_SOLICITUD = [
  'nueva',
  'agendada',
  'realizada',
  'no_asistio',
  'ganada',
  'descartada',
] as const

export const esquemaEstadoSolicitud = z.enum(ESTADOS_SOLICITUD)
export type EstadoSolicitud = z.infer<typeof esquemaEstadoSolicitud>

// Quién hace el cambio: el servidor (al reservar o cancelar), o una persona del panel según su
// permiso. El actor sale de `puede(...)` o del servidor, nunca de comparar el rol en la interfaz.
export type Actor = 'servidor' | 'vendedor' | 'admin'

// Lo que el cambio hace con la reunión confirmada. Va aquí y no importado de `agenda`: los módulos
// no se importan entre sí desde `entities`.
export type EfectoEnReunion = 'confirmada' | 'cancelada' | 'realizada' | 'no_asistio'

export const CAMBIO_NO_PERMITIDO = 'Ese cambio de estado no está permitido.'

type Regla = {
  desde: EstadoSolicitud | null
  hacia: EstadoSolicitud
  actores: Actor[]
  reunion: EfectoEnReunion | null
  soloDespuesDelInicio?: boolean
}

const PANEL: Actor[] = ['vendedor', 'admin']

const REGLAS: Regla[] = [
  { desde: null, hacia: 'nueva', actores: ['servidor'], reunion: null },
  { desde: 'nueva', hacia: 'agendada', actores: ['servidor'], reunion: 'confirmada' },
  { desde: 'agendada', hacia: 'nueva', actores: ['servidor'], reunion: 'cancelada' },
  {
    desde: 'agendada',
    hacia: 'realizada',
    actores: PANEL,
    reunion: 'realizada',
    soloDespuesDelInicio: true,
  },
  {
    desde: 'agendada',
    hacia: 'no_asistio',
    actores: PANEL,
    reunion: 'no_asistio',
    soloDespuesDelInicio: true,
  },
  { desde: 'realizada', hacia: 'ganada', actores: PANEL, reunion: null },
  { desde: 'realizada', hacia: 'descartada', actores: PANEL, reunion: null },
  { desde: 'nueva', hacia: 'descartada', actores: PANEL, reunion: null },
  { desde: 'no_asistio', hacia: 'descartada', actores: PANEL, reunion: null },
  { desde: 'descartada', hacia: 'nueva', actores: ['admin'], reunion: null },
]

export type PeticionDeCambio = {
  // null = la solicitud todavía no existe.
  desde: EstadoSolicitud | null
  hacia: EstadoSolicitud
  actor: Actor
  // Hacen falta los dos para pasar una reunión a realizada o no_asistio.
  ahora?: string
  inicioReunion?: string
}

export type ResultadoCambio =
  { ok: true; reunion: EfectoEnReunion | null } | { ok: false; error: string }

// «Después del inicio» es `ahora ≥ inicio`, comparando instantes (el ISO admite desfases).
function yaEmpezo({ ahora, inicioReunion }: PeticionDeCambio): boolean {
  return (
    ahora !== undefined &&
    inicioReunion !== undefined &&
    Date.parse(ahora) >= Date.parse(inicioReunion)
  )
}

export function transicionPermitida(peticion: PeticionDeCambio): ResultadoCambio {
  const regla = REGLAS.find(
    (r) =>
      r.desde === peticion.desde &&
      r.hacia === peticion.hacia &&
      r.actores.includes(peticion.actor),
  )
  if (!regla || (regla.soloDespuesDelInicio === true && !yaEmpezo(peticion))) {
    return { ok: false, error: CAMBIO_NO_PERMITIDO }
  }
  return { ok: true, reunion: regla.reunion }
}

// Los estados a los que puede pasar, en el orden de `ESTADOS_SOLICITUD`: lo que ofrece el detalle.
export function estadosPosibles(peticion: Omit<PeticionDeCambio, 'hacia'>): EstadoSolicitud[] {
  return ESTADOS_SOLICITUD.filter((hacia) => transicionPermitida({ ...peticion, hacia }).ok)
}
