import { describe, expect, it } from 'vitest'

import { esquemaDatos, PLANTILLAS, type DatosDeCorreo } from './datos'
import { CONTEXTO, DATOS_DE_EJEMPLO, REUNION, REUNION_EN_BOGOTA } from './ejemplos.soporte'
import { renderizar } from './render'

const ASUNTOS: Record<(typeof PLANTILLAS)[number], string> = {
  'reunion-confirmada': 'Tu demo con Calesa: mar 3 nov, 10:00',
  'reunion-nueva-anfitrion': 'Nueva demo: Importadora X, mar 3 nov, 10:00 (hora de Bolivia)',
  'reunion-cambiada': 'Cambió tu demo con Calesa: mié 4 nov, 11:00',
  'reunion-cambiada-equipo': 'Cambio de demo: Importadora X',
  'reunion-cancelada': 'Se canceló tu demo con Calesa',
  'recordatorio-24h': 'Mañana es tu demo con Calesa',
  'recordatorio-1h': 'Tu demo con Calesa empieza en 1 hora',
  'meet-cambiado': 'Cambió el enlace de tu demo con Calesa',
  'detalle-calculadora': 'Lo que se te escapa al mes: tu detalle',
  'solicitud-sin-reunion': 'Nueva solicitud sin reunión: Importadora X',
  'aviso-equipo': '[Calesa] Nueva solicitud: Importadora X',
  'correo-fallido': '[Calesa] No se pudo enviar un correo',
}

const enlacesDe = (texto: string) => texto.match(/https?:\/\/[^\s"<>]+/g) ?? []

describe('renderizar · las 12 plantillas con la reunión de ejemplo', () => {
  for (const plantilla of PLANTILLAS) {
    it(`${plantilla}: asunto de §6.8, marca, texto y sin emojis`, () => {
      const datos = DATOS_DE_EJEMPLO[plantilla]
      const salida = renderizar(datos, CONTEXTO)
      expect(salida.asunto).toBe(ASUNTOS[plantilla])
      expect(salida.asunto.length).toBeLessThanOrEqual(200)
      expect(salida.html).toContain('<html lang="es">')
      expect(salida.html).toContain('#4B2259')
      expect(salida.texto).not.toMatch(/[<>]/)
      // Los enlaces de los botones están en los dos, completos (el HTML trae además el del pie).
      for (const url of enlacesDe(salida.texto))
        expect(salida.html).toContain(url.replace(/&/g, '&amp;'))
      expect(`${salida.asunto}${salida.html}${salida.texto}`).not.toMatch(
        /\p{Extended_Pictographic}/u,
      )
    })
  }

  it('sólo la confirmada, la cambiada y la cancelación al visitante llevan .ics', () => {
    const conIcs = PLANTILLAS.filter((p) => renderizar(DATOS_DE_EJEMPLO[p], CONTEXTO).ics !== null)
    expect(conIcs).toEqual(['reunion-confirmada', 'reunion-cambiada', 'reunion-cancelada'])
    const cancelada = renderizar(DATOS_DE_EJEMPLO['reunion-cancelada'], CONTEXTO).ics
    expect(cancelada).toContain('METHOD:CANCEL')
  })

  it('la cancelación al anfitrión no lleva .ics', () => {
    const datos = { ...DATOS_DE_EJEMPLO['reunion-cancelada'], destinatario: 'anfitrion' as const }
    expect(renderizar(datos, CONTEXTO).ics).toBeNull()
  })
})

describe('renderizar · escape', () => {
  const MALO = `<script>alert("x")</script> & 'Co'`

  it('un dato de la persona sale escapado en html y tal cual en texto', () => {
    const base = DATOS_DE_EJEMPLO['reunion-confirmada']
    const datos: DatosDeCorreo = {
      ...base,
      reunion: {
        ...REUNION,
        visitante: { ...REUNION.visitante, nombre: MALO },
        importadora: MALO,
        anfitrion: { ...REUNION.anfitrion, nombre: MALO },
      },
    }
    expect(esquemaDatos.safeParse(datos).success).toBe(true)
    const salida = renderizar(datos, CONTEXTO)
    expect(salida.html).not.toContain('<script>')
    expect(salida.html).toContain(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;Co&#39;',
    )
    expect(salida.texto).toContain(MALO)
  })

  it('escapa en cada plantilla que lleva nombre', () => {
    for (const plantilla of PLANTILLAS) {
      const texto = JSON.stringify(DATOS_DE_EJEMPLO[plantilla]).replaceAll(
        'Ana Pérez',
        MALO.replace(/"/g, '\\"'),
      )
      const datos = esquemaDatos.parse(JSON.parse(texto))
      expect(renderizar(datos, CONTEXTO).html).not.toContain('<script>')
    }
  })
})

describe('renderizar · zonas, formato y topes', () => {
  it('Bogotá: el visitante ve 09:00 sin rótulo; el anfitrión ve 10:00 «(hora de Bolivia)»', () => {
    const visitante = renderizar(
      { ...DATOS_DE_EJEMPLO['reunion-confirmada'], reunion: REUNION_EN_BOGOTA },
      CONTEXTO,
    )
    expect(visitante.asunto).toBe('Tu demo con Calesa: mar 3 nov, 09:00')
    expect(visitante.texto).not.toContain('hora de Bolivia')
    const anfitrion = renderizar(
      { ...DATOS_DE_EJEMPLO['reunion-nueva-anfitrion'], reunion: REUNION_EN_BOGOTA },
      CONTEXTO,
    )
    expect(anfitrion.texto).toContain('mar 3 nov, 10:00 (hora de Bolivia)')
  })

  it('detalle-calculadora: el rango, las 6 filas, las 3 frases y el botón a /agendar', () => {
    const datos = DATOS_DE_EJEMPLO['detalle-calculadora']
    const { texto, html } = renderizar(datos, CONTEXTO)
    expect(texto).toContain('US$ 4.452 – US$ 8.935')
    expect(texto).toContain('Al menos US$ 4.452')
    for (const fila of datos.filas) expect(texto).toContain(fila.nombre)
    for (const frase of datos.resumen) expect(texto).toContain(frase)
    expect(texto).toContain('62,5 horas')
    expect(html).toContain(`href="${datos.enlaceAgendar}"`)
    expect(html).toContain('>Agendar demo</a>')
  })

  it('sin enlace de gestión: no hay botón de gestión y sí la frase de remisión', () => {
    const { enlaceGestion: _quitado, ...sin } = DATOS_DE_EJEMPLO['reunion-cambiada']
    const salida = renderizar(sin, CONTEXTO)
    expect(salida.html).not.toContain('Cambiar o cancelar</a>')
    expect(salida.texto).toContain(
      'Para cambiar o cancelar, usa el enlace del correo de confirmación.',
    )
    const recordatorio = renderizar({ plantilla: 'recordatorio-24h', reunion: REUNION }, CONTEXTO)
    expect(recordatorio.texto).toContain('usa el enlace del correo de confirmación')
  })

  it('con enlace de gestión lo dibuja', () => {
    const salida = renderizar(DATOS_DE_EJEMPLO['reunion-confirmada'], CONTEXTO)
    expect(salida.html).toContain('Cambiar o cancelar</a>')
    expect(salida.texto).toContain('https://calesa.app/reunion/token-de-gestion')
  })

  it('una importadora de 200 letras corta el asunto a 80 y termina en «…»', () => {
    const datos = {
      ...DATOS_DE_EJEMPLO['reunion-nueva-anfitrion'],
      reunion: { ...REUNION, importadora: 'x'.repeat(200) },
    }
    const { asunto } = renderizar(datos, CONTEXTO)
    expect(asunto.length).toBeLessThanOrEqual(200)
    expect(asunto).toContain('…,')
  })

  it('la cancelación al visitante ofrece «Elegir otra hora» y al anfitrión «Ver solicitud»', () => {
    const alVisitante = renderizar(DATOS_DE_EJEMPLO['reunion-cancelada'], CONTEXTO)
    expect(alVisitante.texto).toContain('https://calesa.app/agendar')
    const alAnfitrion = renderizar(
      { ...DATOS_DE_EJEMPLO['reunion-cancelada'], destinatario: 'anfitrion' },
      CONTEXTO,
    )
    expect(alAnfitrion.texto).toContain(`/panel/solicitudes/${REUNION.solicitudId}`)
  })

  it('los avisos del equipo según el tipo y la reasignación', () => {
    const aviso = renderizar(
      { ...DATOS_DE_EJEMPLO['aviso-equipo'], tipo: 'reunion-cancelada' },
      CONTEXTO,
    )
    expect(aviso.asunto).toBe('[Calesa] Reunión cancelada: Importadora X')
    const reasignada = renderizar(
      { ...DATOS_DE_EJEMPLO['reunion-nueva-anfitrion'], motivo: 'reasignacion' },
      CONTEXTO,
    )
    expect(reasignada.texto).toContain('Te la pasaron por reasignación.')
    const anterior = renderizar(
      { ...DATOS_DE_EJEMPLO['reunion-cambiada-equipo'], destinatario: 'anterior' },
      CONTEXTO,
    )
    expect(anterior.texto).toContain('Ya no la atiendes tú.')
    expect(anterior.texto).not.toContain('Ver solicitud')
  })
})
