import { describe, expect, it } from 'vitest'

import { esquemaEventoPublico, paginaDelEvento } from './eventos'

describe('paginaDelEvento (C2)', () => {
  it('deja sólo la ruta: corta la consulta y el fragmento', () => {
    expect(paginaDelEvento('/agendar?email=a@b.c#x')).toBe('/agendar')
    expect(paginaDelEvento('/planes#tabla')).toBe('/planes')
    expect(paginaDelEvento('/')).toBe('/')
  })

  it('da null si no es una ruta del sitio', () => {
    expect(paginaDelEvento(42)).toBeNull()
    expect(paginaDelEvento(undefined)).toBeNull()
    expect(paginaDelEvento('agendar')).toBeNull()
    expect(paginaDelEvento('//evil.com')).toBeNull()
    expect(paginaDelEvento('https://x')).toBeNull()
  })

  it('acepta 200 caracteres y rechaza 201', () => {
    expect(paginaDelEvento(`/${'a'.repeat(199)}`)).not.toBeNull()
    expect(paginaDelEvento(`/${'a'.repeat(200)}`)).toBeNull()
  })

  it('da null con espacios o caracteres de control', () => {
    expect(paginaDelEvento('/a b')).toBeNull()
    expect(paginaDelEvento('/a\n')).toBeNull()
    expect(paginaDelEvento('/a\u0000b')).toBeNull()
  })
})

describe('esquemaEventoPublico (C3)', () => {
  const base = { tipo: 'clic_agendar', pagina: '/planes' }

  it('valida un evento mínimo y completa las siete claves con null', () => {
    expect(esquemaEventoPublico.parse(base)).toEqual({
      tipo: 'clic_agendar',
      pagina: '/planes',
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_term: null,
      utm_content: null,
    })
  })

  it('valida calculadora_usada y guarda sólo la ruta de la página', () => {
    const r = esquemaEventoPublico.parse({
      tipo: 'calculadora_usada',
      pagina: '/?utm_source=x#calc',
      utm_source: ' google ',
    })
    expect(r.pagina).toBe('/')
    expect(r.utm_source).toBe('google')
  })

  it('rechaza los tipos que no son públicos', () => {
    expect(esquemaEventoPublico.safeParse({ ...base, tipo: 'clic_whatsapp' }).success).toBe(false)
    expect(esquemaEventoPublico.safeParse({ ...base, tipo: 'formulario_enviado' }).success).toBe(
      false,
    )
  })

  it('rechaza cualquier clave de más (X7)', () => {
    expect(esquemaEventoPublico.safeParse({ ...base, email: 'a@b.c' }).success).toBe(false)
    expect(esquemaEventoPublico.safeParse({ ...base, solicitud_id: 'x' }).success).toBe(false)
    expect(esquemaEventoPublico.safeParse({ ...base, perfil_id: 'x' }).success).toBe(false)
  })

  it('rechaza una página inválida o ausente', () => {
    expect(esquemaEventoPublico.safeParse({ ...base, pagina: 'https://x' }).success).toBe(false)
    expect(esquemaEventoPublico.safeParse({ tipo: 'clic_agendar' }).success).toBe(false)
  })

  it('utm vacío queda null y uno de 101 caracteres no valida', () => {
    expect(esquemaEventoPublico.parse({ ...base, utm_source: '' }).utm_source).toBeNull()
    expect(esquemaEventoPublico.parse({ ...base, utm_medium: '   ' }).utm_medium).toBeNull()
    expect(
      esquemaEventoPublico.parse({ ...base, utm_term: 'a'.repeat(100) }).utm_term,
    ).toHaveLength(100)
    expect(esquemaEventoPublico.safeParse({ ...base, utm_campaign: 'a'.repeat(101) }).success).toBe(
      false,
    )
  })
})
