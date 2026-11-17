// El botón de WhatsApp (D3, R3.1, R4.10). El número lo da la RPC `elegir_whatsapp` (P31); aquí sólo la forma del enlace y del destino
// cuando no hay nadie.

// D3: el mensaje con el que se abre el chat.
export const MENSAJE_DE_WHATSAPP = 'Hola, vengo de calesa.app y quiero ver una demo con mis autos.'

// `perfiles.whatsapp` es E.164 (semilla §3).
const PATRON_E164 = /^\+[1-9]\d{7,14}$/

// `https://wa.me/<dígitos>?text=<mensaje>` o `null`: nunca un enlace roto.
export function enlaceDeWhatsApp(numero: string | null | undefined): string | null {
  if (typeof numero !== 'string' || !PATRON_E164.test(numero)) {
    return null
  }
  return `https://wa.me/${numero.slice(1)}?text=${encodeURIComponent(MENSAJE_DE_WHATSAPP)}`
}

// R4.10: si nadie está disponible, el botón lleva a /agendar con este aviso (la franja la dibuja `/agendar`).
export const AVISO_SIN_WHATSAPP = 'sin-whatsapp'
export const RUTA_SIN_WHATSAPP = `/agendar?aviso=${AVISO_SIN_WHATSAPP}`
