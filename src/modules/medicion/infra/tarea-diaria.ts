import 'server-only'

import { type ErrorApp, MENSAJE_INESPERADO, ok, type Resultado } from '@/shared/lib/errores'
import { type Cupo, evaluarCupos } from '../entities/cupos'
import {
  armarErrorDelLatido,
  type Conteos,
  type PasoFallido,
  type PuertosDeLaTarea,
  type ResumenDeLaTarea,
  VUELTAS_DE_RETENCION,
} from '../entities/tarea-diaria'

const INESPERADO: ErrorApp = { codigo: 'inesperado', mensaje: MENSAJE_INESPERADO }

// Corre un puerto sin dejar que un fallo detenga la tarea: lo que lanza cuenta como `inesperado`. El log lleva el paso y el código,
// nunca el mensaje ni el error (pueden traer datos de la base o de una persona).
async function correrPuerto<T>(
  paso: string,
  puerto: () => Promise<Resultado<T>>,
): Promise<Resultado<T>> {
  try {
    const resultado = await puerto()
    if (!resultado.ok) {
      console.error(`tarea diaria ${paso}: ${resultado.error.codigo}`)
    }
    return resultado
  } catch {
    console.error(`tarea diaria ${paso}: inesperado`)
    return { ok: false, error: INESPERADO }
  }
}

function sumar(total: Record<string, number>, conteos: Conteos) {
  for (const [clave, valor] of Object.entries(conteos)) {
    total[clave] = (total[clave] ?? 0) + valor
  }
}

// Llama a la retención mientras queden más, hasta VUELTAS_DE_RETENCION veces; lo que quede lo sigue la próxima corrida. Una vuelta que
// falla corta el bucle con su error.
async function correrRetencion(
  puertos: PuertosDeLaTarea,
): Promise<Resultado<{ conteos: Conteos; quedanMas: boolean }>> {
  const total: Record<string, number> = {}
  for (let vuelta = 0; vuelta < VUELTAS_DE_RETENCION; vuelta++) {
    const resultado = await correrPuerto('retencion', puertos.retencion)
    if (!resultado.ok) {
      return resultado
    }
    sumar(total, resultado.data.conteos)
    if (!resultado.data.quedanMas) {
      return ok({ conteos: total, quedanMas: false })
    }
  }
  return ok({ conteos: total, quedanMas: true })
}

const fallido = (resultado: { ok: false; error: ErrorApp }): PasoFallido => ({
  ok: false,
  codigo: resultado.error.codigo,
})
const errorDe = <T>(resultado: Resultado<T>) => (resultado.ok ? null : resultado.error)

// La tarea diaria (K1–K4 del plan de P13): retención → correos → cupos, una vez cada uno y sin que un fallo detenga a los demás, y al
// final un solo latido con lo que pasó.
export async function correrTareaDiaria(puertos: PuertosDeLaTarea): Promise<ResumenDeLaTarea> {
  const retencion = await correrRetencion(puertos)
  const correos = await correrPuerto('correos', puertos.ponerAlDiaLosCorreos)
  const medida = await correrPuerto('cupos', puertos.medirCupos)
  const cupos: Cupo[] | null = medida.ok ? evaluarCupos(medida.data) : null

  const pasosOk = retencion.ok && correos.ok && medida.ok
  const error = armarErrorDelLatido({
    retencion: errorDe(retencion),
    correos: errorDe(correos),
    cupos: errorDe(medida),
  })
  const latido = await correrPuerto('latido', () =>
    puertos.registrarLatido({ ok: pasosOk, error, cupos }),
  )

  return {
    ok: pasosOk && latido.ok,
    pasos: {
      retencion: retencion.ok ? { ok: true, ...retencion.data } : fallido(retencion),
      correos: correos.ok ? { ok: true, conteos: correos.data } : fallido(correos),
      cupos: medida.ok ? { ok: true, conteos: medida.data, cupos: cupos ?? [] } : fallido(medida),
    },
    latido: latido.ok ? { ok: true } : fallido(latido),
  }
}
