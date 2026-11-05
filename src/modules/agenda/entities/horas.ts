// Las horas que se ofrecen (§5.5, B10–B12, X10): inicios cada 30 min dentro del horario base,
// dentro de la ventana global y con al menos una persona elegible.
import { diaEnZona, instanteDeLocal, sumarDias } from '@/shared/lib/fechas'
import type { EntradaAgenda, Tramo } from './config'
import { candidatosPara } from './elegibilidad'
import { MS_POR_DIA, MS_POR_HORA, diaIsoDeSemana, minutosDe } from './tiempo'

// X10: el paso es fijo; la duración (X2) sólo decide si el inicio cabe en el tramo.
const PASO_MIN = 30

const dosDigitos = (n: number): string => String(n).padStart(2, '0')

function iniciosDelTramo(dia: string, tramo: Tramo, duracionMin: number, zona: string): string[] {
  const hasta = minutosDe(tramo.hasta)
  const inicios: string[] = []
  for (let m = minutosDe(tramo.desde); m + duracionMin <= hasta; m += PASO_MIN) {
    const local = `${dia}T${dosDigitos(Math.floor(m / 60))}:${dosDigitos(m % 60)}`
    const instante = instanteDeLocal(local, { zona })
    if (instante !== null) {
      inicios.push(instante)
    }
  }
  return inicios
}

function diasDeLaVentana(desde: number, hasta: number, zona: string): string[] {
  const ultimo = diaEnZona(new Date(hasta).toISOString(), { zona })
  const dias: string[] = []
  for (
    let dia = diaEnZona(new Date(desde).toISOString(), { zona });
    dia <= ultimo;
    dia = sumarDias(dia, 1)
  ) {
    dias.push(dia)
  }
  return dias
}

// Los inicios (ISO, UTC) ofrecidos, de menor a mayor y sin repetir.
export function horasDisponibles(entrada: EntradaAgenda): string[] {
  const { ahora, config, horarioBase } = entrada
  const desde = Date.parse(ahora) + config.anticipacionMinHoras * MS_POR_HORA
  const hasta = Date.parse(ahora) + config.horizonteDias * MS_POR_DIA
  const ofrecidas = new Set<string>()
  for (const dia of diasDeLaVentana(desde, hasta, config.zonaHoraria)) {
    const tramos = horarioBase.filter((t) => t.diaSemana === diaIsoDeSemana(dia))
    for (const tramo of tramos) {
      for (const inicio of iniciosDelTramo(dia, tramo, config.duracionMin, config.zonaHoraria)) {
        const ms = Date.parse(inicio)
        if (ms >= desde && ms <= hasta && candidatosPara(inicio, entrada).length > 0) {
          ofrecidas.add(inicio)
        }
      }
    }
  }
  return [...ofrecidas].sort((a, b) => Date.parse(a) - Date.parse(b))
}
