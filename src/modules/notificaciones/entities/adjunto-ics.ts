// El .ics como adjunto del correo (P28 dejó la tubería): `text/calendar; method=REQUEST|CANCEL`, el contenido en UTF-8 y base64. El tipo no
// lleva `charset`: RFC 5545 §3.1.4 fija UTF-8. Puro; `Buffer` no es I/O.
import type { AdjuntoDeEmail } from '@/shared/lib/email/tipos'
import type { MetodoIcs } from './contenido'

export const NOMBRE_DEL_ICS = 'demo-calesa.ics'

export function adjuntoDeIcs(ics: string, metodo: MetodoIcs): AdjuntoDeEmail {
  return {
    nombre: NOMBRE_DEL_ICS,
    tipo: `text/calendar; method=${metodo}`,
    contenido: Buffer.from(ics, 'utf8').toString('base64'),
  }
}
