// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('./cripto', async (importOriginal) => {
  const real = await importOriginal<typeof cripto>()
  return { ...real, igualesEnTiempoConstante: vi.fn(real.igualesEnTiempoConstante) }
})

import type { EntornoDelServidor } from '../../config/servidor'
import type * as cripto from './cripto'
import { igualesEnTiempoConstante } from './cripto'
import { verificarSecretoDelCron } from './cron'

const SECRETO = 'secreto-del-cron-de-prueba-0123456789'
const entorno = (extra: Partial<EntornoDelServidor>): EntornoDelServidor =>
  ({ SUPABASE_SECRET_KEY: 's', EMAIL_PROVEEDOR: 'ninguno', ...extra }) as EntornoDelServidor
const conSecreto = { entorno: entorno({ CRON_SECRET: SECRETO }) }

describe('verificarSecretoDelCron', () => {
  beforeEach(() => {
    vi.mocked(igualesEnTiempoConstante).mockClear()
  })

  it('acepta exactamente «Bearer <CRON_SECRET>»', () => {
    expect(verificarSecretoDelCron(`Bearer ${SECRETO}`, conSecreto)).toBe(true)
  })

  it.each([
    ['sin cabecera', null],
    ['vacía', ''],
    ['bearer en minúscula', `bearer ${SECRETO}`],
    ['dos espacios', `Bearer  ${SECRETO}`],
    ['otro esquema', `Basic ${SECRETO}`],
    ['sin esquema', SECRETO],
    ['el secreto más largo', `Bearer ${SECRETO}x`],
    ['el secreto sin su último carácter', `Bearer ${SECRETO.slice(0, -1)}`],
    ['un espacio al final', `Bearer ${SECRETO} `],
  ])('rechaza %s', (_caso, cabecera) => {
    expect(verificarSecretoDelCron(cabecera, conSecreto)).toBe(false)
  })

  it.each([['Bearer '], ['Bearer undefined'], ['Bearer'], ['']])(
    'sin CRON_SECRET rechaza «%s»',
    (cabecera) => {
      expect(verificarSecretoDelCron(cabecera, { entorno: entorno({}) })).toBe(false)
    },
  )

  it('compara la cabecera entera en tiempo constante', () => {
    verificarSecretoDelCron(`Bearer ${SECRETO}`, conSecreto)
    verificarSecretoDelCron('Bearer otro', conSecreto)
    expect(igualesEnTiempoConstante).toHaveBeenCalledWith(`Bearer ${SECRETO}`, `Bearer ${SECRETO}`)
    expect(igualesEnTiempoConstante).toHaveBeenCalledWith('Bearer otro', `Bearer ${SECRETO}`)
  })
})
