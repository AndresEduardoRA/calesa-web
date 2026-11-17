import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { BloqueDePrueba } from './bloque-de-prueba'

describe('BloqueDePrueba (C15, A2)', () => {
  afterEach(cleanup)

  it('dibuja el rótulo y el texto exacto de A0.2, sin logo', () => {
    const { container } = render(<BloqueDePrueba />)
    expect(screen.getByText('Ya funciona')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Ya funciona en una de las importadoras más grandes de Bolivia: 35 asesores y unos 40 autos al mes.',
      ),
    ).toBeInTheDocument()
    expect(container.querySelector('img, svg')).toBeNull()
  })
})
