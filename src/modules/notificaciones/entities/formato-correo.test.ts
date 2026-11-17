import { describe, expect, it } from 'vitest'

import {
  cortarParaAsunto,
  fechaParaEquipo,
  fechaParaVisitante,
  importadoraONombre,
} from './formato-correo'

const INICIO = '2026-11-03T14:00:00Z' // mar 3 nov 2026, 10:00 en La Paz

describe('las fechas de los correos', () => {
  it('al visitante, en su zona y sin rótulo', () => {
    expect(fechaParaVisitante(INICIO, 'America/La_Paz')).toBe('mar 3 nov, 10:00')
    expect(fechaParaVisitante(INICIO, 'America/Bogota')).toBe('mar 3 nov, 09:00')
  })

  it('al equipo, en la hora de Bolivia y con el rótulo', () => {
    expect(fechaParaEquipo(INICIO)).toBe('mar 3 nov, 10:00 (hora de Bolivia)')
  })
})

describe('cortarParaAsunto', () => {
  it('deja un texto corto tal cual y junta los espacios', () => {
    expect(cortarParaAsunto('  Importadora   X ')).toBe('Importadora X')
  })

  it('corta a 80 letras y termina en «…»', () => {
    const cortado = cortarParaAsunto('a'.repeat(300))
    expect(Array.from(cortado)).toHaveLength(80)
    expect(cortado.endsWith('…')).toBe(true)
  })

  it('no parte un carácter de varios bytes', () => {
    expect(Array.from(cortarParaAsunto('ñ'.repeat(100)))).toHaveLength(80)
  })
})

describe('importadoraONombre', () => {
  it('usa la importadora y, sin ella, el nombre', () => {
    expect(importadoraONombre('Importadora X', 'Ana')).toBe('Importadora X')
    expect(importadoraONombre(null, 'Ana')).toBe('Ana')
    expect(importadoraONombre('  ', 'Ana')).toBe('Ana')
  })
})
