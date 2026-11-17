// La tarea diaria (semilla §3 l. 300, F10, R4.22, R5.2): los puertos con que corre, su resumen y cómo se arma su latido. Quien arma los
// puertos con la base y el notificador es la ruta del cron (P42). Ningún puerto recibe una hora: las RPC usan `_ahora()` (P38) y el
// notificador trae su reloj (P39). Cero I/O.
import type { CodigoError, ErrorApp, Resultado } from '@/shared/lib/errores'
import type { Cupo } from './cupos'

export type Conteos = Readonly<Record<string, number>>

// Lo que escribe el latido: `cupos` null es «no medido» (no pisa el aviso vigente); `[]`, medido y sin aviso.
export type LatidoNuevo = { ok: boolean; error: string | null; cupos: Cupo[] | null }

export type PuertosDeLaTarea = {
  retencion: () => Promise<Resultado<{ conteos: Conteos; quedanMas: boolean }>>
  ponerAlDiaLosCorreos: () => Promise<Resultado<Conteos>>
  medirCupos: () => Promise<Resultado<{ bytesDeBase: number; correosDelDia: number }>>
  registrarLatido: (latido: LatidoNuevo) => Promise<Resultado<null>>
}

// `retencion_diaria` borra por lotes con tope y dice si quedan más (P30): se vuelve a llamar, hasta este tope por corrida.
export const VUELTAS_DE_RETENCION = 5

export const PASOS_DE_LA_TAREA = ['retencion', 'correos', 'cupos'] as const
export type PasoDeLaTarea = (typeof PASOS_DE_LA_TAREA)[number]

export type PasoFallido = { ok: false; codigo: CodigoError }
type PasoOk = { ok: true; conteos: Conteos }

// Sólo números, códigos, booleanos y nombres de cupo: el resumen sale en la respuesta y en los logs del cron.
export type ResumenDeLaTarea = {
  ok: boolean
  pasos: {
    retencion: (PasoOk & { quedanMas: boolean }) | PasoFallido
    correos: PasoOk | PasoFallido
    cupos: (PasoOk & { cupos: Cupo[] }) | PasoFallido
  }
  latido: { ok: true } | PasoFallido
}

// El error del latido: los pasos que fallaron, en orden, como «<paso>: <codigo>» unidos por «; ». Nunca el mensaje: puede traer
// datos de la base o de una persona.
export function armarErrorDelLatido(
  errores: Readonly<Record<PasoDeLaTarea, ErrorApp | null>>,
): string | null {
  const partes = PASOS_DE_LA_TAREA.flatMap((paso) => {
    const error = errores[paso]
    return error ? [`${paso}: ${error.codigo}`] : []
  })
  return partes.length > 0 ? partes.join('; ') : null
}
