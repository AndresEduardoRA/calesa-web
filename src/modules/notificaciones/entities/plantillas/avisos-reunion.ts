// Las plantillas de reunión que avisan de un hecho: cancelada, recordatorios de 24 h y 1 h, y cambio del enlace de Meet.
import type { Bloque, Contenido, Contexto } from '../contenido'
import type { DatosDe } from '../datos'
import { importadoraONombre } from '../formato-correo'
import { FRASE_SIN_GESTION, enlaceDeSolicitud, fechaDe } from './ayudas'

export const plantillasDeAvisosDeReunion = {
  'reunion-cancelada': (d: DatosDe<'reunion-cancelada'>, ctx: Contexto): Contenido => {
    const { reunion } = d
    const alVisitante = d.destinatario === 'visitante'
    const fecha = fechaDe(reunion.inicio, reunion, alVisitante ? 'visitante' : 'equipo')
    const quien = importadoraONombre(reunion.importadora, reunion.visitante.nombre)
    const parrafo = alVisitante
      ? 'Calesa te avisa que tu demo se canceló.'
      : `Se canceló la demo con ${quien}${d.canceladaPor === 'visitante' ? ' (la canceló la persona)' : ''}.`
    const boton: Bloque = alVisitante
      ? { tipo: 'boton', texto: 'Elegir otra hora', url: `${ctx.sitio}/agendar` }
      : {
          tipo: 'boton',
          texto: 'Ver solicitud',
          url: enlaceDeSolicitud(ctx.sitio, reunion.solicitudId),
        }
    return {
      asunto: 'Se canceló tu demo con Calesa',
      titulo: 'Se canceló la demo',
      bloques: [
        { tipo: 'parrafo', texto: parrafo },
        { tipo: 'filas', filas: [['Era el', fecha]] },
        boton,
      ],
      ics: alVisitante ? 'CANCEL' : null,
    }
  },

  'recordatorio-24h': (d: DatosDe<'recordatorio-24h'>): Contenido => {
    const { reunion } = d
    return {
      asunto: 'Mañana es tu demo con Calesa',
      titulo: 'Mañana es tu demo',
      bloques: [
        {
          tipo: 'filas',
          filas: [
            ['Cuándo', fechaDe(reunion.inicio, reunion, 'visitante')],
            ['Te atiende', reunion.anfitrion.nombre],
          ],
        },
        { tipo: 'boton', texto: 'Entrar a la reunión', url: reunion.enlaceMeet },
        ...(d.enlaceGestion
          ? ([{ tipo: 'boton', texto: 'Cambiar o cancelar', url: d.enlaceGestion }] as Bloque[])
          : [{ tipo: 'parrafo', texto: FRASE_SIN_GESTION } satisfies Bloque]),
      ],
      ics: null,
    }
  },

  'recordatorio-1h': (d: DatosDe<'recordatorio-1h'>): Contenido => {
    const { reunion } = d
    const alAnfitrion = d.destinatario === 'anfitrion'
    const lector = alAnfitrion ? 'equipo' : 'visitante'
    return {
      asunto: 'Tu demo con Calesa empieza en 1 hora',
      titulo: 'Tu demo empieza en 1 hora',
      bloques: [
        {
          tipo: 'filas',
          filas: [
            ['Cuándo', fechaDe(reunion.inicio, reunion, lector)],
            ...(alAnfitrion
              ? ([
                  ['Visitante', reunion.visitante.nombre],
                  ['Importadora', reunion.importadora ?? 'Sin importadora'],
                ] as const)
              : []),
          ],
        },
        { tipo: 'boton', texto: 'Entrar a la reunión', url: reunion.enlaceMeet },
      ],
      ics: null,
    }
  },

  'meet-cambiado': (d: DatosDe<'meet-cambiado'>): Contenido => {
    const { reunion } = d
    return {
      asunto: 'Cambió el enlace de tu demo con Calesa',
      titulo: 'Cambió el enlace de tu demo',
      bloques: [
        { tipo: 'parrafo', texto: 'La hora no cambia.' },
        { tipo: 'filas', filas: [['Cuándo', fechaDe(reunion.inicio, reunion, 'visitante')]] },
        { tipo: 'parrafo', texto: `El enlace nuevo es ${reunion.enlaceMeet}` },
        { tipo: 'boton', texto: 'Entrar a la reunión', url: reunion.enlaceMeet },
      ],
      ics: null,
    }
  },
}
