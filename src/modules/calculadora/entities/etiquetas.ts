import type { EntradasCalculadora, TiempoRespuesta } from './entradas'

// Las etiquetas de los 5 datos y de las 4 opciones de «¿Cuánto tardas…?» (P5, elegidas en el plan de P09). Viven aquí y no en el
// formulario para que el correo de detalle (P38) use los mismos textos que la pantalla. Ninguna nombra el exceso de autos (X11): por
// eso «de cada auto» y nunca «por auto».
export const ETIQUETAS_DEL_FORMULARIO: {
  readonly campos: Readonly<Record<keyof EntradasCalculadora, string>>
  readonly respuestas: Readonly<Record<TiempoRespuesta, string>>
} = {
  campos: {
    autos: 'Autos que vendes al mes',
    margen: 'Margen promedio de cada auto',
    consultas: 'Consultas que recibes al mes',
    respuesta: '¿Cuánto tardas en contestar una consulta?',
    administracion: 'Personas en administración y logística',
  },
  respuestas: {
    h1: 'En menos de 1 hora',
    h4: 'En 1 a 4 horas',
    dia: 'En el mismo día',
    sig: 'Al día siguiente',
  },
}
