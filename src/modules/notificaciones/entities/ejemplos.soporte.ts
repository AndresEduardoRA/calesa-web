// La reunión de ejemplo y los datos de las 12 plantillas, para las pruebas (no sale por `index.ts`).
import type { DatosDe, Plantilla, Reunion } from './datos'

export const REUNION: Reunion = {
  reunionId: '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b',
  solicitudId: '7a9d0e2c-1b3f-4c5d-8e6a-0f1b2c3d4e5f',
  inicio: '2026-11-03T14:00:00Z', // mar 3 nov 2026, 10:00 en La Paz
  fin: '2026-11-03T14:30:00Z',
  zonaVisitante: 'America/La_Paz',
  enlaceMeet: 'https://meet.google.com/abc-defg-hij',
  secuencia: 0,
  visitante: { nombre: 'Ana Pérez', email: 'ana@ejemplo.com' },
  importadora: 'Importadora X',
  anfitrion: {
    id: '0c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f',
    nombre: 'Vendedor Uno',
    email: 'vendedor@getcalesa.com',
  },
}

// El cambio a mié 4 nov 11:00 (La Paz), con la secuencia siguiente.
export const REUNION_CAMBIADA: Reunion = {
  ...REUNION,
  inicio: '2026-11-04T15:00:00Z',
  fin: '2026-11-04T15:30:00Z',
  secuencia: 1,
}

export const REUNION_EN_BOGOTA: Reunion = { ...REUNION, zonaVisitante: 'America/Bogota' }

export const ENLACE_DE_GESTION = 'https://calesa.app/reunion/token-de-gestion'

export const CONTEXTO = {
  sitio: 'https://calesa.app',
  ahora: '2026-11-02T12:00:00Z',
  organizador: { email: 'hola@getcalesa.com', nombre: 'Calesa' },
}

type Ejemplos = { [P in Plantilla]: DatosDe<P> }

export const DATOS_DE_EJEMPLO: Ejemplos = {
  'reunion-confirmada': {
    plantilla: 'reunion-confirmada',
    reunion: REUNION,
    enlaceGestion: ENLACE_DE_GESTION,
  },
  'reunion-nueva-anfitrion': {
    plantilla: 'reunion-nueva-anfitrion',
    reunion: REUNION,
    motivo: 'reserva',
  },
  'reunion-cambiada': {
    plantilla: 'reunion-cambiada',
    reunion: REUNION_CAMBIADA,
    inicioAnterior: REUNION.inicio,
    enlaceGestion: ENLACE_DE_GESTION,
  },
  'reunion-cambiada-equipo': {
    plantilla: 'reunion-cambiada-equipo',
    reunion: REUNION_CAMBIADA,
    inicioAnterior: REUNION.inicio,
    destinatario: 'nuevo',
    motivo: 'reagenda',
  },
  'reunion-cancelada': {
    plantilla: 'reunion-cancelada',
    reunion: REUNION,
    destinatario: 'visitante',
    canceladaPor: 'equipo',
  },
  'recordatorio-24h': {
    plantilla: 'recordatorio-24h',
    reunion: REUNION,
    enlaceGestion: ENLACE_DE_GESTION,
  },
  'recordatorio-1h': { plantilla: 'recordatorio-1h', reunion: REUNION, destinatario: 'visitante' },
  'meet-cambiado': {
    plantilla: 'meet-cambiado',
    reunion: REUNION,
    cambioEn: '2026-11-02T15:00:00Z',
  },
  'detalle-calculadora': {
    plantilla: 'detalle-calculadora',
    solicitudId: REUNION.solicitudId,
    nombre: 'Ana Pérez',
    entradas: [
      { etiqueta: 'Consultas por mes', valor: '300' },
      { etiqueta: 'Tiempo de respuesta', valor: '4 horas' },
      { etiqueta: 'Autos en catálogo', valor: '120' },
      { etiqueta: 'Precio medio', valor: 'US$ 15.000' },
      { etiqueta: 'Vendedores', valor: '4' },
    ],
    rango: { minimo: 4452, maximo: 8935 },
    filas: [
      { nombre: 'Consultas sin responder', minimo: 900, maximo: 1800 },
      { nombre: 'Respuestas tardías', minimo: 800, maximo: 1600 },
      { nombre: 'Seguimiento olvidado', minimo: 700, maximo: 1400 },
      { nombre: 'Citas que no llegan', minimo: 600, maximo: 1200 },
      { nombre: 'Horas fuera de horario', minimo: 800, maximo: 1500 },
      { nombre: 'Clientes que no vuelven', minimo: 652, maximo: 1435 },
    ],
    horas: 62.5,
    datosPanel: [{ etiqueta: 'Margen por auto', valor: 'US$ 900' }],
    resumen: [
      'Calesa suma lo que se pierde por consultas sin respuesta a tiempo.',
      'Cada fila usa tus cinco datos y los supuestos del panel.',
      'El resultado es un rango: el mínimo es lo que casi seguro se escapa.',
    ],
    enlaceAgendar: 'https://calesa.app/agendar?consultas=300',
    pedidoEn: '2026-11-02T11:00:00Z',
  },
  'solicitud-sin-reunion': {
    plantilla: 'solicitud-sin-reunion',
    solicitudId: REUNION.solicitudId,
    nombre: 'Ana Pérez',
    importadora: 'Importadora X',
    origen: 'formulario',
    creadaEn: '2026-11-02T11:45:00Z',
  },
  'aviso-equipo': {
    plantilla: 'aviso-equipo',
    tipo: 'solicitud-nueva',
    solicitudId: REUNION.solicitudId,
    nombre: 'Ana Pérez',
    importadora: 'Importadora X',
    ocurridoEn: '2026-11-02T11:45:00Z',
  },
  'correo-fallido': {
    plantilla: 'correo-fallido',
    correoId: 'b1c2d3e4-f5a6-4b7c-8d9e-0a1b2c3d4e5f',
    plantillaFallida: 'reunion-confirmada',
    paraFallido: 'ana@ejemplo.com',
    ultimoError: 'No pudimos llegar al servidor. Revisa tu conexión y vuelve a intentar.',
    intentos: 3,
    reunionId: REUNION.reunionId,
    solicitudId: REUNION.solicitudId,
  },
}
