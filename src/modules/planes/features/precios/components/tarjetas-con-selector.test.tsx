import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { tarjetasDePlanes } from '../../../entities/tarjetas'
import { NOMBRA_EL_EXCESO } from '../../../entities/x11.fixture'
import { TarjetasConSelector } from './tarjetas-con-selector'

const MENSUALES = ['US$ 490 /mes', 'US$ 1.290 /mes', 'US$ 2.900 /mes', 'Desde US$ 5.500 /mes']

function tarjetas() {
  return screen.getAllByRole('listitem').filter((li) => li.querySelector('h3') !== null)
}

describe('TarjetasConSelector (C1, C2, C4)', () => {
  afterEach(cleanup)

  it('dibuja las 4 tarjetas en orden con nombre, tamaño, 4 líneas y plazo', () => {
    render(<TarjetasConSelector />)
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Vitrina',
      'Operación',
      'Completo',
      'Grupo',
    ])
    const datos = tarjetasDePlanes()
    tarjetas().forEach((li, i) => {
      const tarjeta = datos[i]
      if (!tarjeta) throw new Error(`falta la tarjeta ${String(i)}`)
      const dentro = within(li)
      expect(dentro.getByText(tarjeta.tamano)).toBeInTheDocument()
      expect(dentro.getByText(tarjeta.plazo)).toBeInTheDocument()
      for (const linea of tarjeta.lineas) expect(dentro.getByText(linea)).toBeInTheDocument()
      expect(li.querySelectorAll('ul > li')).toHaveLength(4)
    })
  })

  it('arranca en Mensual con la cuota mensual al frente', () => {
    render(<TarjetasConSelector />)
    const grupo = screen.getByRole('group', { name: 'Forma de pago' })
    expect(within(grupo).getByRole('radio', { name: 'Mensual' })).toBeChecked()
    expect(within(grupo).getByRole('radio', { name: 'Anual' })).not.toBeChecked()
    for (const cuota of MENSUALES) expect(screen.getByText(cuota)).toBeInTheDocument()
    expect(screen.queryByText(/\/año/)).toBeNull()
  })

  it('con Anual muestra el pago anual y el ahorro', () => {
    render(<TarjetasConSelector />)
    fireEvent.click(screen.getByRole('radio', { name: 'Anual' }))
    expect(screen.getByRole('radio', { name: 'Anual' })).toBeChecked()
    expect(screen.getByText('US$ 12.900 /año · ahorras US$ 2.580')).toBeInTheDocument()
    expect(screen.getByText('Desde US$ 55.000 /año · ahorras desde US$ 11.000')).toBeInTheDocument()
    for (const cuota of MENSUALES) expect(screen.queryByText(cuota)).toBeNull()
  })

  it('la implementación va en los dos estados', () => {
    render(<TarjetasConSelector />)
    const implementaciones = tarjetasDePlanes().map((t) => t.implementacion)
    for (const texto of implementaciones) expect(screen.getByText(texto)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Anual' }))
    for (const texto of implementaciones) expect(screen.getByText(texto)).toBeInTheDocument()
  })

  it('«Recomendado» va sólo en Operación', () => {
    render(<TarjetasConSelector />)
    const [vitrina, operacion, completo, grupo] = tarjetas()
    expect(within(operacion as HTMLElement).getByText('Recomendado')).toBeInTheDocument()
    for (const otra of [vitrina, completo, grupo]) {
      expect(within(otra as HTMLElement).queryByText('Recomendado')).toBeNull()
    }
  })

  it('ningún texto nombra el exceso de autos (X11), en Mensual ni en Anual', () => {
    const { container } = render(<TarjetasConSelector />)
    expect(container.textContent).not.toMatch(NOMBRA_EL_EXCESO)
    fireEvent.click(screen.getByRole('radio', { name: 'Anual' }))
    expect(container.textContent).not.toMatch(NOMBRA_EL_EXCESO)
  })
})
