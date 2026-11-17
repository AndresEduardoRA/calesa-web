// Lo que `infra/` necesita del correo: el puerto sobre `src/shared/lib/email` (el kit) y lo que sale del entorno (URL del sitio, quién
// organiza, a quién van los avisos). Es la única parte del módulo que lee el entorno; las pruebas inyectan las dos cosas.
import 'server-only'

import { urlDelSitio } from '@/shared/config/entorno'
import { entornoDelServidor } from '@/shared/config/servidor'
import type { Resultado } from '@/shared/lib/errores'
import {
  cancelarEmail,
  enviarEmail,
  programaCorreos,
  programarEmail,
  reprogramarEmail,
  type EnvioDeEmail,
  type MensajeDeEmail,
} from '@/shared/lib/email'

type Envio = Promise<Resultado<EnvioDeEmail>>

export interface PuertoDeCorreo {
  enviar(mensaje: MensajeDeEmail): Envio
  programar(mensaje: MensajeDeEmail, cuando: string): Envio
  cancelar(id: string): Envio
  reprogramar(id: string, cuando: string): Envio
  // Si el proveedor programa, cancela y reprograma (sólo Resend). Si no, el correo se guarda y sale a su hora (`despacharVencidos`).
  programa(): boolean
}

export const correoDelKit: PuertoDeCorreo = {
  enviar: (mensaje) => enviarEmail(mensaje),
  programar: (mensaje, cuando) => programarEmail(mensaje, cuando),
  cancelar: (id) => cancelarEmail(id),
  reprogramar: (id, cuando) => reprogramarEmail(id, cuando),
  programa: () => programaCorreos(),
}

export type EntornoDeCorreo = {
  sitio: string
  organizador: { email: string; nombre: string }
  avisos: string
}

export function entornoDeCorreo(): EntornoDeCorreo {
  const entorno = entornoDelServidor()
  return {
    sitio: urlDelSitio(),
    // El esquema del entorno exige el remitente cuando hay proveedor; sin él, el organizador del .ics es el correo de avisos.
    organizador: {
      email: entorno.EMAIL_REMITENTE ?? entorno.EMAIL_AVISOS,
      nombre: entorno.EMAIL_REMITENTE_NOMBRE ?? 'Calesa',
    },
    avisos: entorno.EMAIL_AVISOS,
  }
}
