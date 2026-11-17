import { describe, expect, it } from 'vitest'

import {
  AVISO_SIN_WHATSAPP,
  enlaceDeWhatsApp,
  MENSAJE_DE_WHATSAPP,
  RUTA_SIN_WHATSAPP,
} from './whatsapp'

describe('enlaceDeWhatsApp (C4)', () => {
  it('el mensaje es el literal de D3', () => {
    expect(MENSAJE_DE_WHATSAPP).toBe(
      'Hola, vengo de calesa.app y quiero ver una demo con mis autos.',
    )
  })

  it('con un E.164 válido arma el enlace wa.me sin el + y con el mensaje codificado', () => {
    expect(enlaceDeWhatsApp('+59170000001')).toBe(
      'https://wa.me/59170000001?text=Hola%2C%20vengo%20de%20calesa.app%20y%20quiero%20ver%20una%20demo%20con%20mis%20autos.',
    )
  })

  it('con cualquier otro valor da null, nunca un enlace roto', () => {
    expect(enlaceDeWhatsApp('59170000001')).toBeNull()
    expect(enlaceDeWhatsApp('+0123')).toBeNull()
    expect(enlaceDeWhatsApp('+5917000')).toBeNull()
    expect(enlaceDeWhatsApp('')).toBeNull()
    expect(enlaceDeWhatsApp(null)).toBeNull()
    expect(enlaceDeWhatsApp(undefined)).toBeNull()
  })
})

describe('destino sin nadie (C5, R4.10)', () => {
  it('la ruta lleva el aviso exacto', () => {
    expect(AVISO_SIN_WHATSAPP).toBe('sin-whatsapp')
    expect(RUTA_SIN_WHATSAPP).toBe('/agendar?aviso=sin-whatsapp')
  })
})
