import { describe, expect, it } from 'vitest'

import { crearContadorEnMemoria } from './contador-en-memoria.soporte'

function relojFijo(inicio: string) {
  let ahora = new Date(inicio).getTime()
  return {
    reloj: () => new Date(ahora),
    avanzar: (segundos: number) => {
      ahora += segundos * 1000
    },
  }
}

const pedido = (clave: string) => ({ clave, maximo: 2, ventanaSegundos: 3600 })

describe('crearContadorEnMemoria (contrato de ContarEnvio, ventana fija)', () => {
  it('permite hasta el máximo dentro de la ventana y después no', async () => {
    const { reloj } = relojFijo('2026-11-03T10:00:00Z')
    const contar = crearContadorEnMemoria(reloj)
    expect(await contar(pedido('formulario:x'))).toEqual({ ok: true, data: true })
    expect(await contar(pedido('formulario:x'))).toEqual({ ok: true, data: true })
    expect(await contar(pedido('formulario:x'))).toEqual({ ok: true, data: false })
  })

  it('a los 59:59 sigue la misma ventana; a la hora exacta se reinicia con conteo 1', async () => {
    const { reloj, avanzar } = relojFijo('2026-11-03T10:00:00Z')
    const contar = crearContadorEnMemoria(reloj)
    await contar(pedido('k'))
    await contar(pedido('k'))
    avanzar(3599)
    expect(await contar(pedido('k'))).toEqual({ ok: true, data: false })
    avanzar(1)
    expect(await contar(pedido('k'))).toEqual({ ok: true, data: true })
    expect(await contar(pedido('k'))).toEqual({ ok: true, data: true })
    expect(await contar(pedido('k'))).toEqual({ ok: true, data: false })
  })

  it('cada clave lleva su propio conteo', async () => {
    const { reloj } = relojFijo('2026-11-03T10:00:00Z')
    const contar = crearContadorEnMemoria(reloj)
    await contar(pedido('a'))
    await contar(pedido('a'))
    expect(await contar(pedido('a'))).toEqual({ ok: true, data: false })
    expect(await contar(pedido('b'))).toEqual({ ok: true, data: true })
  })
})
