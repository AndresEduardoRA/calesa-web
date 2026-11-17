// Las plantillas de una persona que todavía no tiene reunión: su detalle de la calculadora y el aviso al asignado.
import type { Contenido, Contexto } from '../contenido'
import type { DatosDe } from '../datos'
import { fechaParaEquipo, importadoraONombre } from '../formato-correo'
import { formatearNumero, formatoRango, formatoUSD } from '@/shared/lib/formato'
import { enlaceDeSolicitud } from './ayudas'

const ORIGENES = {
  formulario: 'el formulario del sitio',
  prospeccion: 'un enlace de prospección',
  calculadora: 'la calculadora',
} as const

export const plantillasDeSolicitudes = {
  'detalle-calculadora': (d: DatosDe<'detalle-calculadora'>): Contenido => ({
    asunto: 'Lo que se te escapa al mes: tu detalle',
    titulo: 'Lo que se te escapa al mes',
    bloques: [
      { tipo: 'parrafo', texto: `Hola, ${d.nombre}. Este es el detalle que pediste.` },
      {
        tipo: 'parrafo',
        texto: `Se te escapan entre ${formatoRango(d.rango.minimo, d.rango.maximo)} al mes. Al menos ${formatoUSD(d.rango.minimo)}.`,
      },
      { tipo: 'subtitulo', texto: 'Lo que ingresaste' },
      { tipo: 'filas', filas: d.entradas.map((e) => [e.etiqueta, e.valor] as const) },
      { tipo: 'subtitulo', texto: 'De dónde sale' },
      {
        tipo: 'tabla',
        columnas: ['Concepto', 'Mínimo', 'Máximo'],
        filas: d.filas.map((f) => [f.nombre, formatoUSD(f.minimo), formatoUSD(f.maximo)]),
      },
      {
        tipo: 'parrafo',
        texto: `Eso suma ${formatearNumero(d.horas, { decimales: 1 })} horas de trabajo al mes.`,
      },
      ...(d.datosPanel.length > 0
        ? [
            { tipo: 'subtitulo', texto: 'Datos que usamos' } as const,
            {
              tipo: 'filas',
              filas: d.datosPanel.map((e) => [e.etiqueta, e.valor] as const),
            } as const,
          ]
        : []),
      { tipo: 'subtitulo', texto: 'Cómo se calculó' },
      ...d.resumen.map((texto) => ({ tipo: 'parrafo', texto }) as const),
      { tipo: 'boton', texto: 'Agendar demo', url: d.enlaceAgendar },
    ],
    ics: null,
  }),

  'solicitud-sin-reunion': (d: DatosDe<'solicitud-sin-reunion'>, ctx: Contexto): Contenido => ({
    asunto: `Nueva solicitud sin reunión: ${importadoraONombre(d.importadora, d.nombre)}`,
    titulo: 'Tienes una solicitud sin reunión',
    bloques: [
      {
        tipo: 'filas',
        filas: [
          ['Quién', d.nombre],
          ['Importadora', d.importadora ?? 'Sin importadora'],
          ['Llegó por', ORIGENES[d.origen]],
          ['Cuándo', fechaParaEquipo(d.creadaEn)],
        ],
      },
      { tipo: 'boton', texto: 'Ver solicitud', url: enlaceDeSolicitud(ctx.sitio, d.solicitudId) },
    ],
    ics: null,
  }),
}
