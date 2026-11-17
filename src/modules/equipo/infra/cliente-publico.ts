import 'server-only'

import { createClient } from '@supabase/supabase-js'

import { entornoPublico } from '@/shared/config/entorno'

// Un cliente de Supabase como `anon`, sin sesión y sin cookies, sobre el esquema `publico` (donde `anon` sólo puede llamar RPC de
// lectura). Existe porque el cliente de `@/shared/lib/supabase/server` lee `cookies()`, y eso no se puede dentro de `'use cache'`.
// Uno por llamada, nunca global, y siempre con la clave publicable.
//
// TODO(base): pasa a `@/shared/lib/supabase` cuando el carril `base` tenga un cliente sin cookies, y a `Database` tipado cuando
// `db:types` incluya el esquema `publico` (hoy sólo genera `public`). Por eso la respuesta va sin tipo y pasa por Zod.
export function crearClientePublico() {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } = entornoPublico()
  return createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    db: { schema: 'publico' },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
