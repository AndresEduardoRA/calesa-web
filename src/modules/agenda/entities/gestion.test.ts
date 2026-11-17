import { describe, expect, it } from 'vitest'
import { TEXTO_CERRADA, TEXTO_FUERA_DE_PLAZO, estadoDeGestion } from './gestion'

// §5.8: reunión mar 3 nov 2026 10:00 en La Paz (14:00 UTC), cambiable hasta las 08:00 (12:00 UTC).
const reunion = (cambios: object = {}) => ({
  estado: 'confirmada' as const,
  cambiableHasta: '2026-11-03T12:00:00+00:00',
  puedeVolverAReservar: false,
  ...cambios,
})

describe('estadoDeGestion (C6)', () => {
  it('confirmada y dentro del plazo: se puede cambiar o cancelar', () => {
    expect(estadoDeGestion(reunion(), '2026-11-03T11:59:00Z')).toEqual({
      estado: 'cambiable',
      texto: null,
    })
  })

  it('el borde vale: a las 08:00:00 sí y a las 08:00:00.001 ya no', () => {
    expect(estadoDeGestion(reunion(), '2026-11-03T12:00:00.000+00:00').estado).toBe('cambiable')
    expect(estadoDeGestion(reunion(), '2026-11-03T12:00:00.001+00:00')).toEqual({
      estado: 'fuera_de_plazo',
      texto: 'Ya no se puede cambiar en línea. Escríbenos por WhatsApp.',
    })
  })

  it('cancelada y todavía a tiempo de volver a reservar: ofrece «Elegir otra hora»', () => {
    const cancelada = reunion({ estado: 'cancelada', puedeVolverAReservar: true })
    expect(estadoDeGestion(cancelada, '2026-11-03T13:00:00Z')).toEqual({
      estado: 'puede_volver_a_reservar',
      texto: null,
    })
  })

  it('cualquier otra (cancelada sin poder volver, realizada, no asistió): cerrada', () => {
    for (const estado of ['cancelada', 'realizada', 'no_asistio'] as const) {
      expect(estadoDeGestion(reunion({ estado }), '2026-11-03T11:00:00Z')).toEqual({
        estado: 'cerrada',
        texto: 'Esta demo ya no está confirmada.',
      })
    }
  })

  it('con un reloj inválido falla cerrado: fuera de plazo', () => {
    expect(estadoDeGestion(reunion(), 'no-es-fecha').estado).toBe('fuera_de_plazo')
  })

  it('los textos son los de la base (E6 y E8)', () => {
    expect(TEXTO_FUERA_DE_PLAZO).toBe('Ya no se puede cambiar en línea. Escríbenos por WhatsApp.')
    expect(TEXTO_CERRADA).toBe('Esta demo ya no está confirmada.')
  })
})
