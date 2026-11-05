import { z } from 'zod'
import { formatearNumero } from '@/shared/lib/formato'
import { campoEntero, cuandoPasaron } from './rangos'
import { CAPACIDAD_EXTRA } from './supuestos'

// La gráfica «Crecer sin contratar» (semilla §5.3, B8 y B8.1): sus entradas, el cálculo literal y sus textos. Los rangos son los de la
// solicitud (§3).

export const esquemaEntradasEscala = z
  .object({
    autos_hoy: campoEntero(1, 2000),
    autos_meta: campoEntero(1, 5000),
    vendedores: campoEntero(1, 500),
    administracion: campoEntero(1, 500),
  })
  .refine((e) => e.autos_meta >= e.autos_hoy, {
    error: 'La meta debe ser igual o mayor a lo que vendes hoy.',
    path: ['autos_meta'],
    when: cuandoPasaron('autos_hoy', 'autos_meta'),
  })

export type EntradasEscala = z.infer<typeof esquemaEntradasEscala>

// `con[0]` usa la capacidad mínima, así que es el número mayor.
export type ResultadoEscala =
  | { tipo: 'misma_cantidad' }
  | { tipo: 'crecer'; sin: number; con: [number, number]; personas_mas: number }

export type TextosDeEscala =
  | { tipo: 'misma_cantidad'; frase: string }
  | { tipo: 'crecer'; sin: string; con: string; frase: string; etiqueta: string }

const techo = (x: number) => Math.ceil(x - 1e-9)

export function calcularEscala(e: EntradasEscala): ResultadoEscala {
  if (e.autos_meta === e.autos_hoy) return { tipo: 'misma_cantidad' }
  const k = e.autos_meta / e.autos_hoy
  const sin = techo(e.vendedores * k) + techo(e.administracion * k)
  const conCapacidad = (i: 0 | 1) =>
    Math.max(e.vendedores, techo((e.vendedores * k) / (1 + CAPACIDAD_EXTRA.ventas[i]))) +
    Math.max(e.administracion, techo((e.administracion * k) / (1 + CAPACIDAD_EXTRA.operacion[i])))
  return {
    tipo: 'crecer',
    sin,
    con: [conCapacidad(0), conCapacidad(1)],
    personas_mas: sin - (e.vendedores + e.administracion),
  }
}

const n = (valor: number) => formatearNumero(valor, { decimales: 0 })

export function textosDeEscala(e: EntradasEscala, r: ResultadoEscala): TextosDeEscala {
  if (r.tipo === 'misma_cantidad') {
    return {
      tipo: 'misma_cantidad',
      frase:
        'Con la misma cantidad de autos no necesitas contratar. Calesa te devuelve horas para vender más.',
    }
  }
  const [mayor, menor] = r.con
  return {
    tipo: 'crecer',
    sin: `Sin sistema: ${n(r.sin)} personas`,
    con:
      mayor === menor
        ? `Con Calesa: ${n(mayor)} personas`
        : `Con Calesa: ${n(menor)} a ${n(mayor)} personas`,
    frase: `Para pasar de ${n(e.autos_hoy)} a ${n(e.autos_meta)} autos al mes, con tu forma de trabajar actual necesitarías ${n(r.personas_mas)} personas más.`,
    etiqueta: 'Cálculo aproximado',
  }
}
