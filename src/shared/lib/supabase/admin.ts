import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { entornoPublico } from '@/shared/config/entorno'
import { entornoDelServidor } from '@/shared/config/servidor'
import type { Database } from '@/shared/types/database.types'

// Cliente con la secret key: SALTA la RLS. Quién puede crearlo está escrito en
// `.claude/rules/datos.md` y lo cuida el lint (`DONDE_SE_PERMITE_EL_ADMIN` de eslint.config.mjs: las
// rutas de API de la semilla §9.3 y `acceso/infra/auth-admin.ts`; un archivo nuevo se suma en el carril
// base). Nunca se guarda en una variable global, nunca se pasa a un Client Component y nunca lee tablas
// del negocio: sólo llama la RPC pública que le toca.
export function createAdminClient() {
  const { SUPABASE_SECRET_KEY: secreta } = entornoDelServidor()
  return createClient<Database>(entornoPublico().NEXT_PUBLIC_SUPABASE_URL, secreta, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
