// @vitest-environment node
// La normalización usa el `URL` de Node, el mismo que corre en el servidor.
import { describe, expect, it } from 'vitest'

import { IP_DESCONOCIDA, ipDelPedido, ipParaLimite } from './ip'

const cabeceras = (valores: Record<string, string>) => new Headers(valores)

describe('ipDelPedido', () => {
  it('x-real-ip gana sobre x-forwarded-for', () => {
    const c = cabeceras({ 'x-real-ip': '1.2.3.4', 'x-forwarded-for': '5.6.7.8' })
    expect(ipDelPedido(c)).toBe('1.2.3.4')
  })

  it('sin x-real-ip toma el primer elemento de x-forwarded-for, sin espacios', () => {
    expect(ipDelPedido(cabeceras({ 'x-forwarded-for': ' 1.2.3.4 , 10.0.0.1' }))).toBe('1.2.3.4')
  })

  it.each([
    ['la mapeada con puntos', '::ffff:1.2.3.4'],
    ['la mapeada en hex y mayúsculas', '::FFFF:0102:0304'],
  ])('pasa a IPv4 %s', (_caso, ip) => {
    expect(ipDelPedido(cabeceras({ 'x-real-ip': ip }))).toBe('1.2.3.4')
  })

  it('devuelve la IPv6 completa, en minúscula y comprimida (nunca el /64)', () => {
    expect(ipDelPedido(cabeceras({ 'x-real-ip': '2001:DB8:a:b:0:0:0:4' }))).toBe('2001:db8:a:b::4')
  })

  it.each([
    ['vacía', ''],
    ['basura', 'basura'],
    ['con letras fuera de hex', 'zz::1'],
    ['con corchete y ruta', '::1]/x'],
    ['que hace lanzar a URL', '1::2::3'],
    ['IPv4 con un cero a la izquierda', '01.2.3.4'],
    ['IPv4 fuera de rango', '256.1.1.1'],
  ])('da desconocida con una IP %s', (_caso, ip) => {
    expect(ipDelPedido(cabeceras({ 'x-real-ip': ip }))).toBe(IP_DESCONOCIDA)
  })

  it('da desconocida sin cabeceras', () => {
    expect(ipDelPedido(cabeceras({}))).toBe('desconocida')
  })
})

describe('ipParaLimite', () => {
  it('cuenta una IPv6 por su prefijo /64', () => {
    expect(ipParaLimite('2001:db8:a:b::4')).toBe('2001:db8:a:b::/64')
    expect(ipParaLimite('2001:db8:a:b::9')).toBe('2001:db8:a:b::/64')
    expect(ipParaLimite('2001:db8:a:c::4')).toBe('2001:db8:a:c::/64')
    expect(ipParaLimite('2001:db8:0:0:1::')).toBe('2001:db8:0:0::/64')
  })

  it('arma el /64 de ::1 con sus ceros', () => {
    expect(ipParaLimite('::1')).toBe('0:0:0:0::/64')
  })

  it('deja igual una IPv4 y la desconocida', () => {
    expect(ipParaLimite('1.2.3.4')).toBe('1.2.3.4')
    expect(ipParaLimite(IP_DESCONOCIDA)).toBe(IP_DESCONOCIDA)
  })
})
