// Lo que los casos públicos reciben por parámetro. `infra/` no importa otro módulo (eslint-plugin-boundaries): los correos y los
// momentos de los recordatorios entran por puertos propios de `agenda`, y `src/app` los llena con el notificador y
// `momentosDeRecordatorio` de `notificaciones` (P36). `tipos.test.ts` fija que esos dos los cumplen.
import type { EntornoDelServidor } from '@/shared/config/servidor'
import type { Resultado } from '@/shared/lib/errores'
import type { ContarEnvio } from '@/shared/lib/seguridad'
import type { LlamarRpc } from '../rpc'

// Propiedades (no métodos): así `strictFunctionTypes` compara los parámetros y un cambio de firma en el notificador cae en `typecheck`.
export type CorreosDeAgenda = {
  enviarAhora: (entrada: { para?: string; datos: unknown }) => Promise<Resultado<unknown>>
  programar: (entrada: {
    para?: string
    datos: unknown
    cuando: string
  }) => Promise<Resultado<unknown>>
  cancelarDeReunion: (reunionId: string) => Promise<Resultado<unknown>>
  cancelarDeSolicitud: (solicitudId: string) => Promise<Resultado<unknown>>
}

export type MomentosDeRecordatorioDeAgenda = (args: { reservadaEn: string; inicio: string }) => {
  r24: string | null
  r1: string
}

export type DependenciasPublicas = {
  llamar: LlamarRpc
  contar: ContarEnvio
  correos: CorreosDeAgenda
  momentos: MomentosDeRecordatorioDeAgenda
  // La IP del pedido, para el límite de reservas (C7).
  ip: string
  // Para verificar el token de solicitud y como `reservadaEn` de los recordatorios; el resto del tiempo es el de la base.
  ahora: () => Date
  // `NEXT_PUBLIC_SITIO_URL`: la base del enlace de gestión.
  sitio: string
  entorno?: EntornoDelServidor
}
