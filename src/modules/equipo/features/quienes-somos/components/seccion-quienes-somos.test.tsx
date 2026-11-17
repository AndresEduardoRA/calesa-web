import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { fallo, ok } from '@/shared/lib/errores'

import type { MiembroDelEquipo } from '../../../entities/miembro'
import { SeccionQuienesSomos } from './seccion-quienes-somos'

const FOTO = 'http://127.0.0.1:54321/storage/v1/object/public/equipo/abc.webp'

function miembro(extra: Partial<MiembroDelEquipo> = {}): MiembroDelEquipo {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    nombre: 'Andrés Rosas',
    cargo: 'Desarrollador y fundador de Calesa',
    frase: 'Construí Calesa para vender más.',
    fotoUrl: FOTO,
    ...extra,
  }
}

describe('SeccionQuienesSomos (C11)', () => {
  afterEach(cleanup)

  it('con ok([]) no dibuja nada', () => {
    const { container } = render(<SeccionQuienesSomos equipo={ok([])} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('con un fallo no dibuja nada', () => {
    const { container } = render(<SeccionQuienesSomos equipo={fallo('inesperado', 'x')} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('dibuja los miembros en el orden recibido', () => {
    render(
      <SeccionQuienesSomos
        equipo={ok([
          miembro(),
          miembro({
            id: '22222222-2222-4222-8222-222222222222',
            nombre: 'Carla Pérez',
            cargo: 'Ventas',
          }),
        ])}
      />,
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Quiénes somos' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Andrés Rosas',
      'Carla Pérez',
    ])
    const [primero] = screen.getAllByRole('listitem')
    expect(
      within(primero as HTMLElement).getByText('Desarrollador y fundador de Calesa'),
    ).toBeInTheDocument()
    expect(
      within(primero as HTMLElement).getByText('«Construí Calesa para vender más.»'),
    ).toBeInTheDocument()
  })

  it('la foto lleva el nombre como alt y su URL tal cual (sin /_next/image)', () => {
    render(<SeccionQuienesSomos equipo={ok([miembro()])} />)
    const img = screen.getByRole('img', { name: 'Andrés Rosas' })
    expect(img).toHaveAttribute('src', FOTO)
  })

  it('sin foto no hay imagen; sin frase no aparece «» ni null', () => {
    const { container } = render(
      <SeccionQuienesSomos equipo={ok([miembro({ fotoUrl: null, frase: null })])} />,
    )
    expect(screen.queryByRole('img')).toBeNull()
    expect(container.textContent).not.toContain('«')
    expect(container.textContent).not.toContain('null')
  })
})
