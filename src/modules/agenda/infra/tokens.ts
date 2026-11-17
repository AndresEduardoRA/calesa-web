// Los dos tokens del visitante (§5.8): el de solicitud (`<id>.<exp>.<firma>`, reservar la primera vez) lleva puntos; el de gestión
// (`/reunion/<token>`, 43 caracteres base64url) no. Se verifican antes de cualquier llamada a la base.
import type { EntornoDelServidor } from '@/shared/config/servidor'
import { fallo, ok, type Resultado } from '@/shared/lib/errores'
import { hashDeTokenDeGestion, verificarTokenDeSolicitud } from '@/shared/lib/seguridad'

// El texto de E4: el mismo para un token mal formado que para uno que la base no conoce.
export const TEXTO_ENLACE_INVALIDO = 'Este enlace no es válido.'

export type TokenDeGestionLeido = { tipo: 'gestion'; hash: string }
export type TokenLeido = { tipo: 'solicitud'; solicitudId: string } | TokenDeGestionLeido

type Dependencias = { entorno?: EntornoDelServidor; ahora: Date }

export function leerTokenDeGestion(token: string): Resultado<TokenDeGestionLeido> {
  const hash = token.includes('.') ? null : hashDeTokenDeGestion(token)
  return hash === null ? fallo('regla', TEXTO_ENLACE_INVALIDO) : ok({ tipo: 'gestion', hash })
}

export function leerToken(token: string, dependencias: Dependencias): Resultado<TokenLeido> {
  if (!token.includes('.')) {
    return leerTokenDeGestion(token)
  }
  const solicitud = verificarTokenDeSolicitud(token, dependencias)
  return solicitud.ok
    ? ok({ tipo: 'solicitud', solicitudId: solicitud.data.solicitudId })
    : solicitud
}
