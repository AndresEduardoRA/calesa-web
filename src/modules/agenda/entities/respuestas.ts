// Lo que devuelven las RPC de la agenda pública (P05): `datos_para_horas` y el resumen de reservar, cambiar y cancelar
// (`_resumen_reunion`). Lo valida `infra/rpc.ts` antes de usarlo: una respuesta que no valida es un error de nuestro lado.
import { z } from 'zod'
import { esquemaEntradaAgenda } from './config'

const instante = z.iso.datetime({ offset: true })
const estadoDeReunion = z.enum(['confirmada', 'cancelada', 'realizada', 'no_asistio'])
const texto = z.string()

// La reunión de un token de gestión: la confirmada vigente o, si no hay, la del token. El plazo (B15) lo calcula la base.
export const esquemaReunionDelToken = z.object({
  id: z.guid(),
  inicio: instante,
  fin: instante,
  estado: estadoDeReunion,
  zonaVisitante: texto,
  enlaceMeet: texto,
  actualizadoEn: instante,
  cambiableHasta: instante,
  puedeVolverAReservar: z.boolean(),
  anfitrion: z.object({ nombre: texto, whatsapp: texto.nullable() }),
})

// La entrada de `horasDisponibles` más lo que suma la base: el asignado y, con un token de gestión, su reunión.
export const esquemaDatosParaHoras = esquemaEntradaAgenda.extend({
  asignadoA: z.guid().nullable(),
  reunion: esquemaReunionDelToken.optional(),
})

const persona = z.object({ id: z.guid(), nombre: texto, email: z.email() })

export const esquemaResumenReunion = z.object({
  reunion: z.object({
    id: z.guid(),
    inicio: instante,
    fin: instante,
    zonaVisitante: texto,
    enlaceMeet: texto,
    estado: estadoDeReunion,
    secuenciaIcs: z.number().int().min(0),
    actualizadoEn: instante,
  }),
  solicitud: z.object({
    id: z.guid(),
    nombre: texto,
    email: z.email(),
    importadora: texto.nullable(),
    asignadoA: z.guid().nullable(),
  }),
  anfitrion: persona.extend({ whatsapp: texto.nullable() }),
  // Sólo cuando cambiar movió la reunión a otra persona.
  anfitrionAnterior: persona.nullable(),
})

export type ReunionDelToken = z.infer<typeof esquemaReunionDelToken>
export type DatosParaHoras = z.infer<typeof esquemaDatosParaHoras>
export type ResumenReunion = z.infer<typeof esquemaResumenReunion>
