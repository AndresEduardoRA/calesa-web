// Las plantillas que salen a `EMAIL_AVISOS`: el aviso de cada solicitud o cambio de reunión (B17) y el de un correo que no salió.
import type { Contenido, Contexto } from '../contenido'
import type { DatosDe } from '../datos'
import { fechaParaEquipo, importadoraONombre } from '../formato-correo'
import { enlaceDeActividad, enlaceDeSolicitud } from './ayudas'

const TIPOS = {
  'solicitud-nueva': { rotulo: 'Nueva solicitud', hecho: 'Entró una solicitud nueva.' },
  'reunion-cambiada': { rotulo: 'Reunión cambiada', hecho: 'Cambió una reunión.' },
  'reunion-cancelada': { rotulo: 'Reunión cancelada', hecho: 'Se canceló una reunión.' },
} as const

export const plantillasDelEquipo = {
  'aviso-equipo': (d: DatosDe<'aviso-equipo'>, ctx: Contexto): Contenido => {
    const tipo = TIPOS[d.tipo]
    return {
      asunto: `[Calesa] ${tipo.rotulo}: ${importadoraONombre(d.importadora, d.nombre)}`,
      titulo: tipo.rotulo,
      bloques: [
        { tipo: 'parrafo', texto: tipo.hecho },
        {
          tipo: 'filas',
          filas: [
            ['Quién', d.nombre],
            ['Importadora', d.importadora ?? 'Sin importadora'],
            ['Pasó', fechaParaEquipo(d.ocurridoEn)],
            ...(d.inicio ? ([['Reunión', fechaParaEquipo(d.inicio)]] as const) : []),
          ],
        },
        { tipo: 'boton', texto: 'Ver solicitud', url: enlaceDeSolicitud(ctx.sitio, d.solicitudId) },
      ],
      ics: null,
    }
  },

  'correo-fallido': (d: DatosDe<'correo-fallido'>, ctx: Contexto): Contenido => ({
    asunto: '[Calesa] No se pudo enviar un correo',
    titulo: 'No se pudo enviar un correo',
    bloques: [
      {
        tipo: 'filas',
        filas: [
          ['Plantilla', d.plantillaFallida],
          ['Para', d.paraFallido],
          ['Error', d.ultimoError],
          ['Intentos', String(d.intentos)],
        ],
      },
      { tipo: 'boton', texto: 'Revisar', url: enlaceDeActividad(ctx.sitio) },
    ],
    ics: null,
  }),
}
