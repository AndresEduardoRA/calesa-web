import { describe, expect, it } from 'vitest'
import { PIE_DE_TABLA, TEXTO_DE_CELDA, tablaDePlanes, type Celda } from './tabla'
import { NOMBRA_EL_EXCESO } from './x11.fixture'

const t = (texto: string): Celda => ({ tipo: 'texto', texto })
const SI: Celda = { tipo: 'incluido' }
const NO: Celda = { tipo: 'no_incluido' }

// La tabla de §6.3, celda por celda: [etiqueta, Vitrina, Operación, Completo, Grupo].
const TABLA_ESPERADA: [string, [string, Celda, Celda, Celda, Celda][]][] = [
  [
    'Montos',
    [
      ['Cuota mensual', t('US$ 490'), t('US$ 1.290'), t('US$ 2.900'), t('Desde US$ 5.500')],
      ['Pago anual', t('US$ 4.900'), t('US$ 12.900'), t('US$ 29.000'), t('Desde US$ 55.000')],
      ['Ahorro', t('US$ 980'), t('US$ 2.580'), t('US$ 5.800'), t('Desde US$ 11.000')],
      [
        'Implementación única',
        t('US$ 4.500'),
        t('US$ 12.000'),
        t('US$ 25.000'),
        t('Desde US$ 60.000'),
      ],
    ],
  ],
  [
    'Tamaño',
    [
      ['Autos al mes', t('Hasta 20'), t('Hasta 60'), t('Hasta 150'), t('Más de 150')],
      ['Usuarios', t('Hasta 10'), t('Ilimitados'), t('Ilimitados'), t('Ilimitados')],
      ['Orígenes de compra', t('1'), t('2'), t('Todos'), t('Todos + zona franca')],
      ['Países de destino', t('1'), t('1'), t('1'), t('Varios')],
    ],
  ],
  [
    'Sistema',
    [
      ['Vitrina web, reparto de consultas y cotizador', SI, SI, SI, SI],
      ['Inventario, reservas, señas y saldos', NO, SI, SI, SI],
      ['Roles, cartera transferible y auditoría', NO, SI, SI, SI],
      [
        'Logística por fases con documentos',
        NO,
        t('Estándar'),
        t('A medida'),
        t('A medida por país'),
      ],
      ['Portal «Mi vehículo»', NO, SI, t('Con tu marca'), t('Con tu marca')],
      ['Finanzas del dueño', NO, t('Extra'), SI, t('Sí, consolidado')],
    ],
  ],
  [
    'Servicio',
    [
      ['Funcionando en', t('2 semanas'), t('3–4 semanas'), t('4–6 semanas'), t('8–12 semanas')],
      ['Respuesta del soporte', t('48 h'), t('24 h'), t('4 h'), t('2 h + gerente de cuenta')],
      ['Servidor, mejoras y cambios de impuestos', SI, SI, SI, SI],
    ],
  ],
]

describe('tablaDePlanes (semilla §6.3 y §5.4)', () => {
  const tabla = tablaDePlanes()

  it('el encabezado son los cuatro planes, con Operación recomendado', () => {
    expect(tabla.planes).toStrictEqual([
      { id: 'vitrina', nombre: 'Vitrina', recomendado: false },
      { id: 'operacion', nombre: 'Operación', recomendado: true },
      { id: 'completo', nombre: 'Completo', recomendado: false },
      { id: 'grupo', nombre: 'Grupo', recomendado: false },
    ])
  })

  it('tiene las cuatro secciones en orden', () => {
    expect(tabla.secciones.map((s) => s.titulo)).toEqual(TABLA_ESPERADA.map(([titulo]) => titulo))
  })

  it.each(TABLA_ESPERADA)('la sección %s, celda por celda', (titulo, filas) => {
    expect(tabla.secciones.find((s) => s.titulo === titulo)?.filas).toStrictEqual(
      filas.map(([etiqueta, ...celdas]) => ({ etiqueta, celdas })),
    )
  })

  it('el pie son los dos textos de §5.4, y las celdas dicen «Incluido» o «No incluido»', () => {
    expect(PIE_DE_TABLA).toStrictEqual([
      'Montos en US$, sin impuestos. Aceptamos bolivianos al tipo de cambio oficial del día.',
      'También puedes comprar la licencia, pagar la implementación en hitos o sumar extras: te lo detallamos en la propuesta.',
    ])
    expect(TEXTO_DE_CELDA).toStrictEqual({ incluido: 'Incluido', no_incluido: 'No incluido' })
  })

  it('ni la tabla ni el pie nombran el exceso de autos (X11)', () => {
    const celdas = tabla.secciones.flatMap((s) =>
      s.filas.flatMap((f) => [
        f.etiqueta,
        ...f.celdas.map((c) => (c.tipo === 'texto' ? c.texto : '')),
      ]),
    )
    expect([...celdas, ...PIE_DE_TABLA].filter((x) => NOMBRA_EL_EXCESO.test(x))).toEqual([])
  })
})
