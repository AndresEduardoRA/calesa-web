import { expect, test } from '@playwright/test'

import { calcularFugas } from '@/modules/calculadora/entities/calculadora'
import { leerFilaDeConfig } from '@/modules/calculadora/entities/config'
import { resumenDeFugas } from '@/modules/calculadora/entities/resumen'

import { sql } from '../soporte/sql'

// @sin-celular-archivo: lee la base local con psql y no abre ninguna página; en movil repetiría lo mismo

// La calculadora pública todavía no está montada en ninguna ruta (`/` es de P08; el e2e de pantalla es de P37). Lo que sí se prueba
// de punta a punta es lo que lee el visitante: la fila de `publico.config_calculadora()` como `anon`, pasada por las mismas
// funciones que usa la pantalla, reproduce el ejemplo 1 de §5.2.
//
// El spec NO escribe la fila, a propósito: lo que prueba son los valores iniciales que deja la migración. Si los pusiera él, no
// diría nada. Por eso depende de una base recién reseteada (cada bloque de CI y `pnpm test:e2e:completo` parten de `db:reset`), y
// si la fila cambió lo dice con un mensaje claro en vez de dar cifras distintas.
const VALORES_INICIALES = {
  precio: 18000,
  pct_sena: 60,
  sena: 2000,
  moneda_local: true,
  pct_local: 40,
  volatilidad: 'media',
  sueldo: 700,
  tasa: 15,
  ciclo_dias: 76,
}

test('E2E calculadora: los datos del panel que lee el visitante reproducen el ejemplo 1', () => {
  const crudo = sql(
    "set role anon; select coalesce(json_agg(c), '[]'::json) from publico.config_calculadora() c;",
  )
  const fila = leerFilaDeConfig(JSON.parse(crudo) as unknown)
  if (!fila.ok) throw new Error(`la respuesta de config_calculadora no cumple el esquema: ${crudo}`)

  expect(
    fila.data,
    'la fila config_calculadora no tiene los valores iniciales: corre pnpm db:reset',
  ).toEqual(VALORES_INICIALES)

  const resumen = resumenDeFugas(
    calcularFugas(
      { autos: 25, margen: 1800, consultas: 300, respuesta: 'dia', administracion: 3 },
      fila.data,
    ),
  )
  expect(resumen.titular).toBe('US$ 4.452')
  expect(resumen.rango).toBe('US$ 4.452 – US$ 8.935')
  expect(resumen.horas).toBe('77 a 139')
})
