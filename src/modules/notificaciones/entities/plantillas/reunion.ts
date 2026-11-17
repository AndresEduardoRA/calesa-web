// Las plantillas de reunión que se mandan al reservar o al cambiar: confirmada y cambiada (visitante), nueva y cambiada-equipo (equipo).
import { formatearNumero } from '@/shared/lib/formato'
import type { Bloque, Contenido, Contexto } from '../contenido'
import type { DatosDe } from '../datos'
import { importadoraONombre } from '../formato-correo'
import { FRASE_SIN_GESTION, enlaceDeSolicitud, fechaDe, minutosDeDuracion } from './ayudas'

function botonesDelVisitante(meet: string, gestion: string | undefined): Bloque[] {
  const entrar: Bloque = { tipo: 'boton', texto: 'Entrar a la reunión', url: meet }
  return gestion
    ? [
        entrar,
        { tipo: 'parrafo', texto: 'Puedes cambiar o cancelar hasta 2 horas antes.' },
        { tipo: 'boton', texto: 'Cambiar o cancelar', url: gestion },
      ]
    : [entrar, { tipo: 'parrafo', texto: FRASE_SIN_GESTION }]
}

export const plantillasDeReunion = {
  'reunion-confirmada': (d: DatosDe<'reunion-confirmada'>): Contenido => {
    const { reunion } = d
    const fecha = fechaDe(reunion.inicio, reunion, 'visitante')
    return {
      asunto: `Tu demo con Calesa: ${fecha}`,
      titulo: 'Tu demo está confirmada',
      bloques: [
        {
          tipo: 'parrafo',
          texto: `Hola, ${reunion.visitante.nombre}. Calesa te confirma tu demo.`,
        },
        {
          tipo: 'filas',
          filas: [
            ['Cuándo', fecha],
            [
              'Duración',
              `${formatearNumero(minutosDeDuracion(reunion), { decimales: 0 })} minutos`,
            ],
            ['Te atiende', reunion.anfitrion.nombre],
          ],
        },
        ...botonesDelVisitante(reunion.enlaceMeet, d.enlaceGestion),
      ],
      ics: 'REQUEST',
    }
  },

  'reunion-nueva-anfitrion': (d: DatosDe<'reunion-nueva-anfitrion'>, ctx: Contexto): Contenido => {
    const { reunion } = d
    const fecha = fechaDe(reunion.inicio, reunion, 'equipo')
    const quien = importadoraONombre(reunion.importadora, reunion.visitante.nombre)
    return {
      asunto: `Nueva demo: ${quien}, ${fecha}`,
      titulo: 'Tienes una demo nueva',
      bloques: [
        ...(d.motivo === 'reasignacion'
          ? [{ tipo: 'parrafo', texto: 'Te la pasaron por reasignación.' } satisfies Bloque]
          : []),
        {
          tipo: 'filas',
          filas: [
            ['Visitante', reunion.visitante.nombre],
            ['Importadora', reunion.importadora ?? 'Sin importadora'],
            ['Cuándo', fecha],
            ['Reunión', reunion.enlaceMeet],
          ],
        },
        {
          tipo: 'boton',
          texto: 'Ver solicitud',
          url: enlaceDeSolicitud(ctx.sitio, reunion.solicitudId),
        },
      ],
      ics: null,
    }
  },

  'reunion-cambiada': (d: DatosDe<'reunion-cambiada'>): Contenido => {
    const { reunion } = d
    const fecha = fechaDe(reunion.inicio, reunion, 'visitante')
    return {
      asunto: `Cambió tu demo con Calesa: ${fecha}`,
      titulo: 'Cambió tu demo',
      bloques: [
        {
          tipo: 'filas',
          filas: [
            ['Antes', fechaDe(d.inicioAnterior, reunion, 'visitante')],
            ['Ahora', fecha],
            ['Te atiende', reunion.anfitrion.nombre],
          ],
        },
        ...botonesDelVisitante(reunion.enlaceMeet, d.enlaceGestion),
      ],
      ics: 'REQUEST',
    }
  },

  'reunion-cambiada-equipo': (d: DatosDe<'reunion-cambiada-equipo'>, ctx: Contexto): Contenido => {
    const { reunion } = d
    const quien = importadoraONombre(reunion.importadora, reunion.visitante.nombre)
    const anterior = d.destinatario === 'anterior'
    return {
      asunto: `Cambio de demo: ${quien}`,
      titulo: 'Cambió una demo',
      bloques: [
        ...(anterior ? [{ tipo: 'parrafo', texto: 'Ya no la atiendes tú.' } satisfies Bloque] : []),
        {
          tipo: 'filas',
          filas: [
            ['Visitante', reunion.visitante.nombre],
            ['Antes', fechaDe(d.inicioAnterior, reunion, 'equipo')],
            ['Ahora', fechaDe(reunion.inicio, reunion, 'equipo')],
            ...(anterior ? [] : ([['Reunión', reunion.enlaceMeet]] as const)),
          ],
        },
        ...(anterior
          ? []
          : [
              {
                tipo: 'boton',
                texto: 'Ver solicitud',
                url: enlaceDeSolicitud(ctx.sitio, reunion.solicitudId),
              } satisfies Bloque,
            ]),
      ],
      ics: null,
    }
  },
}
