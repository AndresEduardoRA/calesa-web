import type { EntradasCalculadora } from './entradas'

// El enlace «Agendar demo» desde la calculadora (recorrido 2, semilla §6.1): /agendar llega con los autos y la administración ya
// puestos. Sólo dos números que escribió el visitante, ningún dato personal.
export function enlaceParaAgendar({
  autos,
  administracion,
}: Pick<EntradasCalculadora, 'autos' | 'administracion'>): string {
  const parametros = new URLSearchParams({ autos: String(autos), adm: String(administracion) })
  return `/agendar?${parametros.toString()}`
}
