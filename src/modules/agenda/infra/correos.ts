// Los correos de reservar, cambiar y cancelar (§6.8, B16, X5, X6): funciones puras arman la lista ordenada de acciones desde el resumen
// de la base y `despacharCorreos` las corre una tras otra. Cancelar va primero: los recordatorios nuevos llevan los mismos ids de reunión
// y solicitud, y cancelar después los borraría. Un correo que falla no tumba el caso: se registra y se sigue. Los datos se escriben con
// tipos propios (`infra/` no importa `notificaciones`); los valida el notificador y, en las pruebas, `esquemaDatos`.
import type { ResumenReunion } from '../entities/respuestas'
import type { CorreosDeAgenda, MomentosDeRecordatorioDeAgenda } from './casos/tipos'

type ReunionDeCorreo = {
  reunionId: string
  solicitudId: string
  inicio: string
  fin: string
  zonaVisitante: string
  enlaceMeet: string
  secuencia: number
  visitante: { nombre: string; email: string }
  importadora: string | null
  anfitrion: { id: string; nombre: string; email: string }
}

type Destinatario = 'visitante' | 'anfitrion'

export type DatosDeCorreoDeAgenda =
  | { plantilla: 'reunion-confirmada'; reunion: ReunionDeCorreo; enlaceGestion: string }
  | { plantilla: 'reunion-nueva-anfitrion'; reunion: ReunionDeCorreo; motivo: 'reserva' }
  | {
      plantilla: 'reunion-cambiada'
      reunion: ReunionDeCorreo
      inicioAnterior: string
      enlaceGestion: string
    }
  | {
      plantilla: 'reunion-cambiada-equipo'
      reunion: ReunionDeCorreo
      inicioAnterior: string
      anfitrionAnterior?: { nombre: string }
      destinatario: 'nuevo' | 'anterior'
      motivo: 'reagenda'
    }
  | {
      plantilla: 'reunion-cancelada'
      reunion: ReunionDeCorreo
      destinatario: Destinatario
      canceladaPor: 'visitante'
    }
  | { plantilla: 'recordatorio-24h'; reunion: ReunionDeCorreo; enlaceGestion: string }
  | { plantilla: 'recordatorio-1h'; reunion: ReunionDeCorreo; destinatario: Destinatario }
  | {
      plantilla: 'aviso-equipo'
      tipo: 'reunion-cambiada' | 'reunion-cancelada'
      solicitudId: string
      nombre: string
      importadora?: string
      inicio: string
      ocurridoEn: string
    }

export type AccionDeCorreo =
  | { tipo: 'cancelar-solicitud'; id: string }
  | { tipo: 'cancelar-reunion'; id: string }
  | { tipo: 'enviar'; para?: string; datos: DatosDeCorreoDeAgenda }
  | { tipo: 'programar'; para: string; datos: DatosDeCorreoDeAgenda; cuando: string }

export type ContextoDeCorreos = {
  resumen: ResumenReunion
  enlaceGestion: string
  // Cuándo se reservó o cambió (ISO): decide si sale el recordatorio de 24 h.
  ahora: string
  momentos: MomentosDeRecordatorioDeAgenda
}

function reunionDeCorreo({ reunion, solicitud, anfitrion }: ResumenReunion): ReunionDeCorreo {
  return {
    reunionId: reunion.id,
    solicitudId: solicitud.id,
    inicio: reunion.inicio,
    fin: reunion.fin,
    zonaVisitante: reunion.zonaVisitante,
    enlaceMeet: reunion.enlaceMeet,
    secuencia: reunion.secuenciaIcs,
    visitante: { nombre: solicitud.nombre, email: solicitud.email },
    importadora: solicitud.importadora,
    anfitrion: { id: anfitrion.id, nombre: anfitrion.nombre, email: anfitrion.email },
  }
}

// `aviso-equipo` admite la importadora sólo opcional: una nula se omite.
function avisoAlEquipo(
  resumen: ResumenReunion,
  tipo: 'reunion-cambiada' | 'reunion-cancelada',
  ahora: string,
): AccionDeCorreo {
  const { solicitud, reunion } = resumen
  const importadora = solicitud.importadora === null ? {} : { importadora: solicitud.importadora }
  const datos = {
    plantilla: 'aviso-equipo',
    tipo,
    solicitudId: solicitud.id,
    nombre: solicitud.nombre,
    ...importadora,
    inicio: reunion.inicio,
    ocurridoEn: ahora,
  } as const
  return { tipo: 'enviar', datos }
}

// Los de 24 h (sólo si se reservó antes de `inicio − 24 h`) y los dos de 1 h.
function recordatorios({
  resumen,
  enlaceGestion,
  ahora,
  momentos,
}: ContextoDeCorreos): AccionDeCorreo[] {
  const reunion = reunionDeCorreo(resumen)
  const { r24, r1 } = momentos({ reservadaEn: ahora, inicio: resumen.reunion.inicio })
  const visitante = resumen.solicitud.email
  const veinticuatro: AccionDeCorreo[] =
    r24 === null
      ? []
      : [
          {
            tipo: 'programar',
            para: visitante,
            cuando: r24,
            datos: { plantilla: 'recordatorio-24h', reunion, enlaceGestion },
          },
        ]
  return [
    ...veinticuatro,
    {
      tipo: 'programar',
      para: visitante,
      cuando: r1,
      datos: { plantilla: 'recordatorio-1h', reunion, destinatario: 'visitante' },
    },
    {
      tipo: 'programar',
      para: resumen.anfitrion.email,
      cuando: r1,
      datos: { plantilla: 'recordatorio-1h', reunion, destinatario: 'anfitrion' },
    },
  ]
}

export function accionesDeReserva(contexto: ContextoDeCorreos): AccionDeCorreo[] {
  const { resumen, enlaceGestion } = contexto
  const reunion = reunionDeCorreo(resumen)
  return [
    // X5: el aviso «solicitud sin reunión» de 15 min ya no hace falta.
    { tipo: 'cancelar-solicitud', id: resumen.solicitud.id },
    {
      tipo: 'enviar',
      para: resumen.solicitud.email,
      datos: { plantilla: 'reunion-confirmada', reunion, enlaceGestion },
    },
    {
      tipo: 'enviar',
      para: resumen.anfitrion.email,
      datos: { plantilla: 'reunion-nueva-anfitrion', reunion, motivo: 'reserva' },
    },
    ...recordatorios(contexto),
  ]
}

export function accionesDeCambio(
  contexto: ContextoDeCorreos & { inicioAnterior: string },
): AccionDeCorreo[] {
  const { resumen, enlaceGestion, inicioAnterior, ahora } = contexto
  const reunion = reunionDeCorreo(resumen)
  const anterior = resumen.anfitrionAnterior
  const equipo = {
    plantilla: 'reunion-cambiada-equipo',
    reunion,
    inicioAnterior,
    motivo: 'reagenda',
  } as const
  const conAnterior = anterior === null ? {} : { anfitrionAnterior: { nombre: anterior.nombre } }
  const alAnterior: AccionDeCorreo[] =
    anterior === null
      ? []
      : [
          {
            tipo: 'enviar',
            para: anterior.email,
            datos: { ...equipo, ...conAnterior, destinatario: 'anterior' },
          },
        ]
  return [
    { tipo: 'cancelar-reunion', id: resumen.reunion.id },
    {
      tipo: 'enviar',
      para: resumen.solicitud.email,
      datos: { plantilla: 'reunion-cambiada', reunion, inicioAnterior, enlaceGestion },
    },
    {
      tipo: 'enviar',
      para: resumen.anfitrion.email,
      datos: { ...equipo, ...conAnterior, destinatario: 'nuevo' },
    },
    ...alAnterior,
    avisoAlEquipo(resumen, 'reunion-cambiada', ahora),
    ...recordatorios(contexto),
  ]
}

export function accionesDeCancelacion({
  resumen,
  ahora,
}: {
  resumen: ResumenReunion
  ahora: string
}): AccionDeCorreo[] {
  const reunion = reunionDeCorreo(resumen)
  const cancelada = { plantilla: 'reunion-cancelada', reunion, canceladaPor: 'visitante' } as const
  return [
    { tipo: 'cancelar-reunion', id: resumen.reunion.id },
    {
      tipo: 'enviar',
      para: resumen.solicitud.email,
      datos: { ...cancelada, destinatario: 'visitante' },
    },
    {
      tipo: 'enviar',
      para: resumen.anfitrion.email,
      datos: { ...cancelada, destinatario: 'anfitrion' },
    },
    avisoAlEquipo(resumen, 'reunion-cancelada', ahora),
  ]
}

function ejecutar(accion: AccionDeCorreo, correos: CorreosDeAgenda) {
  switch (accion.tipo) {
    case 'cancelar-solicitud':
      return correos.cancelarDeSolicitud(accion.id)
    case 'cancelar-reunion':
      return correos.cancelarDeReunion(accion.id)
    case 'enviar':
      return correos.enviarAhora({ para: accion.para, datos: accion.datos })
    case 'programar':
      return correos.programar({ para: accion.para, datos: accion.datos, cuando: accion.cuando })
  }
}

const etiqueta = (accion: AccionDeCorreo) =>
  accion.tipo === 'enviar' || accion.tipo === 'programar' ? accion.datos.plantilla : 'cancelar'

// Una tras otra y esperando cada una: el orden importa (cancelar antes de programar). El registro no lleva destinatarios ni enlaces.
export async function despacharCorreos(
  acciones: AccionDeCorreo[],
  correos: CorreosDeAgenda,
): Promise<void> {
  for (const accion of acciones) {
    try {
      const resultado = await ejecutar(accion, correos)
      if (!resultado.ok) {
        console.error(`agenda: correo ${etiqueta(accion)} ${resultado.error.codigo}`)
      }
    } catch {
      console.error(`agenda: correo ${etiqueta(accion)} excepcion`)
    }
  }
}
