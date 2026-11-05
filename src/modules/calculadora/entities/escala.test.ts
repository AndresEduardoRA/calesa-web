import { describe, expect, it } from 'vitest'
import {
  calcularEscala,
  esquemaEntradasEscala,
  textosDeEscala,
  type EntradasEscala,
} from './escala'

const META_MENOR = 'La meta debe ser igual o mayor a lo que vendes hoy.'

const entrada = (
  autos_hoy: number,
  autos_meta: number,
  vendedores: number,
  administracion: number,
): EntradasEscala => ({ autos_hoy, autos_meta, vendedores, administracion })

const problemas = (e: unknown) =>
  esquemaEntradasEscala.safeParse(e).error?.issues.map((i) => [i.path.join('.'), i.message]) ?? []

type Caso = {
  caso: string
  e: EntradasEscala
  sin: number
  con: [number, number]
  textoCon: string
  personasMas: number
}

// A-C son de §5.3; F-H, derivados de §5.3 (ramas que A-C no tocan).
const CASOS_ESCALA: Caso[] = [
  {
    caso: 'A',
    e: entrada(25, 50, 3, 3),
    sin: 12,
    con: [11, 9],
    textoCon: 'Con Calesa: 9 a 11 personas',
    personasMas: 6,
  },
  {
    caso: 'B',
    e: entrada(30, 100, 4, 4),
    sin: 28,
    con: [24, 21],
    textoCon: 'Con Calesa: 21 a 24 personas',
    personasMas: 20,
  },
  {
    caso: 'C',
    e: entrada(10, 15, 2, 1),
    sin: 5,
    con: [5, 4],
    textoCon: 'Con Calesa: 4 a 5 personas',
    personasMas: 2,
  },
  {
    caso: 'F (un solo número)',
    e: entrada(20, 21, 10, 10),
    sin: 22,
    con: [20, 20],
    textoCon: 'Con Calesa: 20 personas',
    personasMas: 2,
  },
  {
    caso: 'G (épsilon de techo)',
    e: entrada(7, 29, 7, 7),
    sin: 58,
    con: [50, 44],
    textoCon: 'Con Calesa: 44 a 50 personas',
    personasMas: 44,
  },
  {
    caso: 'H (capacidades por área)',
    e: entrada(10, 20, 5, 1),
    sin: 12,
    con: [12, 11],
    textoCon: 'Con Calesa: 11 a 12 personas',
    personasMas: 6,
  },
]

describe('calcularEscala y textosDeEscala · casos de §5.3', () => {
  it.each(CASOS_ESCALA)('caso $caso', ({ e, sin, con, textoCon, personasMas }) => {
    const r = calcularEscala(e)
    expect(r).toStrictEqual({ tipo: 'crecer', sin, con, personas_mas: personasMas })
    const textos = textosDeEscala(e, r)
    expect(textos).toMatchObject({
      tipo: 'crecer',
      sin: `Sin sistema: ${String(sin)} personas`,
      con: textoCon,
      etiqueta: 'Cálculo aproximado',
    })
  })

  it('la frase del caso A dice de cuánto a cuánto y cuántas personas más', () => {
    const e = entrada(25, 50, 3, 3)
    expect(textosDeEscala(e, calcularEscala(e))).toMatchObject({
      frase:
        'Para pasar de 25 a 50 autos al mes, con tu forma de trabajar actual necesitarías 6 personas más.',
    })
  })

  it('I (derivado): las cifras de la frase llevan punto de miles', () => {
    const e = entrada(1000, 5000, 1, 1)
    expect(textosDeEscala(e, calcularEscala(e))).toMatchObject({
      frase:
        'Para pasar de 1.000 a 5.000 autos al mes, con tu forma de trabajar actual necesitarías 8 personas más.',
    })
  })

  it('D: con la misma cantidad no hay gráfica, sólo el texto', () => {
    const e = entrada(40, 40, 5, 4)
    const r = calcularEscala(e)
    expect(r).toStrictEqual({ tipo: 'misma_cantidad' })
    expect(textosDeEscala(e, r)).toStrictEqual({
      tipo: 'misma_cantidad',
      frase:
        'Con la misma cantidad de autos no necesitas contratar. Calesa te devuelve horas para vender más.',
    })
  })
})

describe('esquemaEntradasEscala', () => {
  it('acepta los casos A-D', () => {
    for (const e of [
      entrada(25, 50, 3, 3),
      entrada(30, 100, 4, 4),
      entrada(10, 15, 2, 1),
      entrada(40, 40, 5, 4),
    ]) {
      expect(problemas(e)).toEqual([])
    }
  })

  it('E: una meta menor que hoy da el error en la meta', () => {
    expect(problemas(entrada(20, 10, 3, 3))).toEqual([['autos_meta', META_MENOR]])
  })

  it('corre la regla de la meta aunque otro campo haya fallado', () => {
    expect(problemas(entrada(20, 10, 0, 3))).toEqual([
      ['vendedores', 'Escribe un número entero entre 1 y 500.'],
      ['autos_meta', META_MENOR],
    ])
  })

  it('corre la regla de la meta aunque otro campo no sea un número', () => {
    expect(problemas({ ...entrada(20, 10, 3, 3), administracion: 'tres' })).toEqual([
      ['administracion', 'Escribe un número entero entre 1 y 500.'],
      ['autos_meta', META_MENOR],
    ])
  })

  it('no corre la regla de la meta si uno de los dos falló su rango', () => {
    expect(problemas(entrada(2001, 10, 3, 3))).toEqual([
      ['autos_hoy', 'Escribe un número entero entre 1 y 2.000.'],
    ])
    expect(problemas(entrada(20, 0, 3, 3))).toEqual([
      ['autos_meta', 'Escribe un número entero entre 1 y 5.000.'],
    ])
  })

  it.each([
    ['autos_meta', entrada(20, 5001, 3, 3), 'Escribe un número entero entre 1 y 5.000.'],
    ['administracion', entrada(20, 40, 3, 501), 'Escribe un número entero entre 1 y 500.'],
  ])('%s fuera de rango da su mensaje', (campo, e, mensaje) => {
    expect(problemas(e)).toEqual([[campo, mensaje]])
  })
})
