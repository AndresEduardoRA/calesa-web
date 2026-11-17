import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { useEventoDelPrimerResultado } from './use-evento-del-primer-resultado'

describe('useEventoDelPrimerResultado (C12)', () => {
  const detalles: unknown[] = []
  const oir = (evento: Event) => detalles.push((evento as CustomEvent).detail)

  afterEach(() => {
    window.removeEventListener('calesa:evento', oir)
    detalles.length = 0
  })

  it('emite calesa:evento una sola vez, la primera vez que hay resultado', () => {
    window.addEventListener('calesa:evento', oir)
    const { rerender } = renderHook(({ listo }) => useEventoDelPrimerResultado(listo), {
      initialProps: { listo: false },
    })
    expect(detalles).toEqual([])
    rerender({ listo: true })
    rerender({ listo: false })
    rerender({ listo: true })
    expect(detalles).toEqual([{ tipo: 'calculadora_usada' }])
  })
})
