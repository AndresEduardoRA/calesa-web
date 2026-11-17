import { describe, expect, it } from 'vitest'

import { TIEMPOS_DE_RESPUESTA } from './entradas'
import { ETIQUETAS_DEL_FORMULARIO } from './etiquetas'

// Copia de `NOMBRA_EL_EXCESO` de `planes/entities/x11.fixture.ts` (X11): un test no importa las tripas de otro módulo. Si cambia
// allá, se cambia aquí, en `como-se-calculo.test.ts` y en `features/publica/components/calculadora-publica.test.tsx`.
const NOMBRA_EL_EXCESO = /exceso|por auto|US\$ 25(?![.\d])/i

describe('ETIQUETAS_DEL_FORMULARIO (C7, P5)', () => {
  it('son las 5 etiquetas de P5, literales', () => {
    expect(ETIQUETAS_DEL_FORMULARIO.campos).toEqual({
      autos: 'Autos que vendes al mes',
      margen: 'Margen promedio de cada auto',
      consultas: 'Consultas que recibes al mes',
      respuesta: '¿Cuánto tardas en contestar una consulta?',
      administracion: 'Personas en administración y logística',
    })
  })

  it('tiene una opción por cada tiempo de respuesta, con los textos de P5', () => {
    expect(Object.keys(ETIQUETAS_DEL_FORMULARIO.respuestas)).toEqual([...TIEMPOS_DE_RESPUESTA])
    expect(ETIQUETAS_DEL_FORMULARIO.respuestas).toEqual({
      h1: 'En menos de 1 hora',
      h4: 'En 1 a 4 horas',
      dia: 'En el mismo día',
      sig: 'Al día siguiente',
    })
  })

  it('ninguna nombra el exceso de autos (X11)', () => {
    const textos = [
      ...Object.values(ETIQUETAS_DEL_FORMULARIO.campos),
      ...Object.values(ETIQUETAS_DEL_FORMULARIO.respuestas),
    ]
    for (const texto of textos) expect(texto).not.toMatch(NOMBRA_EL_EXCESO)
  })
})
