import { formatearNumero, formatoUSD } from '@/shared/lib/formato'

// Los precios de Calesa (semilla §5.4): la única fuente. Las tarjetas y la tabla los leen de aquí; el anual y el ahorro se calculan
// (12 por 10), nunca se escriben.

export type IdPlan = 'vitrina' | 'operacion' | 'completo' | 'grupo'

export type Plan = {
  id: IdPlan
  nombre: string
  recomendado: boolean
  autos: { tipo: 'hasta' | 'mas_de'; tope: number }
  cuota: number
  implementacion: number
  // Grupo lleva «desde» en sus cuatro montos.
  desde: boolean
  semanas: readonly [number, number]
}

export const PLANES = [
  {
    id: 'vitrina',
    nombre: 'Vitrina',
    recomendado: false,
    autos: { tipo: 'hasta', tope: 20 },
    cuota: 490,
    implementacion: 4500,
    desde: false,
    semanas: [2, 2],
  },
  {
    id: 'operacion',
    nombre: 'Operación',
    recomendado: true,
    autos: { tipo: 'hasta', tope: 60 },
    cuota: 1290,
    implementacion: 12000,
    desde: false,
    semanas: [3, 4],
  },
  {
    id: 'completo',
    nombre: 'Completo',
    recomendado: false,
    autos: { tipo: 'hasta', tope: 150 },
    cuota: 2900,
    implementacion: 25000,
    desde: false,
    semanas: [4, 6],
  },
  {
    id: 'grupo',
    nombre: 'Grupo',
    recomendado: false,
    autos: { tipo: 'mas_de', tope: 150 },
    cuota: 5500,
    implementacion: 60000,
    desde: true,
    semanas: [8, 12],
  },
] as const satisfies readonly Plan[]

export function pagoAnual(cuota: number): number {
  return cuota * 10
}

export function ahorroAnual(cuota: number): number {
  return cuota * 12 - pagoAnual(cuota)
}

// Los textos que comparten las tarjetas y la tabla, siempre desde las constantes.

// «US$ 1.290», o «Desde US$ 5.500» en Grupo.
export function montoDelPlan(plan: Plan, monto: number): string {
  return plan.desde ? `Desde ${formatoUSD(monto)}` : formatoUSD(monto)
}

// «Hasta 60» o «Más de 150».
export function autosDelPlan({ autos }: Plan): string {
  const tope = formatearNumero(autos.tope)
  return autos.tipo === 'hasta' ? `Hasta ${tope}` : `Más de ${tope}`
}

// «3–4 semanas» (raya U+2013, sin espacios) o «2 semanas».
export function semanasDelPlan({ semanas: [desde, hasta] }: Plan): string {
  const rango =
    desde === hasta ? formatearNumero(desde) : `${formatearNumero(desde)}–${formatearNumero(hasta)}`
  return `${rango} semanas`
}
