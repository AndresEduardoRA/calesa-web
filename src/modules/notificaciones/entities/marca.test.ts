import { describe, expect, it } from 'vitest'

import type { Bloque } from './contenido'
import { MARCA, envolver } from './marca'

const SITIO = 'https://calesa.app'
const bloques: Bloque[] = [
  { tipo: 'parrafo', texto: 'Hola' },
  { tipo: 'filas', filas: [['Fecha', '3 nov 2026, 10:00']] },
  { tipo: 'tabla', columnas: ['A', 'B'], filas: [['1', '2']] },
  { tipo: 'boton', texto: 'Agendar demo', url: 'https://calesa.app/agendar' },
]

describe('envolver', () => {
  const { html, texto } = envolver({ titulo: 'Tu demo', bloques, sitio: SITIO })

  it('lleva la cabecera de marca, el idioma y los hex de §8.1', () => {
    expect(html).toContain('<html lang="es">')
    expect(html).toContain('charset="utf-8"')
    expect(html).toContain(MARCA.marca)
    expect(html).toContain(MARCA.accion)
    expect(html).toContain('>Calesa</td>')
  })

  it('el pie enlaza a /privacidad, en HTML y en texto', () => {
    expect(html).toContain('href="https://calesa.app/privacidad"')
    expect(texto).toContain('https://calesa.app/privacidad')
  })

  it('el texto dice lo mismo, sin etiquetas y con la URL del botón en su línea', () => {
    expect(texto).not.toMatch(/[<>]/)
    expect(texto).toContain('Fecha: 3 nov 2026, 10:00')
    expect(texto).toContain('Agendar demo:\nhttps://calesa.app/agendar')
  })

  it('escapa los datos y no dibuja un botón con un esquema peligroso', () => {
    const malo = envolver({
      titulo: '<b>',
      sitio: SITIO,
      bloques: [
        { tipo: 'parrafo', texto: '<script>alert("x")</script>' },
        { tipo: 'boton', texto: 'Abrir', url: 'javascript:alert(1)' },
      ],
    })
    expect(malo.html).not.toContain('<script>')
    expect(malo.html).not.toContain('javascript:')
    expect(malo.html).toContain('&lt;script&gt;')
    expect(malo.texto).not.toContain('javascript:')
    expect(malo.texto).toContain('<script>alert("x")</script>')
  })
})
