import { describe, expect, it } from 'vitest'
import {
  CAMBIO_NO_PERMITIDO,
  ESTADOS_SOLICITUD,
  esquemaEstadoSolicitud,
  estadosPosibles,
  transicionPermitida,
  type Actor,
  type EfectoEnReunion,
  type EstadoSolicitud,
} from './estados'

const ACTORES: Actor[] = ['servidor', 'vendedor', 'admin']
const DESDE: (EstadoSolicitud | null)[] = [null, ...ESTADOS_SOLICITUD]
const INICIO = '2026-11-03T14:00:00Z'
const DESPUES = '2026-11-03T14:30:00Z'

type Fila = [EstadoSolicitud | null, EstadoSolicitud, Actor, EfectoEnReunion | null]

// La tabla de §5.7, fila por fila (cada actor listado es una fila).
const PERMITIDAS: Fila[] = [
  [null, 'nueva', 'servidor', null],
  ['nueva', 'agendada', 'servidor', 'confirmada'],
  ['agendada', 'nueva', 'servidor', 'cancelada'],
  ['agendada', 'realizada', 'vendedor', 'realizada'],
  ['agendada', 'realizada', 'admin', 'realizada'],
  ['agendada', 'no_asistio', 'vendedor', 'no_asistio'],
  ['agendada', 'no_asistio', 'admin', 'no_asistio'],
  ['realizada', 'ganada', 'vendedor', null],
  ['realizada', 'ganada', 'admin', null],
  ['realizada', 'descartada', 'vendedor', null],
  ['realizada', 'descartada', 'admin', null],
  ['nueva', 'descartada', 'vendedor', null],
  ['nueva', 'descartada', 'admin', null],
  ['no_asistio', 'descartada', 'vendedor', null],
  ['no_asistio', 'descartada', 'admin', null],
  ['descartada', 'nueva', 'admin', null],
]

const casos = DESDE.flatMap((desde) =>
  ESTADOS_SOLICITUD.flatMap((hacia) => ACTORES.map((actor) => ({ desde, hacia, actor }))),
)

describe('transicionPermitida · tabla de §5.7, los 126 casos', () => {
  it('hay 7 × 6 × 3 casos y 16 filas permitidas', () => {
    expect(casos).toHaveLength(126)
    expect(PERMITIDAS).toHaveLength(16)
  })

  it.each(casos)('$desde → $hacia ($actor)', ({ desde, hacia, actor }) => {
    const fila = PERMITIDAS.find((f) => f[0] === desde && f[1] === hacia && f[2] === actor)
    const resultado = transicionPermitida({
      desde,
      hacia,
      actor,
      ahora: DESPUES,
      inicioReunion: INICIO,
    })
    expect(resultado).toEqual(
      fila ? { ok: true, reunion: fila[3] } : { ok: false, error: CAMBIO_NO_PERMITIDO },
    )
  })

  it('el mensaje es el de la semilla', () => {
    expect(CAMBIO_NO_PERMITIDO).toBe('Ese cambio de estado no está permitido.')
  })
})

describe('transicionPermitida · sólo después del inicio de la reunión', () => {
  const pedir = (hacia: EstadoSolicitud, ahora?: string, inicioReunion?: string) =>
    transicionPermitida({ desde: 'agendada', hacia, actor: 'vendedor', ahora, inicioReunion })

  it('en el instante exacto del inicio ya vale', () => {
    expect(pedir('realizada', INICIO, INICIO)).toMatchObject({ ok: true })
    expect(pedir('no_asistio', INICIO, INICIO)).toMatchObject({ ok: true })
  })

  it('un minuto antes no vale', () => {
    expect(pedir('realizada', '2026-11-03T13:59:00Z', INICIO)).toEqual({
      ok: false,
      error: CAMBIO_NO_PERMITIDO,
    })
  })

  it('sin ahora o sin inicio de reunión no vale', () => {
    expect(pedir('realizada', undefined, INICIO).ok).toBe(false)
    expect(pedir('realizada', DESPUES, undefined).ok).toBe(false)
  })

  it('compara instantes, no textos: un desfase no engaña', () => {
    // 10:30-04:00 son las 14:30Z (después de 14:00Z) aunque «10:30» < «14:00» como texto.
    expect(pedir('realizada', '2026-11-03T10:30:00-04:00', INICIO).ok).toBe(true)
  })
})

describe('estadosPosibles y esquemaEstadoSolicitud', () => {
  it('lista los estados de ESTADOS_SOLICITUD que valen, en ese orden', () => {
    expect(estadosPosibles({ desde: 'realizada', actor: 'vendedor' })).toEqual([
      'ganada',
      'descartada',
    ])
    expect(estadosPosibles({ desde: 'descartada', actor: 'vendedor' })).toEqual([])
    expect(estadosPosibles({ desde: 'descartada', actor: 'admin' })).toEqual(['nueva'])
    expect(estadosPosibles({ desde: 'nueva', actor: 'admin' })).toEqual(['descartada'])
  })

  it('agendada ofrece realizada y no_asistio sólo después del inicio', () => {
    const base = { desde: 'agendada', actor: 'admin', inicioReunion: INICIO } as const
    expect(estadosPosibles({ ...base, ahora: '2026-11-03T13:00:00Z' })).toEqual([])
    expect(estadosPosibles({ ...base, ahora: DESPUES })).toEqual(['realizada', 'no_asistio'])
  })

  it('esquemaEstadoSolicitud rechaza un estado que no existe', () => {
    expect(esquemaEstadoSolicitud.safeParse('ganada').success).toBe(true)
    expect(esquemaEstadoSolicitud.safeParse('perdida').success).toBe(false)
  })
})
