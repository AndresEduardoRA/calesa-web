import { describe, expect, it } from 'vitest'

import { calcularFugas } from './calculadora'
import { comoSeCalculo, ETIQUETAS_DE_CONFIG } from './como-se-calculo'
import { CONFIG_E3, CONFIG_INICIAL, ENTRADAS_E1 } from './ejemplos.fixture'
import { resumenDeFugas } from './resumen'

// Copia de `NOMBRA_EL_EXCESO` de `planes/entities/x11.fixture.ts` (X11): un test no importa las tripas de otro módulo. Si cambia
// allá, se cambia aquí, en `etiquetas.test.ts` y en `features/publica/components/calculadora-publica.test.tsx`.
const NOMBRA_EL_EXCESO = /exceso|por auto|US\$ 25(?![.\d])/i

const ENTRADA =
  'Usamos tus 5 datos, los datos de Calesa que ves abajo y supuestos fijos. El mínimo usa el valor bajo de cada supuesto y el máximo, el alto.'

const FRASES_INICIALES = {
  ventas:
    'Ventas por contestar tarde: de los clientes que te habrían comprado, entre 15% y 90% recibe respuesta después de la primera hora, según cuánto tardas en contestar. De esos, entre 8% y 15% compra en otro lado. Cada venta perdida te cuesta tu margen.',
  dias: 'Días perdidos coordinando: cada auto pasa de 2 a 4 días más parado mientras se coordina, y cada día cuesta lo que pagaste por el auto (el precio de US$ 18.000 menos tu margen) a una tasa de 15% al año.',
  cambio:
    'Diferencia de tipo de cambio: cobras 40% de cada auto en moneda local, el tipo de cambio se mueve entre 0,5% y 1% (volatilidad media) y 50% de esa diferencia no la ajustas en el precio.',
  olvidos:
    'Costos que no se cobraron: entre 8% y 15% de los autos tiene un gasto que no le cobras al cliente, de US$ 150 a US$ 200.',
  saldos:
    'Saldos cobrados tarde: 60% de los compradores deja una seña de US$ 2.000 y el resto del precio llega de 4 a 8 días tarde, a una tasa de 15% al año.',
  tiempo:
    'Horas del equipo: el tiempo que se va en contestar a los compradores con el auto en camino (el 60% que deja seña, con 76 días de la compra a la entrega; de 1 a 1,5 preguntas por semana, 5 minutos cada una), en cotizar a mano 40% de las consultas (de 12 a 20 minutos cada una) y en papeles (de 3 a 6 horas por semana por persona de administración), con un sueldo de US$ 700 por 176 horas al mes.',
}

const DATOS_INICIALES = [
  { etiqueta: 'Precio promedio de un auto', valor: 'US$ 18.000' },
  { etiqueta: 'Compradores que dejan seña', valor: '60%' },
  { etiqueta: 'Seña promedio', valor: 'US$ 2.000' },
  { etiqueta: 'Cobras en moneda local', valor: 'Sí' },
  { etiqueta: 'Parte que cobras en moneda local', valor: '40%' },
  { etiqueta: 'Volatilidad del tipo de cambio', valor: 'Media' },
  { etiqueta: 'Sueldo mensual de una persona del equipo', valor: 'US$ 700' },
  { etiqueta: 'Tasa anual del dinero', valor: '15%' },
  { etiqueta: 'Días de la compra a la entrega', valor: '76' },
]

const frase = (config: Parameters<typeof comoSeCalculo>[0], fila: string) =>
  comoSeCalculo(config).frases.find((f) => f.fila === fila)?.texto

const valor = (config: Parameters<typeof comoSeCalculo>[0], etiqueta: string) =>
  comoSeCalculo(config).datos.find((d) => d.etiqueta === etiqueta)?.valor

describe('comoSeCalculo (C13, B4)', () => {
  it('con la config inicial da la entrada, las 6 frases y los 9 datos exactos', () => {
    const como = comoSeCalculo(CONFIG_INICIAL)
    expect(como.entrada).toBe(ENTRADA)
    expect(Object.fromEntries(como.frases.map((f) => [f.fila, f.texto]))).toEqual(FRASES_INICIALES)
    expect(como.datos).toEqual(DATOS_INICIALES)
  })

  it('las etiquetas de los datos del panel son las de ETIQUETAS_DE_CONFIG, en el orden de la fila', () => {
    expect(Object.keys(ETIQUETAS_DE_CONFIG)).toEqual(Object.keys(CONFIG_INICIAL))
    expect(Object.values(ETIQUETAS_DE_CONFIG)).toEqual(DATOS_INICIALES.map((d) => d.etiqueta))
  })

  it('sin moneda local, la fuga de cambio es US$ 0 y el dato dice «No»', () => {
    expect(frase(CONFIG_E3, 'cambio')).toBe(
      'Diferencia de tipo de cambio: no cobras en moneda local, así que esta fuga es US$ 0.',
    )
    expect(valor(CONFIG_E3, 'Cobras en moneda local')).toBe('No')
  })

  it('con volatilidad alta, el rango es de 1% a 3%', () => {
    const config = { ...CONFIG_INICIAL, volatilidad: 'alta' as const }
    expect(frase(config, 'cambio')).toContain('entre 1% y 3% (volatilidad alta)')
    expect(valor(config, 'Volatilidad del tipo de cambio')).toBe('Alta')
  })

  it('el precio sale de la config', () => {
    const config = { ...CONFIG_INICIAL, precio: 25000 }
    expect(frase(config, 'dias')).toContain('(el precio de US$ 25.000 menos tu margen)')
    expect(valor(config, 'Precio promedio de un auto')).toBe('US$ 25.000')
  })

  it('el porcentaje de seña sale de la config en saldos y en tiempo', () => {
    const config = { ...CONFIG_INICIAL, pct_sena: 50 }
    expect(frase(config, 'saldos')).toContain('50% de los compradores')
    expect(frase(config, 'tiempo')).toContain('(el 50% que deja seña,')
  })

  it('las frases van en el orden del desglose y empiezan con la etiqueta de su fila', () => {
    const filas = resumenDeFugas(calcularFugas(ENTRADAS_E1, CONFIG_INICIAL)).filas
    const frases = comoSeCalculo(CONFIG_INICIAL).frases
    expect(frases.map((f) => f.fila)).toEqual(filas.map((f) => f.fila))
    frases.forEach((f, i) =>
      expect(f.texto.startsWith(`${filas[i]?.etiqueta ?? '?'}: `)).toBe(true),
    )
  })

  it('ningún texto nombra el exceso de autos (X11)', () => {
    for (const config of [CONFIG_INICIAL, CONFIG_E3]) {
      const como = comoSeCalculo(config)
      const textos = [
        como.entrada,
        ...como.frases.map((f) => f.texto),
        ...como.datos.flatMap((d) => [d.etiqueta, d.valor]),
      ]
      for (const texto of textos) expect(texto).not.toMatch(NOMBRA_EL_EXCESO)
    }
  })
})
