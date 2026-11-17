import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/shared/config/entorno', () => ({
  entornoPublico: () => ({
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_prueba',
  }),
}))
const { createClient } = vi.hoisted(() => ({
  createClient: vi.fn((..._args: unknown[]) => ({ marca: 'cliente' })),
}))
vi.mock('@supabase/supabase-js', () => ({ createClient }))

import { crearClientePublico } from './cliente-publico'

describe('crearClientePublico (C5)', () => {
  beforeEach(() => createClient.mockClear())

  it('usa la URL y la clave publicable, el esquema publico y no guarda sesión', () => {
    expect(crearClientePublico()).toEqual({ marca: 'cliente' })
    expect(createClient).toHaveBeenCalledTimes(1)
    const [url, clave, opciones] = createClient.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ]
    expect(url).toBe('http://127.0.0.1:54321')
    expect(clave).toBe('sb_publishable_prueba')
    expect(opciones['db']).toEqual({ schema: 'publico' })
    expect(opciones['auth']).toMatchObject({
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    })
  })

  it('crea un cliente nuevo en cada llamada', () => {
    crearClientePublico()
    crearClientePublico()
    expect(createClient).toHaveBeenCalledTimes(2)
  })
})
