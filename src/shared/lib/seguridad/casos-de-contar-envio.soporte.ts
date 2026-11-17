import type { Resultado } from '../errores'
import { LIMITES, VENTANA_SEGUNDOS, type ContarEnvio } from './limites'

// La tabla de casos del contrato de `ContarEnvio` (ventana fija). La corren los dos contadores: `crearContadorEnMemoria` y
// `contadorDeSupabase`. `supabase/tests/limites.sql` copia estos casos y los máximos de `LIMITES` porque SQL no importa TS: si cambia
// uno, cambia el otro. No es de producción: no se exporta en `index.ts` y las pruebas lo importan por su ruta. Importa `LIMITES` como
// valor, así que la prueba que lo use hace `vi.mock('server-only', () => ({}))`.

export type PasoDeCaso = { avanzarSegundos?: number; clave: string; permitido: boolean }

export type CasoDeContarEnvio = {
  nombre: string
  maximo: number
  ventanaSegundos: number
  pasos: readonly PasoDeCaso[]
}

export const INICIO_DE_LOS_CASOS = '2026-11-03T10:00:00Z'

export function relojFijo(inicio: string = INICIO_DE_LOS_CASOS) {
  let ahora = new Date(inicio).getTime()
  return {
    reloj: () => new Date(ahora),
    avanzar: (segundos: number) => {
      ahora += segundos * 1000
    },
  }
}

const si = (clave: string, avanzarSegundos?: number): PasoDeCaso => ({
  clave,
  permitido: true,
  ...(avanzarSegundos === undefined ? {} : { avanzarSegundos }),
})
const no = (clave: string, avanzarSegundos?: number): PasoDeCaso => ({
  ...si(clave, avanzarSegundos),
  permitido: false,
})

const porAccion = Object.entries(LIMITES).map(([accion, maximo]): CasoDeContarEnvio => ({
  nombre: `${accion}: ${maximo} envíos en la hora pasan y el siguiente no`,
  maximo,
  ventanaSegundos: VENTANA_SEGUNDOS,
  pasos: [...Array.from({ length: maximo }, () => si(`${accion}:x`)), no(`${accion}:x`)],
}))

export const CASOS_DE_CONTAR_ENVIO: readonly CasoDeContarEnvio[] = [
  {
    nombre: 'permite hasta el máximo dentro de la ventana y después no',
    maximo: 2,
    ventanaSegundos: 3600,
    pasos: [si('formulario:x'), si('formulario:x'), no('formulario:x')],
  },
  {
    nombre: 'a los 59:59 sigue la misma ventana; a la hora exacta se reinicia con conteo 1',
    maximo: 2,
    ventanaSegundos: 3600,
    pasos: [si('k'), si('k'), no('k', 3599), si('k', 1), si('k'), no('k')],
  },
  {
    nombre: 'cada clave lleva su propio conteo',
    maximo: 2,
    ventanaSegundos: 3600,
    pasos: [si('a'), si('a'), no('a'), si('b')],
  },
  ...porAccion,
]

// Corre los pasos de un caso en orden, moviendo el reloj antes de cada envío que lo pide, y devuelve lo que dio cada uno.
export async function recorrerCaso(
  caso: CasoDeContarEnvio,
  contar: ContarEnvio,
  avanzar: (segundos: number) => void,
): Promise<Resultado<boolean>[]> {
  const resultados: Resultado<boolean>[] = []
  for (const paso of caso.pasos) {
    if (paso.avanzarSegundos !== undefined) {
      avanzar(paso.avanzarSegundos)
    }
    resultados.push(
      await contar({
        clave: paso.clave,
        maximo: caso.maximo,
        ventanaSegundos: caso.ventanaSegundos,
      }),
    )
  }
  return resultados
}

export function esperadoDelCaso(caso: CasoDeContarEnvio): Resultado<boolean>[] {
  return caso.pasos.map((paso) => ({ ok: true, data: paso.permitido }))
}
