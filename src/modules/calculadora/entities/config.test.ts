import { describe, expect, it } from 'vitest'
import { MENSAJE_INESPERADO } from '@/shared/lib/errores'
import { ETIQUETA_DE_CONFIG, esquemaConfigCalculadora, leerFilaDeConfig } from './config'
import { CONFIG_INICIAL } from './ejemplos.fixture'

const problemas = (config: unknown) =>
  esquemaConfigCalculadora
    .safeParse(config)
    .error?.issues.map((i) => [i.path.join('.'), i.message]) ?? []

const entero = (min: string, max: string) => `Escribe un número entero entre ${min} y ${max}.`
const monto = (min: string, max: string) =>
  `Escribe un monto entre US$ ${min} y US$ ${max}, sin centavos.`

describe('esquemaConfigCalculadora', () => {
  it('acepta los datos iniciales del panel', () => {
    expect(problemas(CONFIG_INICIAL)).toEqual([])
  })

  it.each([
    ['precio', 2999, monto('3.000', '150.000')],
    ['precio', 150001, monto('3.000', '150.000')],
    ['pct_sena', -1, entero('0', '100')],
    ['pct_sena', 101, entero('0', '100')],
    ['sena', -1, monto('0', '30.000')],
    ['sena', 30001, monto('0', '30.000')],
    ['pct_local', 101, entero('0', '100')],
    ['sueldo', 199, monto('200', '5.000')],
    ['sueldo', 5001, monto('200', '5.000')],
    ['tasa', -1, entero('0', '40')],
    ['tasa', 41, entero('0', '40')],
    ['ciclo_dias', 19, entero('20', '240')],
    ['ciclo_dias', 241, entero('20', '240')],
    ['volatilidad', 'muy_alta', 'Elige la volatilidad.'],
    ['moneda_local', 'si', 'Elige sí o no.'],
  ])('con %s = %s da su mensaje', (campo, valor, mensaje) => {
    expect(problemas({ ...CONFIG_INICIAL, [campo]: valor })).toEqual([[campo, mensaje]])
  })

  it.each([
    ['precio', 3000],
    ['precio', 150000],
    ['pct_sena', 0],
    ['sena', 0],
    ['sueldo', 200],
    ['tasa', 0],
    ['tasa', 40],
    ['ciclo_dias', 20],
    ['ciclo_dias', 240],
  ])('acepta %s = %s, un extremo', (campo, valor) => {
    expect(problemas({ ...CONFIG_INICIAL, [campo]: valor })).toEqual([])
  })
})

describe('leerFilaDeConfig (C6)', () => {
  const inesperado = { ok: false, error: { codigo: 'inesperado', mensaje: MENSAJE_INESPERADO } }

  it('da ok con un arreglo de exactamente una fila válida', () => {
    expect(leerFilaDeConfig([CONFIG_INICIAL])).toEqual({ ok: true, data: CONFIG_INICIAL })
  })

  it.each([
    ['sin filas', []],
    ['dos filas', [CONFIG_INICIAL, CONFIG_INICIAL]],
    ['un precio fuera de rango', [{ ...CONFIG_INICIAL, precio: 200 }]],
    ['una volatilidad desconocida', [{ ...CONFIG_INICIAL, volatilidad: 'x' }]],
    ['null', null],
    ['un objeto suelto', CONFIG_INICIAL],
  ])('da fallo inesperado con %s', (_caso, datos) => {
    expect(leerFilaDeConfig(datos)).toEqual(inesperado)
  })

  it('la etiqueta de la caché es «calculadora»', () => {
    expect(ETIQUETA_DE_CONFIG).toBe('calculadora')
  })
})
