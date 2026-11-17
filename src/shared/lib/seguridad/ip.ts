import { z } from 'zod'

// La IP del visitante, para Turnstile y para el límite de envíos. En Vercel, `x-real-ip` y `x-forwarded-for` las pone la
// plataforma y pisa lo que mande el cliente (docs de Vercel, «Request headers»); fuera de Vercel se pueden falsear, y el e2e
// lo usa para variar la IP. Hace lo mismo que `ipAddress()` de `@vercel/functions`, sin sumar la dependencia.

export const IP_DESCONOCIDA = 'desconocida'

type Cabeceras = { get(nombre: string): string | null }

const esIpv4 = (valor: string) => z.ipv4().safeParse(valor).success
const esIpv6 = (valor: string) => z.ipv6().safeParse(valor).success
const SOLO_IP = /^[0-9a-fA-F:.]+$/
const MAPEADA = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/

function cruda(cabeceras: Cabeceras): string {
  const real = cabeceras.get('x-real-ip')?.trim()
  if (real) return real
  return cabeceras.get('x-forwarded-for')?.split(',')[0]?.trim() ?? ''
}

// IPv6 en la forma canónica del `URL` de WHATWG (minúscula, comprimida, la mapeada en hex): una misma IP da una sola clave
// aunque llegue escrita de dos maneras. El `ipv6` de Zod no acepta la forma con puntos, así que se valida al final.
function normalizar(valor: string): string {
  if (esIpv4(valor)) return valor
  if (!SOLO_IP.test(valor)) return IP_DESCONOCIDA
  let ip: string
  try {
    ip = new URL(`http://[${valor}]`).hostname.slice(1, -1)
  } catch {
    return IP_DESCONOCIDA
  }
  const mapeada = MAPEADA.exec(ip)
  if (mapeada) {
    const [alto, bajo] = [parseInt(mapeada[1] ?? '', 16), parseInt(mapeada[2] ?? '', 16)]
    ip = [alto >> 8, alto & 255, bajo >> 8, bajo & 255].join('.')
  }
  return esIpv4(ip) || esIpv6(ip) ? ip : IP_DESCONOCIDA
}

// La IP real normalizada (la que va a Turnstile), o `'desconocida'` si falta o no vale.
export function ipDelPedido(cabeceras: Cabeceras): string {
  const valor = cruda(cabeceras)
  return valor === '' ? IP_DESCONOCIDA : normalizar(valor)
}

function gruposDe(ipv6: string): string[] {
  const [cabeza = '', cola = ''] = ipv6.split('::')
  const partir = (texto: string) => (texto === '' ? [] : texto.split(':'))
  if (!ipv6.includes('::')) return partir(cabeza)
  const [inicio, fin] = [partir(cabeza), partir(cola)]
  return [...inicio, ...Array<string>(8 - inicio.length - fin.length).fill('0'), ...fin]
}

// Lo que se cuenta para el límite: una IPv6 por su prefijo /64 (una conexión suele tener la /64 entera y rotar dentro de
// ella); una IPv4 y la desconocida, tal cual. Sólo la usa `claveDeLimite`.
export function ipParaLimite(ip: string): string {
  if (!esIpv6(ip)) return ip
  const prefijo = gruposDe(ip)
    .slice(0, 4)
    .map((grupo) => parseInt(grupo, 16).toString(16))
  return `${prefijo.join(':')}::/64`
}
