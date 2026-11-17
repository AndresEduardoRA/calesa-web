import { formatearNumero, formatoRango, formatoUSD } from '@/shared/lib/formato'
import type { Escenario, ResultadoFugas } from './calculadora'

// Lo que se muestra del cálculo de fugas (semilla §5.2, X3): el único lugar que redondea, y sólo al final. Es la fuente de los textos
// con cifras para la pantalla y para el correo de detalle; los textos fijos («Estimación», «Cómo se calculó») son de la pantalla.

export type FilaDeFugas = Exclude<keyof Escenario, 'total' | 'horas'>

export type ResumenDeFugas = {
  titular: string
  rango: string
  horas: string
  filas: { fila: FilaDeFugas; etiqueta: string; minimo: string; maximo: string }[]
}

const FILAS: readonly [FilaDeFugas, string][] = [
  ['ventas', 'Ventas por contestar tarde'],
  ['dias', 'Días perdidos coordinando'],
  ['cambio', 'Diferencia de tipo de cambio'],
  ['olvidos', 'Costos que no se cobraron'],
  ['saldos', 'Saldos cobrados tarde'],
  ['tiempo', 'Horas del equipo'],
]

const horasEnteras = (horas: number) => formatearNumero(horas, { decimales: 0 })

export function resumenDeFugas({ minimo, maximo }: ResultadoFugas): ResumenDeFugas {
  return {
    titular: formatoUSD(minimo.total),
    rango: formatoRango(minimo.total, maximo.total),
    horas: `${horasEnteras(minimo.horas)} a ${horasEnteras(maximo.horas)}`,
    filas: FILAS.map(([fila, etiqueta]) => ({
      fila,
      etiqueta,
      minimo: formatoUSD(minimo[fila]),
      maximo: formatoUSD(maximo[fila]),
    })),
  }
}
