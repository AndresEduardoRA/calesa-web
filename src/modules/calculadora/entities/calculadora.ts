import type { ConfigCalculadora } from './config'
import type { EntradasCalculadora } from './entradas'
import { PROBABILIDAD_TARDE, SUPUESTOS as S, VOLATILIDAD } from './supuestos'

// La fórmula de «Lo que se te escapa al mes» (semilla §5.2, pasos 1-7), literal. Nada se redondea aquí (X3): lo que se muestra sale
// de `resumen.ts`. Recibe datos ya validados por `esquemaEntradasCalculadora` y `esquemaConfigCalculadora`.

export type Escenario = {
  ventas: number
  dias: number
  cambio: number
  olvidos: number
  saldos: number
  tiempo: number
  total: number
  horas: number
}

export type ResultadoFugas = { minimo: Escenario; maximo: Escenario }

type Indice = 0 | 1
type Datos = { e: EntradasCalculadora; c: ConfigCalculadora; i: Indice }

// 1. Ventas por contestar tarde.
function ventas({ e, i }: Datos): number {
  const s = PROBABILIDAD_TARDE[e.respuesta]
  const caida = S.caida[i]
  const c = e.autos / e.consultas
  const cf = c / (1 - s * caida)
  return e.consultas * cf * caida * s * e.margen
}

// 2. Días perdidos coordinando.
function dias({ e, c, i }: Datos): number {
  const costo = Math.max(0, c.precio - e.margen)
  const diaAuto = (costo * (c.tasa / 100)) / 365
  return e.autos * S.dias_coord[i] * diaAuto
}

// 3. Diferencia de tipo de cambio.
function cambio({ e, c, i }: Datos): number {
  if (!c.moneda_local) return 0
  return e.autos * c.precio * (c.pct_local / 100) * VOLATILIDAD[c.volatilidad][i] * S.no_ajusta
}

// 4. Costos que no se cobraron.
function olvidos({ e, i }: Datos): number {
  return e.autos * S.olvido_frec[i] * S.olvido_monto[i]
}

// 5. Saldos cobrados tarde.
function saldos({ e, c, i }: Datos): number {
  const saldo = Math.max(0, c.precio - c.sena)
  return e.autos * (c.pct_sena / 100) * saldo * (S.atraso[i] / 365) * (c.tasa / 100)
}

// 6. Horas del equipo a mano.
function horas({ e, c, i }: Datos): number {
  const camino = (e.autos * c.ciclo_dias) / 30
  const compradores = (camino * c.pct_sena) / 100
  const hMsj = (compradores * S.preguntas[i] * S.semanas_mes * S.min_mensaje) / 60
  const hCot = (e.consultas * S.pct_cotiza * S.min_cotiza[i]) / 60
  const hPap = e.administracion * S.h_papeles[i] * S.semanas_mes
  return hMsj + hCot + hPap
}

function escenario(datos: Datos): Escenario {
  const h = horas(datos)
  const filas = {
    ventas: ventas(datos),
    dias: dias(datos),
    cambio: cambio(datos),
    olvidos: olvidos(datos),
    saldos: saldos(datos),
    tiempo: (h * datos.c.sueldo) / S.horas_mes,
  }
  // 7. El total del escenario.
  const total =
    filas.ventas + filas.dias + filas.cambio + filas.olvidos + filas.saldos + filas.tiempo
  return { ...filas, total, horas: h }
}

export function calcularFugas(
  entradas: EntradasCalculadora,
  config: ConfigCalculadora,
): ResultadoFugas {
  return {
    minimo: escenario({ e: entradas, c: config, i: 0 }),
    maximo: escenario({ e: entradas, c: config, i: 1 }),
  }
}
