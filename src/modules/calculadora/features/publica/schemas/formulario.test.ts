import { describe, expect, it } from 'vitest'

import { ENTRADAS_E1 } from '../../../entities/ejemplos.fixture'
import { entradasDelFormulario, type ValoresDelFormulario } from './formulario'

const VACIO: ValoresDelFormulario = {
  autos: '',
  margen: '',
  consultas: '',
  respuesta: '',
  administracion: '',
}

const E1_EN_TEXTO: ValoresDelFormulario = {
  autos: '25',
  margen: '1800',
  consultas: '300',
  respuesta: 'dia',
  administracion: '3',
}

const RANGO_AUTOS = 'Escribe un número entero entre 1 y 400.'

describe('entradasDelFormulario (C8)', () => {
  it('todo vacío: incompleto y sin errores', () => {
    expect(entradasDelFormulario(VACIO)).toEqual({ estado: 'incompleto', errores: {} })
  })

  it('el ejemplo 1 en texto: listo con sus entradas', () => {
    expect(entradasDelFormulario(E1_EN_TEXTO)).toEqual({ estado: 'listo', entradas: ENTRADAS_E1 })
  })

  it('lee el punto de miles: «1.800» es 1800', () => {
    expect(entradasDelFormulario({ ...E1_EN_TEXTO, margen: '1.800' })).toEqual({
      estado: 'listo',
      entradas: ENTRADAS_E1,
    })
  })

  it('los espacios alrededor no cuentan', () => {
    expect(entradasDelFormulario({ ...E1_EN_TEXTO, autos: ' 25 ' })).toEqual({
      estado: 'listo',
      entradas: ENTRADAS_E1,
    })
  })

  it.each(['1,5', '18a', '-3', '0'])('«%s» en autos da el mensaje de rango del campo', (texto) => {
    expect(entradasDelFormulario({ ...VACIO, autos: texto })).toEqual({
      estado: 'incompleto',
      errores: { autos: RANGO_AUTOS },
    })
  })

  it('un campo vacío no da error aunque otro esté mal', () => {
    expect(entradasDelFormulario({ ...E1_EN_TEXTO, margen: '', autos: '500' })).toEqual({
      estado: 'incompleto',
      errores: { autos: RANGO_AUTOS },
    })
  })

  it('consultas menos que autos: el error va bajo consultas', () => {
    expect(entradasDelFormulario({ ...VACIO, autos: '25', consultas: '10' })).toEqual({
      estado: 'incompleto',
      errores: { consultas: 'Las consultas no pueden ser menos que los autos vendidos.' },
    })
  })

  it('la respuesta sin elegir no da error', () => {
    expect(entradasDelFormulario({ ...E1_EN_TEXTO, respuesta: '' })).toEqual({
      estado: 'incompleto',
      errores: {},
    })
  })
})
