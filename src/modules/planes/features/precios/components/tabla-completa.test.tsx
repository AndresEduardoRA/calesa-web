import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { PIE_DE_TABLA, tablaDePlanes } from '../../../entities/tabla'
import { NOMBRA_EL_EXCESO } from '../../../entities/x11.fixture'
import { TablaCompleta } from './tabla-completa'

function contar(tipo: 'incluido' | 'no_incluido'): number {
  return tablaDePlanes()
    .secciones.flatMap((s) => s.filas)
    .flatMap((f) => f.celdas)
    .filter((c) => c.tipo === tipo).length
}

describe('TablaCompleta (C3, C4)', () => {
  afterEach(cleanup)

  it('tiene caption, 4 columnas de plan, 4 grupos y 17 filas', () => {
    const { container } = render(<TablaCompleta />)
    const tabla = screen.getByRole('table', { name: 'Planes y precios: tabla completa' })
    expect(tabla.querySelector('caption')?.textContent).toBe('Planes y precios: tabla completa')
    expect(
      Array.from(container.querySelectorAll('th[scope="col"]')).map((th) => th.textContent),
    ).toEqual(['Vitrina', 'Operación (recomendado)', 'Completo', 'Grupo'])
    expect(
      Array.from(container.querySelectorAll('th[scope="colgroup"]')).map((th) => th.textContent),
    ).toEqual(['Montos', 'Tamaño', 'Sistema', 'Servicio'])
    expect(container.querySelectorAll('th[scope="row"]')).toHaveLength(17)
  })

  it('el pago anual de Operación es US$ 12.900', () => {
    const { container } = render(<TablaCompleta />)
    const fila = Array.from(container.querySelectorAll('th[scope="row"]')).find(
      (th) => th.textContent === 'Pago anual',
    )?.parentElement
    const celdas = Array.from(fila?.querySelectorAll('td') ?? []).map((td) => td.textContent)
    expect(celdas).toEqual(['US$ 4.900', 'US$ 12.900', 'US$ 29.000', 'Desde US$ 55.000'])
  })

  it('nombra las celdas incluidas y no incluidas con su texto oculto', () => {
    render(<TablaCompleta />)
    expect(screen.getAllByText('Incluido')).toHaveLength(contar('incluido'))
    expect(screen.getAllByText('No incluido')).toHaveLength(contar('no_incluido'))
  })

  it('lleva los dos textos de pie, en orden y literales', () => {
    const { container } = render(<TablaCompleta />)
    const pies = Array.from(container.querySelectorAll('[data-pie]')).map((p) => p.textContent)
    expect(pies).toEqual([...PIE_DE_TABLA])
  })

  it('ningún texto nombra el exceso de autos (X11)', () => {
    const { container } = render(<TablaCompleta />)
    expect(container.textContent).not.toMatch(NOMBRA_EL_EXCESO)
  })
})
