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

// La tabla completa de `/planes` (semilla §6.3): Montos, Tamaño, Sistema y Servicio, por plan. Los montos, los autos y las semanas
// salen de `PLANES`; lo demás es la copia fija de §6.3. El «sí» de §6.3 es una celda incluida (la persona lo eligió en P03, P7).

export type Celda =
  { tipo: 'texto'; texto: string } | { tipo: 'incluido' } | { tipo: 'no_incluido' }

export type FilaDeTabla = { etiqueta: string; celdas: Celda[] }

export type TablaDePlanes = {
  planes: { id: IdPlan; nombre: string; recomendado: boolean }[]
  secciones: { titulo: string; filas: FilaDeTabla[] }[]
}

// El texto oculto de las celdas sin texto (check y guion).
export const TEXTO_DE_CELDA = { incluido: 'Incluido', no_incluido: 'No incluido' } as const

export const PIE_DE_TABLA = [
  'Montos en US$, sin impuestos. Aceptamos bolivianos al tipo de cambio oficial del día.',
  'También puedes comprar la licencia, pagar la implementación en hitos o sumar extras: te lo detallamos en la propuesta.',
] as const

const t = (texto: string): Celda => ({ tipo: 'texto', texto })
const SI: Celda = { tipo: 'incluido' }
const NO: Celda = { tipo: 'no_incluido' }

// Una fila calculada desde cada plan.
const porPlan = (etiqueta: string, celda: (plan: Plan) => Celda): FilaDeTabla => ({
  etiqueta,
  celdas: PLANES.map(celda),
})

// Una fila de copia fija, en el orden Vitrina, Operación, Completo, Grupo.
const fija = (etiqueta: string, celdas: [Celda, Celda, Celda, Celda]): FilaDeTabla => ({
  etiqueta,
  celdas,
})

function montos(): FilaDeTabla[] {
  return [
    porPlan('Cuota mensual', (p) => t(montoDelPlan(p, p.cuota))),
    porPlan('Pago anual', (p) => t(montoDelPlan(p, pagoAnual(p.cuota)))),
    porPlan('Ahorro', (p) => t(montoDelPlan(p, ahorroAnual(p.cuota)))),
    porPlan('Implementación única', (p) => t(montoDelPlan(p, p.implementacion))),
  ]
}

function tamano(): FilaDeTabla[] {
  return [
    porPlan('Autos al mes', (p) => t(autosDelPlan(p))),
    fija('Usuarios', [t('Hasta 10'), t('Ilimitados'), t('Ilimitados'), t('Ilimitados')]),
    fija('Orígenes de compra', [t('1'), t('2'), t('Todos'), t('Todos + zona franca')]),
    fija('Países de destino', [t('1'), t('1'), t('1'), t('Varios')]),
  ]
}

function sistema(): FilaDeTabla[] {
  return [
    fija('Vitrina web, reparto de consultas y cotizador', [SI, SI, SI, SI]),
    fija('Inventario, reservas, señas y saldos', [NO, SI, SI, SI]),
    fija('Roles, cartera transferible y auditoría', [NO, SI, SI, SI]),
    fija('Logística por fases con documentos', [
      NO,
      t('Estándar'),
      t('A medida'),
      t('A medida por país'),
    ]),
    fija('Portal «Mi vehículo»', [NO, SI, t('Con tu marca'), t('Con tu marca')]),
    fija('Finanzas del dueño', [NO, t('Extra'), SI, t('Sí, consolidado')]),
  ]
}

function servicio(): FilaDeTabla[] {
  return [
    porPlan('Funcionando en', (p) => t(semanasDelPlan(p))),
    fija('Respuesta del soporte', [t('48 h'), t('24 h'), t('4 h'), t('2 h + gerente de cuenta')]),
    fija('Servidor, mejoras y cambios de impuestos', [SI, SI, SI, SI]),
  ]
}

export function tablaDePlanes(): TablaDePlanes {
  return {
    planes: PLANES.map(({ id, nombre, recomendado }) => ({ id, nombre, recomendado })),
    secciones: [
      { titulo: 'Montos', filas: montos() },
      { titulo: 'Tamaño', filas: tamano() },
      { titulo: 'Sistema', filas: sistema() },
      { titulo: 'Servicio', filas: servicio() },
    ],
  }
}
