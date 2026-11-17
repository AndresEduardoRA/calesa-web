// Lo que cruza entre el registro de correos y la base: la respuesta de las RPC de `correos_salientes` (P27) validada con Zod, y los `datos` de
// una fila convertidos a JSON antes de mandarlos. Sin I/O.
import { z } from 'zod'

import { fallo, ok } from '@/shared/lib/errores'

// La base escribe las fechas con zona (`2026-11-05T14:00:00+00:00`); en el módulo viajan como `toISOString()` (`…:00.000Z`), igual que
// `deps.reloj().toISOString()` y que el registro en memoria.
const fecha = z.iso.datetime({ offset: true }).transform((iso) => new Date(iso).toISOString())

// Las 14 claves de `FilaDeCorreo`; una clave de más se ignora (una columna futura no tumba el correo).
export const esquemaDeFila = z.object({
  id: z.guid(),
  para: z.string(),
  plantilla: z.string(),
  datos: z.record(z.string(), z.unknown()),
  adjuntoIcs: z.string().nullable(),
  estado: z.enum(['enviado', 'programado', 'cancelado', 'fallido']),
  resendId: z.string().nullable(),
  programadoPara: fecha.nullable(),
  intentos: z.int().min(0),
  ultimoError: z.string().nullable(),
  enviadoEn: fecha.nullable(),
  referencia: z.string().nullable(),
  reunionId: z.guid().nullable(),
  solicitudId: z.guid().nullable(),
})

export const esquemaDeFilas = z.array(esquemaDeFila)

const esquemaDeDatos = z.record(z.string(), z.json())

const MENSAJE_DATOS_INVALIDOS = 'Los datos del correo no se pueden guardar.'

// Lo mismo que hace `supabase-js` al mandar: pasa por JSON (quita los `undefined` y lanza con un `BigInt`).
export function datosComoJson(datos: Record<string, unknown>) {
  try {
    const validos = esquemaDeDatos.safeParse(JSON.parse(JSON.stringify(datos)))
    return validos.success ? ok(validos.data) : fallo('validacion', MENSAJE_DATOS_INVALIDOS)
  } catch {
    return fallo('validacion', MENSAJE_DATOS_INVALIDOS)
  }
}
