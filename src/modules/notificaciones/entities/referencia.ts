// La referencia idempotente de cada correo (`recordatorio24:<reunion>`, §3): el proveedor no manda dos veces el mismo correo con la misma
// referencia, y con la misma referencia y otro cuerpo responde 409. Por eso lo que cambia el cuerpo (la secuencia de la reunión, el
// enlace de Meet en los recordatorios) va en la referencia. Sólo caracteres de `[A-Za-z0-9_:.-]`, hasta 256.
import type { DatosDeCorreo } from './datos'

// FNV-1a de 32 bits, en 8 hex: corto, estable y sin dependencias. No es un secreto, sólo distingue enlaces.
export function hashCorto(texto: string): string {
  let hash = 0x811c9dc5
  for (const byte of new TextEncoder().encode(texto)) {
    hash = Math.imul(hash ^ byte, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

const ms = (iso: string): number => Date.parse(iso)

function referenciaDeReunion(datos: Extract<DatosDeCorreo, { reunion: unknown }>): string {
  const { plantilla, reunion } = datos
  const { reunionId, secuencia, enlaceMeet } = reunion
  switch (datos.plantilla) {
    case 'reunion-confirmada':
    case 'reunion-nueva-anfitrion':
    case 'reunion-cambiada':
      return `${plantilla}:${reunionId}:${secuencia}`
    case 'reunion-cambiada-equipo':
      return `${plantilla}:${reunionId}:${secuencia}:${datos.destinatario}`
    case 'reunion-cancelada':
      return `${plantilla}:${reunionId}:${datos.destinatario}`
    // Llevan el Meet en el cuerpo: si cambia el enlace, cambia la referencia.
    case 'recordatorio-24h':
      return `${plantilla}:${reunionId}:${secuencia}:${hashCorto(enlaceMeet)}`
    case 'recordatorio-1h':
      return `${plantilla}:${reunionId}:${secuencia}:${datos.destinatario}:${hashCorto(enlaceMeet)}`
    case 'meet-cambiado':
      return `${plantilla}:${reunionId}:${ms(datos.cambioEn)}`
  }
}

export function referenciaDe(datos: DatosDeCorreo): string {
  if ('reunion' in datos) return referenciaDeReunion(datos)
  switch (datos.plantilla) {
    case 'detalle-calculadora':
      return `${datos.plantilla}:${datos.solicitudId}:${ms(datos.pedidoEn)}`
    case 'solicitud-sin-reunion':
      return `${datos.plantilla}:${datos.solicitudId}`
    case 'aviso-equipo':
      return `${datos.plantilla}:${datos.tipo}:${datos.solicitudId}:${ms(datos.ocurridoEn)}`
    case 'correo-fallido':
      return `${datos.plantilla}:${datos.correoId}`
  }
}
