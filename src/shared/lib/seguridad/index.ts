import 'server-only'

// Las defensas de las escrituras públicas, el webhook y el cron (semilla §4): Turnstile, límite de envíos por IP, token de
// solicitud, token de gestión y secreto del cron. Sólo servidor: los secretos salen de `entornoDelServidor()`.

export { igualesEnTiempoConstante, sha256Hex } from './cripto'
export { verificarSecretoDelCron } from './cron'
export {
  firmarTokenDeSolicitud,
  verificarTokenDeSolicitud,
  type SolicitudDelToken,
  type TokenDeSolicitud,
} from './token-solicitud'
export { generarTokenDeGestion, hashDeTokenDeGestion, type TokenDeGestion } from './token-gestion'
export { IP_DESCONOCIDA, ipDelPedido, ipParaLimite } from './ip'
export {
  claveDeLimite,
  LIMITES,
  limitar,
  VENTANA_SEGUNDOS,
  type AccionLimitada,
  type ContarEnvio,
} from './limites'
export { contadorDeSupabase, type ClienteDeContarEnvio } from './contador-de-supabase'
export { URL_SITEVERIFY, verificarTurnstile } from './turnstile'
export { TEXTO_LIMITE, TEXTO_TOKEN_VENCIDO, TEXTO_TURNSTILE } from './textos'
