import { formatearNumero, formatearPorcentaje, formatoUSD } from '@/shared/lib/formato'

import type { FilaDeFugas } from './resumen'
import type { ConfigCalculadora, Volatilidad } from './config'
import { PROBABILIDAD_TARDE, SUPUESTOS as S, VOLATILIDAD } from './supuestos'

// «Cómo se calculó» (semilla §5.2, B4): las fórmulas en palabras y los datos del panel usados. Cada cifra sale de los supuestos, de
// `PROBABILIDAD_TARDE`, de `VOLATILIDAD` o de la config; ninguna se escribe a mano. Ningún texto nombra el exceso de autos (X11):
// por eso «tu margen» y nunca «por auto».

export type ComoSeCalculo = {
  entrada: string
  frases: { fila: FilaDeFugas; texto: string }[]
  datos: { etiqueta: string; valor: string }[]
}

// Las etiquetas de los datos del panel, en el orden de la fila de `config_calculadora`. El panel (P21) las reusa.
export const ETIQUETAS_DE_CONFIG: Readonly<Record<keyof ConfigCalculadora, string>> = {
  precio: 'Precio promedio de un auto',
  pct_sena: 'Compradores que dejan seña',
  sena: 'Seña promedio',
  moneda_local: 'Cobras en moneda local',
  pct_local: 'Parte que cobras en moneda local',
  volatilidad: 'Volatilidad del tipo de cambio',
  sueldo: 'Sueldo mensual de una persona del equipo',
  tasa: 'Tasa anual del dinero',
  ciclo_dias: 'Días de la compra a la entrega',
}

const NOMBRE_DE_VOLATILIDAD: Readonly<Record<Volatilidad, string>> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
}

const ENTRADA =
  'Usamos tus 5 datos, los datos de Calesa que ves abajo y supuestos fijos. El mínimo usa el valor bajo de cada supuesto y el máximo, el alto.'

// Un supuesto ya es fracción (0,15); un dato del panel viene en por ciento (15).
const pct = (fraccion: number) => formatearPorcentaje(fraccion)
const pctDelPanel = (porCiento: number) => formatearPorcentaje(porCiento / 100)
const num = (valor: number) => formatearNumero(valor)
const deA = ([minimo, maximo]: readonly [number, number]) => `de ${num(minimo)} a ${num(maximo)}`
const entre = ([minimo, maximo]: readonly [number, number]) =>
  `entre ${pct(minimo)} y ${pct(maximo)}`

function ventas(): string {
  const tarde = Object.values(PROBABILIDAD_TARDE)
  const s: [number, number] = [Math.min(...tarde), Math.max(...tarde)]
  return `Ventas por contestar tarde: de los clientes que te habrían comprado, ${entre(s)} recibe respuesta después de la primera hora, según cuánto tardas en contestar. De esos, ${entre(S.caida)} compra en otro lado. Cada venta perdida te cuesta tu margen.`
}

function dias(c: ConfigCalculadora): string {
  return `Días perdidos coordinando: cada auto pasa ${deA(S.dias_coord)} días más parado mientras se coordina, y cada día cuesta lo que pagaste por el auto (el precio de ${formatoUSD(c.precio)} menos tu margen) a una tasa de ${pctDelPanel(c.tasa)} al año.`
}

function cambio(c: ConfigCalculadora): string {
  if (!c.moneda_local) {
    return `Diferencia de tipo de cambio: no cobras en moneda local, así que esta fuga es ${formatoUSD(0)}.`
  }
  return `Diferencia de tipo de cambio: cobras ${pctDelPanel(c.pct_local)} de cada auto en moneda local, el tipo de cambio se mueve ${entre(VOLATILIDAD[c.volatilidad])} (volatilidad ${c.volatilidad}) y ${pct(S.no_ajusta)} de esa diferencia no la ajustas en el precio.`
}

function olvidos(): string {
  const [desde, hasta] = S.olvido_monto
  return `Costos que no se cobraron: ${entre(S.olvido_frec)} de los autos tiene un gasto que no le cobras al cliente, de ${formatoUSD(desde)} a ${formatoUSD(hasta)}.`
}

function saldos(c: ConfigCalculadora): string {
  return `Saldos cobrados tarde: ${pctDelPanel(c.pct_sena)} de los compradores deja una seña de ${formatoUSD(c.sena)} y el resto del precio llega ${deA(S.atraso)} días tarde, a una tasa de ${pctDelPanel(c.tasa)} al año.`
}

function tiempo(c: ConfigCalculadora): string {
  const mensajes = `contestar a los compradores con el auto en camino (el ${pctDelPanel(c.pct_sena)} que deja seña, con ${num(c.ciclo_dias)} días de la compra a la entrega; ${deA(S.preguntas)} preguntas por semana, ${num(S.min_mensaje)} minutos cada una)`
  const cotizar = `cotizar a mano ${pct(S.pct_cotiza)} de las consultas (${deA(S.min_cotiza)} minutos cada una)`
  const papeles = `papeles (${deA(S.h_papeles)} horas por semana por persona de administración)`
  return `Horas del equipo: el tiempo que se va en ${mensajes}, en ${cotizar} y en ${papeles}, con un sueldo de ${formatoUSD(c.sueldo)} por ${num(S.horas_mes)} horas al mes.`
}

function valorDelDato(c: ConfigCalculadora, clave: keyof ConfigCalculadora): string {
  switch (clave) {
    case 'precio':
    case 'sena':
    case 'sueldo':
      return formatoUSD(c[clave])
    case 'pct_sena':
    case 'pct_local':
    case 'tasa':
      return pctDelPanel(c[clave])
    case 'moneda_local':
      return c.moneda_local ? 'Sí' : 'No'
    case 'volatilidad':
      return NOMBRE_DE_VOLATILIDAD[c.volatilidad]
    case 'ciclo_dias':
      return num(c.ciclo_dias)
  }
}

export function comoSeCalculo(config: ConfigCalculadora): ComoSeCalculo {
  const claves = Object.keys(ETIQUETAS_DE_CONFIG) as (keyof ConfigCalculadora)[]
  return {
    entrada: ENTRADA,
    frases: [
      { fila: 'ventas', texto: ventas() },
      { fila: 'dias', texto: dias(config) },
      { fila: 'cambio', texto: cambio(config) },
      { fila: 'olvidos', texto: olvidos() },
      { fila: 'saldos', texto: saldos(config) },
      { fila: 'tiempo', texto: tiempo(config) },
    ],
    datos: claves.map((clave) => ({
      etiqueta: ETIQUETAS_DE_CONFIG[clave],
      valor: valorDelDato(config, clave),
    })),
  }
}
