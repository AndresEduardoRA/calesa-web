import { describe, expect, it } from 'vitest'
import {
  VENTANA_REPETIDAS_DIAS,
  esquemaCamposSolicitud,
  juntarSolicitud,
  type CamposSolicitud,
  type SolicitudAbierta,
} from './repetidas'

const AHORA = '2026-11-05T12:00:00Z'
const DIA = 86_400_000
const hace = (ms: number) => new Date(Date.parse(AHORA) - ms).toISOString()

const vacios: CamposSolicitud = {
  importadora: null,
  pais: null,
  whatsapp: null,
  autosHoy: null,
  autosMeta: null,
  vendedores: null,
  administracion: null,
  origenes: [],
  calcMargen: null,
  calcConsultas: null,
  calcRespuesta: null,
  refCodigo: null,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmTerm: null,
  utmContent: null,
  paginaOrigen: null,
}

const campos = (cambios: Partial<CamposSolicitud> = {}): CamposSolicitud => ({
  ...vacios,
  ...cambios,
})

let n = 0
function abierta(cambios: Partial<SolicitudAbierta> = {}): SolicitudAbierta {
  n += 1
  return {
    ...vacios,
    id: `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    email: 'ana@ejemplo.com',
    estado: 'nueva',
    origen: 'calculadora',
    creadoEn: hace(DIA),
    ...cambios,
  }
}

const cambiosDe = (resultado: ReturnType<typeof juntarSolicitud>) =>
  resultado.tipo === 'juntar' ? resultado.cambios : 'se creó'

const juntar = (existentes: SolicitudAbierta[], nuevos = campos(), email = 'ana@ejemplo.com') =>
  juntarSolicitud({ ahora: AHORA, email, campos: nuevos, existentes })

describe('juntarSolicitud · ejemplo de §5.6', () => {
  it('calculadora el 2 nov + formulario el 5 nov, mismo correo → una sola, con sus cambios', () => {
    const detalle = abierta({
      origen: 'calculadora',
      creadoEn: '2026-11-02T10:00:00Z',
      calcMargen: 1500,
      autosHoy: 40,
    })
    const formulario = campos({
      importadora: 'Autos SRL',
      pais: 'BO',
      whatsapp: '+59170000000',
      autosHoy: 80,
    })
    const resultado = juntar([detalle], formulario)
    expect(resultado).toEqual({
      tipo: 'juntar',
      id: detalle.id,
      cambios: { importadora: 'Autos SRL', pais: 'BO', whatsapp: '+59170000000' },
    })
  })
})

describe('juntarSolicitud · cuál se junta', () => {
  it('30 días exactos junta; 30 días y 1 ms crea', () => {
    expect(VENTANA_REPETIDAS_DIAS).toBe(30)
    expect(juntar([abierta({ creadoEn: hace(30 * DIA) })]).tipo).toBe('juntar')
    expect(juntar([abierta({ creadoEn: hace(30 * DIA + 1) })]).tipo).toBe('crear')
  })

  it('sólo juntan las nuevas y las agendadas', () => {
    expect(juntar([abierta({ estado: 'agendada' })]).tipo).toBe('juntar')
    for (const estado of ['realizada', 'no_asistio', 'ganada', 'descartada'] as const) {
      expect(juntar([abierta({ estado })]).tipo).toBe('crear')
    }
  })

  it('el correo no distingue mayúsculas ni espacios de borde', () => {
    expect(juntar([abierta()], campos(), ' Ana@Ejemplo.com ').tipo).toBe('juntar')
    expect(juntar([abierta({ email: 'ANA@ejemplo.com' })]).tipo).toBe('juntar')
    expect(juntar([abierta({ email: 'otra@ejemplo.com' })]).tipo).toBe('crear')
  })

  it('entre dos abiertas junta la más reciente', () => {
    const vieja = abierta({ creadoEn: hace(10 * DIA) })
    const reciente = abierta({ creadoEn: hace(2 * DIA) })
    expect(juntar([vieja, reciente])).toMatchObject({ id: reciente.id })
    expect(juntar([reciente, vieja])).toMatchObject({ id: reciente.id })
  })

  it('sin solicitudes existentes crea', () => {
    expect(juntar([])).toEqual({ tipo: 'crear' })
  })
})

describe('juntarSolicitud · qué cambia', () => {
  it('un campo que ya tenía valor no se pisa', () => {
    const existente = abierta({ whatsapp: '+59171111111', importadora: null })
    const resultado = juntar(
      [existente],
      campos({ whatsapp: '+59172222222', importadora: 'Autos SRL' }),
    )
    expect(resultado).toMatchObject({ cambios: { importadora: 'Autos SRL' } })
    expect(resultado).not.toMatchObject({ cambios: { whatsapp: expect.anything() as unknown } })
  })

  it('origenes se unen (primero los de la existente) y sin novedad no van en cambios', () => {
    const existente = abierta({ origenes: ['copart'] })
    expect(juntar([existente], campos({ origenes: ['iaai', 'copart'] }))).toMatchObject({
      cambios: { origenes: ['copart', 'iaai'] },
    })
    expect(juntar([existente], campos({ origenes: ['copart'] }))).toEqual({
      tipo: 'juntar',
      id: existente.id,
      cambios: {},
    })
  })

  it('sin campos nuevos, cambios queda vacío', () => {
    expect(cambiosDe(juntar([abierta()]))).toEqual({})
  })
})

describe('juntarSolicitud · el par de autos respeta autosMeta ≥ autosHoy', () => {
  it('si la existente no tiene autosHoy, toma autosHoy y autosMeta nuevos', () => {
    expect(juntar([abierta()], campos({ autosHoy: 80, autosMeta: 120 }))).toMatchObject({
      cambios: { autosHoy: 80, autosMeta: 120 },
    })
  })

  it('con autosHoy 40 y autosMeta null: un autosMeta de 30 no entra y uno de 60 sí', () => {
    const existente = abierta({ autosHoy: 40 })
    expect(cambiosDe(juntar([existente], campos({ autosMeta: 30 })))).toEqual({})
    expect(juntar([existente], campos({ autosMeta: 60 }))).toMatchObject({
      cambios: { autosMeta: 60 },
    })
  })

  it('un autosMeta que ya existía no se pisa, ni se toma un autosHoy mayor que él', () => {
    const existente = abierta({ autosMeta: 50 })
    const resultado = juntar([existente], campos({ autosHoy: 80, autosMeta: 200 }))
    expect(cambiosDe(resultado)).toEqual({})
    expect(juntar([existente], campos({ autosHoy: 30 }))).toMatchObject({
      cambios: { autosHoy: 30 },
    })
  })
})

describe('esquemaCamposSolicitud', () => {
  it('acepta campos válidos y rechaza lo que sale de rango', () => {
    expect(
      esquemaCamposSolicitud.safeParse(campos({ autosHoy: 80, whatsapp: '+59170000000' })).success,
    ).toBe(true)
    expect(esquemaCamposSolicitud.safeParse(campos({ autosHoy: 0 })).success).toBe(false)
    expect(esquemaCamposSolicitud.safeParse(campos({ whatsapp: '59170000000' })).success).toBe(
      false,
    )
    expect(esquemaCamposSolicitud.safeParse({ ...campos(), origenes: ['ebay'] }).success).toBe(
      false,
    )
  })
})
