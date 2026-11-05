import { describe, expect, it } from 'vitest'
import { tarjetasDePlanes, type Tarjeta } from './tarjetas'
import { NOMBRA_EL_EXCESO } from './x11.fixture'

const TARJETAS_ESPERADAS: Tarjeta[] = [
  {
    id: 'vitrina',
    nombre: 'Vitrina',
    recomendado: false,
    tamano: 'Hasta 20 autos al mes',
    lineas: [
      'Vitrina web, reparto de consultas y cotizador',
      'Hasta 10 usuarios',
      '1 origen de compra y 1 país de destino',
      'Soporte con respuesta en 48 h',
    ],
    plazo: 'Funcionando en 2 semanas',
    mensual: 'US$ 490 /mes',
    anual: 'US$ 4.900 /año · ahorras US$ 980',
    implementacion: '+ implementación única de US$ 4.500',
  },
  {
    id: 'operacion',
    nombre: 'Operación',
    recomendado: true,
    tamano: 'Hasta 60 autos al mes',
    lineas: [
      'Todo lo de Vitrina, más inventario, reservas, señas y saldos',
      'Roles, cartera transferible y auditoría',
      'Logística por fases y portal «Mi vehículo»',
      'Usuarios ilimitados, 2 orígenes de compra y soporte en 24 h',
    ],
    plazo: 'Funcionando en 3–4 semanas',
    mensual: 'US$ 1.290 /mes',
    anual: 'US$ 12.900 /año · ahorras US$ 2.580',
    implementacion: '+ implementación única de US$ 12.000',
  },
  {
    id: 'completo',
    nombre: 'Completo',
    recomendado: false,
    tamano: 'Hasta 150 autos al mes',
    lineas: [
      'Todo lo de Operación, con logística a medida',
      'Portal «Mi vehículo» con tu marca',
      'Finanzas del dueño',
      'Todos los orígenes de compra y soporte en 4 h',
    ],
    plazo: 'Funcionando en 4–6 semanas',
    mensual: 'US$ 2.900 /mes',
    anual: 'US$ 29.000 /año · ahorras US$ 5.800',
    implementacion: '+ implementación única de US$ 25.000',
  },
  {
    id: 'grupo',
    nombre: 'Grupo',
    recomendado: false,
    tamano: 'Más de 150 autos al mes',
    lineas: [
      'Varios países de destino, con logística a medida por país',
      'Todos los orígenes de compra y zona franca',
      'Finanzas del dueño consolidadas',
      'Soporte en 2 h y gerente de cuenta',
    ],
    plazo: 'Funcionando en 8–12 semanas',
    mensual: 'Desde US$ 5.500 /mes',
    anual: 'Desde US$ 55.000 /año · ahorras desde US$ 11.000',
    implementacion: '+ implementación única desde US$ 60.000',
  },
]

const textos = (t: Tarjeta) => [
  t.tamano,
  ...t.lineas,
  t.plazo,
  t.mensual,
  t.anual,
  t.implementacion,
]

describe('tarjetasDePlanes (semilla §5.4, B6 y B7)', () => {
  const tarjetas = tarjetasDePlanes()

  it.each(TARJETAS_ESPERADAS)('la tarjeta de $nombre, texto por texto', (esperada) => {
    expect(tarjetas.find((t) => t.id === esperada.id)).toStrictEqual(esperada)
  })

  it('van en el orden de los planes', () => {
    expect(tarjetas.map((t) => t.id)).toEqual(['vitrina', 'operacion', 'completo', 'grupo'])
  })

  it('sólo Grupo lleva «desde», y en sus tres textos de montos', () => {
    const conDesde = tarjetas.filter((t) =>
      [t.mensual, t.anual, t.implementacion].some((x) => /desde/i.test(x)),
    )
    expect(conDesde.map((t) => t.id)).toEqual(['grupo'])
    const grupo = tarjetas[3]
    expect(
      [grupo?.mensual, grupo?.anual, grupo?.implementacion].map(
        (x) => (x?.match(/desde/gi) ?? []).length,
      ),
    ).toEqual([1, 2, 1])
  })

  it('ningún texto nombra el exceso de autos (X11)', () => {
    expect(tarjetas.flatMap(textos).filter((x) => NOMBRA_EL_EXCESO.test(x))).toEqual([])
  })
})
