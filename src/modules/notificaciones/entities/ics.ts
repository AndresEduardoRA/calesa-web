// El .ics de una reunión (RFC 5545), escrito a mano: sin dependencia. REQUEST para confirmar o cambiar, CANCEL para cancelar. El UID es
// estable por reunión y SEQUENCE es la `secuencia` que dejó la RPC: así el calendario del visitante actualiza el mismo evento en vez de
// duplicarlo. Nunca lleva el enlace de gestión (lleva el token).
import type { MetodoIcs, Organizador } from './contenido'
import type { Reunion } from './datos'

const SALTO = '\r\n'
const OCTETOS_POR_LINEA = 75
const DOMINIO_DEL_UID = 'calesa.app'

// `2026-11-03T14:00:00Z` → `20261103T140000Z`
export function instanteIcs(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]|\.\d{3}/g, '')
}

// Un valor de texto (RFC 5545 §3.3.11): `\`, `;`, `,` y los saltos de línea.
export function escaparTextoIcs(texto: string): string {
  return texto
    .replace(/\\/g, '\\\\')
    .replace(/;/g, String.raw`\;`)
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

// Pliega una línea a 75 octetos UTF-8; la continuación empieza con un espacio. Nunca parte un carácter de varios bytes.
export function plegarLinea(linea: string): string[] {
  const codificador = new TextEncoder()
  const lineas: string[] = []
  let actual = ''
  let octetos = 0
  for (const letra of linea) {
    const largo = codificador.encode(letra).length
    const tope = lineas.length === 0 ? OCTETOS_POR_LINEA : OCTETOS_POR_LINEA - 1
    if (octetos + largo > tope) {
      lineas.push(lineas.length === 0 ? actual : ` ${actual}`)
      actual = ''
      octetos = 0
    }
    actual += letra
    octetos += largo
  }
  lineas.push(lineas.length === 0 ? actual : ` ${actual}`)
  return lineas
}

// El parámetro CN va entre comillas; las comillas y los controles del nombre se cambian por un espacio.
const cn = (nombre: string): string => `"${nombre.replace(/["\u0000-\u001F\u007F]/g, ' ')}"`

type Entrada = {
  metodo: MetodoIcs
  reunion: Reunion
  ahora: string
  organizador: Organizador
}

export function armarIcs({ metodo, reunion, ahora, organizador }: Entrada): string {
  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Calesa//Agenda//ES',
    'CALSCALE:GREGORIAN',
    `METHOD:${metodo}`,
    'BEGIN:VEVENT',
    `UID:${reunion.reunionId}@${DOMINIO_DEL_UID}`,
    `SEQUENCE:${reunion.secuencia}`,
    `DTSTAMP:${instanteIcs(ahora)}`,
    `DTSTART:${instanteIcs(reunion.inicio)}`,
    `DTEND:${instanteIcs(reunion.fin)}`,
    `SUMMARY:${escaparTextoIcs('Demo de Calesa')}`,
    `LOCATION:${escaparTextoIcs(reunion.enlaceMeet)}`,
    `DESCRIPTION:${escaparTextoIcs(`Demo de Calesa con ${reunion.anfitrion.nombre}. Entra a la reunión: ${reunion.enlaceMeet}`)}`,
    `ORGANIZER;CN=${cn(organizador.nombre)}:mailto:${organizador.email}`,
    `ATTENDEE;CN=${cn(reunion.visitante.nombre)};ROLE=REQ-PARTICIPANT;RSVP=FALSE:mailto:${reunion.visitante.email}`,
    `STATUS:${metodo === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED'}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lineas.flatMap(plegarLinea).join(SALTO) + SALTO
}
