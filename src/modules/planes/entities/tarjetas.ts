import { formatoUSD } from '@/shared/lib/formato'
import {
  PLANES,
  ahorroAnual,
  autosDelPlan,
  montoDelPlan,
  pagoAnual,
  semanasDelPlan,
  type IdPlan,
  type Plan,
} from './precios'

// Las tarjetas de planes (semilla §5.4, B6 y B7): tamaño, 3–4 líneas y plazo, con la cuota mensual al frente. Traen los textos de los
// dos estados del selector (Mensual y Anual) para que la pantalla no vuelva a calcular. Los textos de tamaño, plazo y líneas los eligió
// la persona en P03 (P1); las líneas salen de la tabla de §6.3, sin montos.

export type Tarjeta = {
  id: IdPlan
  nombre: string
  recomendado: boolean
  tamano: string
  lineas: readonly string[]
  plazo: string
  mensual: string
  anual: string
  implementacion: string
}

const LINEAS: Readonly<Record<IdPlan, readonly string[]>> = {
  vitrina: [
    'Vitrina web, reparto de consultas y cotizador',
    'Hasta 10 usuarios',
    '1 origen de compra y 1 país de destino',
    'Soporte con respuesta en 48 h',
  ],
  operacion: [
    'Todo lo de Vitrina, más inventario, reservas, señas y saldos',
    'Roles, cartera transferible y auditoría',
    'Logística por fases y portal «Mi vehículo»',
    'Usuarios ilimitados, 2 orígenes de compra y soporte en 24 h',
  ],
  completo: [
    'Todo lo de Operación, con logística a medida',
    'Portal «Mi vehículo» con tu marca',
    'Finanzas del dueño',
    'Todos los orígenes de compra y soporte en 4 h',
  ],
  grupo: [
    'Varios países de destino, con logística a medida por país',
    'Todos los orígenes de compra y zona franca',
    'Finanzas del dueño consolidadas',
    'Soporte en 2 h y gerente de cuenta',
  ],
}

// «US$ 12.900 /año · ahorras US$ 2.580», o con «desde» en los dos montos.
function textoAnual(plan: Plan): string {
  const ahorro = formatoUSD(ahorroAnual(plan.cuota))
  const ahorras = plan.desde ? `ahorras desde ${ahorro}` : `ahorras ${ahorro}`
  return `${montoDelPlan(plan, pagoAnual(plan.cuota))} /año · ${ahorras}`
}

function tarjeta(plan: Plan): Tarjeta {
  const implementacion = formatoUSD(plan.implementacion)
  return {
    id: plan.id,
    nombre: plan.nombre,
    recomendado: plan.recomendado,
    tamano: `${autosDelPlan(plan)} autos al mes`,
    lineas: LINEAS[plan.id],
    plazo: `Funcionando en ${semanasDelPlan(plan)}`,
    mensual: `${montoDelPlan(plan, plan.cuota)} /mes`,
    anual: textoAnual(plan),
    implementacion: plan.desde
      ? `+ implementación única desde ${implementacion}`
      : `+ implementación única de ${implementacion}`,
  }
}

export function tarjetasDePlanes(): Tarjeta[] {
  return PLANES.map(tarjeta)
}
