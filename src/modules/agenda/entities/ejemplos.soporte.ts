// Datos de las pruebas de la agenda (§5.5 y §5.6): la configuración inicial, el horario L–V de
// La Paz y fábricas de personas, reuniones y bloqueos. Sólo lo importan los tests: no sale por `index.ts`.
import { instanteDeLocal } from '@/shared/lib/fechas'
import type { Bloqueo, ConfigAgenda, EntradaAgenda, Persona, Reunion, Tramo } from './config'

export const V1 = '00000000-0000-4000-8000-000000000001'
export const V2 = '00000000-0000-4000-8000-000000000002'
export const ADMIN = '00000000-0000-4000-8000-0000000000aa'

// «2026-11-03T09:00» (hora de La Paz) como instante ISO en UTC.
export function enLaPaz(local: string): string {
  const instante = instanteDeLocal(local, { zona: 'America/La_Paz' })
  if (instante === null) {
    throw new Error(`Fecha de prueba inválida: ${local}`)
  }
  return instante
}

export const CONFIG_INICIAL: ConfigAgenda = {
  duracionMin: 30,
  descansoMin: 15,
  anticipacionMinHoras: 12,
  horizonteDias: 21,
  maxReunionesDia: 4,
  cancelarHastaHoras: 2,
  zonaHoraria: 'America/La_Paz',
}

// Lunes a viernes, 09:00–12:00 y 14:00–18:00 (B11).
export const HORARIO_INICIAL: Tramo[] = [1, 2, 3, 4, 5].flatMap((diaSemana) => [
  { diaSemana, desde: '09:00', hasta: '12:00' },
  { diaSemana, desde: '14:00', hasta: '18:00' },
])

export function persona(id: string, cambios: Partial<Persona> = {}): Persona {
  return {
    id,
    rol: 'vendedor',
    activo: true,
    enTurno: true,
    whatsapp: '+59170000000',
    enlaceMeet: 'https://meet.google.com/abc-defg-hij',
    creadoEn: '2026-01-01T00:00:00Z',
    ultimaReunionEn: null,
    ...cambios,
  }
}

export function admin(cambios: Partial<Persona> = {}): Persona {
  return persona(ADMIN, { rol: 'admin', creadoEn: '2025-12-01T00:00:00Z', ...cambios })
}

let contador = 0

// Una reunión de 30 min que empieza en `local` (hora de La Paz).
export function reunion(
  anfitrionId: string,
  local: string,
  cambios: Partial<Reunion> = {},
): Reunion {
  contador += 1
  const inicio = enLaPaz(local)
  const fin = new Date(Date.parse(inicio) + 30 * 60_000).toISOString()
  return {
    id: `10000000-0000-4000-8000-${String(contador).padStart(12, '0')}`,
    anfitrionId,
    inicio,
    fin,
    estado: 'confirmada',
    ...cambios,
  }
}

export function bloqueo(perfilId: string, desde: string, hasta: string): Bloqueo {
  return { perfilId, inicio: enLaPaz(desde), fin: enLaPaz(hasta) }
}

// Lunes 2 nov 2026, 08:00 en La Paz: el «ahora» de los ejemplos de §5.5.
export const AHORA = enLaPaz('2026-11-02T08:00')

export function entrada(cambios: Partial<EntradaAgenda> = {}): EntradaAgenda {
  return {
    ahora: AHORA,
    config: CONFIG_INICIAL,
    horarioBase: HORARIO_INICIAL,
    personas: [persona(V1)],
    bloqueos: [],
    reuniones: [],
    ...cambios,
  }
}
