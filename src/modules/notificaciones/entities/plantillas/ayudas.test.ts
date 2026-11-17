import { describe, expect, it } from 'vitest'

import { REUNION, REUNION_EN_BOGOTA } from '../ejemplos.soporte'
import { enlaceDeActividad, enlaceDeSolicitud, fechaDe, minutosDeDuracion } from './ayudas'

describe('las ayudas de las plantillas', () => {
  it('la fecha depende de quién lee', () => {
    expect(fechaDe(REUNION.inicio, REUNION_EN_BOGOTA, 'visitante')).toBe('3 nov 2026, 09:00')
    expect(fechaDe(REUNION.inicio, REUNION_EN_BOGOTA, 'equipo')).toBe(
      '3 nov 2026, 10:00 (hora de Bolivia)',
    )
  })

  it('la duración sale de inicio y fin', () => {
    expect(minutosDeDuracion(REUNION)).toBe(30)
  })

  it('los enlaces del panel son absolutos', () => {
    expect(enlaceDeSolicitud('https://calesa.app', 'abc')).toBe(
      'https://calesa.app/panel/solicitudes/abc',
    )
    expect(enlaceDeActividad('https://calesa.app')).toBe('https://calesa.app/panel/actividad')
  })
})
