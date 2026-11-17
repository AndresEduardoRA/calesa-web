// Respuestas de ejemplo de las RPC de la agenda pública (`*.soporte.*`), con las claves y los tipos que devuelven `datos_para_horas` y
// `_resumen_reunion` (supabase/migrations/20261117124018_calesa_reservar.sql). Algunos instantes van con `Z` y la base los manda con
// `+00:00`: los schemas aceptan los dos. Sólo las importan los tests: no sale por `index.ts`.
import { CONFIG_INICIAL, HORARIO_INICIAL, V1, V2, enLaPaz, persona } from './ejemplos.soporte'

export const SOLICITUD = '00000000-0000-4000-8000-000000000051'
export const REUNION = '00000000-0000-4000-8000-0000000000e1'
export const ANTERIOR = { id: V2, nombre: 'Bruno Díaz', email: 'bruno@calesa.test' }

// La reunión del token, como la arma `datos_para_horas`: martes 3 nov 2026 10:00 en La Paz, cambiable hasta las 08:00.
export function reunionDelToken(cambios: Record<string, unknown> = {}) {
  return {
    id: REUNION,
    inicio: '2026-11-03T14:00:00+00:00',
    fin: '2026-11-03T14:30:00+00:00',
    estado: 'confirmada',
    zonaVisitante: 'America/Bogota',
    enlaceMeet: 'https://meet.google.com/abc-defg-hij',
    actualizadoEn: '2026-11-02T12:00:00.123456+00:00',
    cambiableHasta: '2026-11-03T12:00:00+00:00',
    puedeVolverAReservar: false,
    anfitrion: { nombre: 'Ana Rojas', whatsapp: '+59170000001' },
    ...cambios,
  }
}

// Lo que devuelve `datos_para_horas` (`ahora`: lun 2 nov 2026 08:00 en La Paz): los contactos del equipo sólo dicen si los hay.
export function datosParaHoras(cambios: Record<string, unknown> = {}) {
  const contactos = { whatsapp: '•', enlaceMeet: '•' }
  return {
    ahora: '2026-11-02T12:00:00.000001+00:00',
    config: CONFIG_INICIAL,
    horarioBase: HORARIO_INICIAL,
    personas: [persona(V1, contactos), persona(V2, contactos)],
    bloqueos: [],
    reuniones: [],
    limitarA: null,
    excluirReunionId: null,
    asignadoA: null,
    ...cambios,
  }
}

// Lo que devuelven reservar, cambiar y cancelar (`_resumen_reunion`).
export function resumen(
  cambios: { reunion?: object; solicitud?: object; anfitrionAnterior?: object | null } = {},
) {
  return {
    reunion: {
      id: REUNION,
      inicio: enLaPaz('2026-11-03T10:00'),
      fin: enLaPaz('2026-11-03T10:30'),
      zonaVisitante: 'America/Bogota',
      enlaceMeet: 'https://meet.google.com/abc-defg-hij',
      estado: 'confirmada',
      secuenciaIcs: 0,
      actualizadoEn: '2026-11-02T12:00:00.123456+00:00',
      ...cambios.reunion,
    },
    solicitud: {
      id: SOLICITUD,
      nombre: 'Luis Pérez',
      email: 'luis@importadora.test',
      importadora: 'Autos del Sur',
      asignadoA: V1,
      ...cambios.solicitud,
    },
    anfitrion: { id: V1, nombre: 'Ana Rojas', email: 'ana@calesa.test', whatsapp: '+59170000001' },
    anfitrionAnterior: cambios.anfitrionAnterior ?? null,
  }
}
