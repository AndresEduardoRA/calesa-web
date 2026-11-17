import { describe, expect, it } from 'vitest'

import {
  ETIQUETA_DEL_EQUIPO,
  esquemaFilaDelEquipoVisible,
  leerFilasDelEquipo,
  urlDeFoto,
} from './miembro'

const BASE = 'http://127.0.0.1:54321'
const ID = '11111111-1111-4111-8111-111111111111'

function fila(extra: Record<string, unknown> = {}) {
  return {
    id: ID,
    nombre: 'Andrés Rosas',
    cargo: 'Fundador',
    frase: 'Una frase.',
    foto_ruta: 'abc.webp',
    orden: 1,
    ...extra,
  }
}

describe('esquemaFilaDelEquipoVisible (C5)', () => {
  it('acepta una fila válida', () => {
    expect(esquemaFilaDelEquipoVisible.safeParse(fila()).success).toBe(true)
  })
  it('acepta frase y foto null', () => {
    expect(
      esquemaFilaDelEquipoVisible.safeParse(fila({ frase: null, foto_ruta: null })).success,
    ).toBe(true)
  })
  it.each([
    ['id que no es guid', { id: 'uno' }],
    ['nombre de 1', { nombre: 'A' }],
    ['nombre de 81', { nombre: 'A'.repeat(81) }],
    ['cargo de 81', { cargo: 'A'.repeat(81) }],
    ['frase de 401', { frase: 'A'.repeat(401) }],
    ['foto_ruta vacía', { foto_ruta: '' }],
    ['foto_ruta de 201', { foto_ruta: 'a'.repeat(201) }],
    ['orden decimal', { orden: 1.5 }],
  ])('rechaza %s', (_caso, extra) => {
    expect(esquemaFilaDelEquipoVisible.safeParse(fila(extra)).success).toBe(false)
  })
})

describe('frase (C6)', () => {
  it.each(['', '   '])('«%s» pasa a null', (frase) => {
    const r = leerFilasDelEquipo([fila({ frase })], BASE)
    expect(r.ok && r.data[0]?.frase).toBeNull()
  })
  it('una frase con texto queda tal cual', () => {
    const r = leerFilasDelEquipo([fila({ frase: ' hola ' })], BASE)
    expect(r.ok && r.data[0]?.frase).toBe(' hola ')
  })
})

describe('urlDeFoto (C7)', () => {
  it('arma la URL pública del bucket equipo', () => {
    expect(urlDeFoto(BASE, 'abc.webp')).toBe(`${BASE}/storage/v1/object/public/equipo/abc.webp`)
  })
  it('con y sin barra final en la base', () => {
    expect(urlDeFoto(`${BASE}/`, 'a.webp')).toBe(urlDeFoto(BASE, 'a.webp'))
    expect(urlDeFoto(`${BASE}//`, 'a.webp')).toBe(urlDeFoto(BASE, 'a.webp'))
  })
  it('codifica cada segmento y conserva las barras', () => {
    expect(urlDeFoto(BASE, 'una carpeta/foto 1.webp')).toBe(
      `${BASE}/storage/v1/object/public/equipo/una%20carpeta/foto%201.webp`,
    )
  })
})

describe('leerFilasDelEquipo (C8)', () => {
  it('conserva el orden recibido y arma fotoUrl', () => {
    const r = leerFilasDelEquipo(
      [
        fila({ id: ID, nombre: 'Zoe Z' }),
        fila({ id: '22222222-2222-4222-8222-222222222222', nombre: 'Ana A', foto_ruta: null }),
      ],
      BASE,
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.map((m) => m.nombre)).toEqual(['Zoe Z', 'Ana A'])
    expect(r.data[0]).toEqual({
      id: ID,
      nombre: 'Zoe Z',
      cargo: 'Fundador',
      frase: 'Una frase.',
      fotoUrl: `${BASE}/storage/v1/object/public/equipo/abc.webp`,
    })
    expect(r.data[1]?.fotoUrl).toBeNull()
  })
  it('un arreglo vacío es ok', () => {
    expect(leerFilasDelEquipo([], BASE)).toEqual({ ok: true, data: [] })
  })
  it('acepta hasta 100 filas', () => {
    expect(
      leerFilasDelEquipo(
        Array.from({ length: 100 }, () => fila()),
        BASE,
      ).ok,
    ).toBe(true)
  })
  it.each([
    ['null', null],
    ['un objeto', {}],
    ['101 filas', Array.from({ length: 101 }, () => fila())],
    ['una fila mala', [fila(), fila({ nombre: 'A' })]],
  ])('%s da fallo inesperado', (_caso, datos) => {
    const r = leerFilasDelEquipo(datos, BASE)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.codigo).toBe('inesperado')
  })
  it('la etiqueta de caché es «equipo»', () => {
    expect(ETIQUETA_DEL_EQUIPO).toBe('equipo')
  })
})
