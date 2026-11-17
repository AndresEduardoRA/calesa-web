import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { fallo, ok } from '@/shared/lib/errores'

import { CONFIG_INICIAL } from '../../../entities/ejemplos.fixture'
import { SeccionCalculadora } from './seccion-calculadora'

// Copia de `NOMBRA_EL_EXCESO` de `planes/entities/x11.fixture.ts` (X11): un test no importa las tripas de otro módulo. Si cambia
// allá, se cambia aquí, en `entities/como-se-calculo.test.ts` y en `entities/etiquetas.test.ts`.
const NOMBRA_EL_EXCESO = /exceso|por auto|US\$ 25(?![.\d])/i

const LLENA = 'Llena los 5 datos para ver cuánto se te escapa.'
const REVISA = 'Revisa los datos marcados para ver cuánto se te escapa.'
const CONSULTAS_MENOS = 'Las consultas no pueden ser menos que los autos vendidos.'

const DESGLOSE_E1 = [
  ['Ventas por contestar tarde', 'US$ 2.669', 'US$ 5.279'],
  ['Días perdidos coordinando', 'US$ 333', 'US$ 666'],
  ['Diferencia de tipo de cambio', 'US$ 450', 'US$ 900'],
  ['Costos que no se cobraron', 'US$ 300', 'US$ 750'],
  ['Saldos cobrados tarde', 'US$ 395', 'US$ 789'],
  ['Horas del equipo', 'US$ 305', 'US$ 551'],
]

function escribir(etiqueta: string, valor: string) {
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } })
}

function llenarEjemplo1() {
  escribir('Autos que vendes al mes', '25')
  escribir('Margen promedio de cada auto', '1800')
  escribir('Consultas que recibes al mes', '300')
  escribir('¿Cuánto tardas en contestar una consulta?', 'dia')
  escribir('Personas en administración y logística', '3')
}

const regionDe = (campo: string) =>
  document.querySelector(`[data-campo="${campo}"] [aria-live="polite"]`)

describe('SeccionCalculadora (C14, C10 sin datos del panel)', () => {
  afterEach(cleanup)

  it('es la sección #calculadora con su título', () => {
    const { container } = render(<SeccionCalculadora config={ok(CONFIG_INICIAL)} />)
    const seccion = container.querySelector('section#calculadora')
    expect(seccion).not.toBeNull()
    expect(
      screen.getByRole('heading', { level: 2, name: '¿Cuánto se te escapa al mes?' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '¿Cuánto se te escapa al mes?' })).toBe(seccion)
  })

  it('si no se pudieron leer los datos del panel, lo dice sin cifras ni «Cómo se calculó»', () => {
    render(<SeccionCalculadora config={fallo('inesperado', 'x')} />)
    llenarEjemplo1()
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos calcular. Revisa los datos.')
    expect(screen.queryByText('US$ 4.452')).toBeNull()
    expect(screen.queryByText('Cómo se calculó')).toBeNull()
  })
})

describe('CalculadoraPublica (C7–C13)', () => {
  const eventos: unknown[] = []
  const oir = (evento: Event) => eventos.push((evento as CustomEvent).detail)

  beforeEach(() => window.addEventListener('calesa:evento', oir))
  afterEach(() => {
    cleanup()
    window.removeEventListener('calesa:evento', oir)
    eventos.length = 0
  })

  it('arranca vacía y pide los 5 datos', () => {
    render(<SeccionCalculadora config={ok(CONFIG_INICIAL)} />)
    expect(screen.getByText(LLENA)).toBeInTheDocument()
    expect(screen.getByLabelText('Autos que vendes al mes')).toHaveValue('')
    expect(screen.queryByText('Estimación')).toBeNull()
    expect(eventos).toEqual([])
  })

  it('con el ejemplo 1 muestra el resultado, el desglose, las horas y el enlace, y un solo evento', () => {
    render(<SeccionCalculadora config={ok(CONFIG_INICIAL)} />)
    llenarEjemplo1()
    expect(screen.getByText('Estimación')).toBeInTheDocument()
    expect(screen.getByText('US$ 4.452')).toBeInTheDocument()
    expect(screen.getByText('US$ 4.452 – US$ 8.935')).toBeInTheDocument()
    expect(screen.getByText('Horas a mano al mes: 77 a 139')).toBeInTheDocument()
    const desglose = screen.getByRole('table')
    const filas = within(desglose)
      .getAllByRole('row')
      .slice(1)
      .map((tr) => Array.from(tr.querySelectorAll('th, td')).map((c) => c.textContent))
    expect(filas).toEqual(DESGLOSE_E1)
    const agendar = screen.getByRole('link', { name: 'Agendar demo' })
    expect(agendar).toHaveAttribute('href', '/agendar?autos=25&adm=3')
    expect(agendar).toHaveAttribute('data-evento', 'clic_agendar')
    // Cambiar un dato, vaciar uno (vuelve a incompleto) y llenarlo otra vez: el evento no se repite.
    escribir('Personas en administración y logística', '4')
    escribir('Personas en administración y logística', '')
    expect(screen.getByText(LLENA)).toBeInTheDocument()
    escribir('Personas en administración y logística', '3')
    expect(screen.getByText('US$ 4.452')).toBeInTheDocument()
    expect(eventos).toEqual([{ tipo: 'calculadora_usada' }])
  })

  it('consultas menos que autos: el error bajo consultas, anunciado, y el resultado pide revisar', () => {
    render(<SeccionCalculadora config={ok(CONFIG_INICIAL)} />)
    const region = regionDe('consultas')
    expect(region).not.toBeNull()
    expect(region).toBeEmptyDOMElement()
    escribir('Autos que vendes al mes', '25')
    escribir('Consultas que recibes al mes', '10')
    const consultas = screen.getByLabelText('Consultas que recibes al mes')
    expect(consultas).toHaveAttribute('aria-invalid', 'true')
    expect(consultas).toHaveAttribute('aria-describedby', region?.id)
    expect(regionDe('consultas')).toHaveTextContent(CONSULTAS_MENOS)
    expect(screen.getByText(REVISA)).toBeInTheDocument()
    expect(screen.queryByText(LLENA)).toBeNull()
  })

  it('«Cómo se calculó» va cerrado, con las frases y los datos del panel', () => {
    const { container } = render(<SeccionCalculadora config={ok(CONFIG_INICIAL)} />)
    const detalles = screen.getByText('Cómo se calculó').closest('details')
    expect(detalles).not.toBeNull()
    expect(detalles).not.toHaveAttribute('open')
    const dentro = within(detalles as HTMLElement)
    expect(dentro.getByText(/^Días perdidos coordinando: .*US\$ 18\.000/)).toBeInTheDocument()
    const dt = dentro.getByText('Precio promedio de un auto')
    expect(dt.tagName).toBe('DT')
    expect(dt.nextElementSibling?.tagName).toBe('DD')
    expect(dt.nextElementSibling?.textContent).toBe('US$ 18.000')
    llenarEjemplo1()
    expect(container.textContent).not.toMatch(NOMBRA_EL_EXCESO)
  })
})
