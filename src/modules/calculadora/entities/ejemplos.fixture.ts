import type { ConfigCalculadora } from './config'
import type { EntradasCalculadora } from './entradas'

// Los datos de los ejemplos de la semilla (§5.2), para las pruebas. Los iniciales del panel son los de §3 (`config_calculadora`);
// en la app salen de la base, nunca de aquí.
export const CONFIG_INICIAL: ConfigCalculadora = {
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

// Ejemplo 1: autos 25, margen 1800, consultas 300, respuesta dia, administracion 3.
export const ENTRADAS_E1: EntradasCalculadora = {
  autos: 25,
  margen: 1800,
  consultas: 300,
  respuesta: 'dia',
  administracion: 3,
}

// Ejemplo 2: autos 10, margen 1200, consultas 150, respuesta h1, administracion 2.
export const ENTRADAS_E2: EntradasCalculadora = {
  autos: 10,
  margen: 1200,
  consultas: 150,
  respuesta: 'h1',
  administracion: 2,
}

// Ejemplo 3: el 1 con `moneda_local = false` en el panel.
export const CONFIG_E3: ConfigCalculadora = { ...CONFIG_INICIAL, moneda_local: false }
