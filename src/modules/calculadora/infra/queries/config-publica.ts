import 'server-only'

import { cacheLife, cacheTag } from 'next/cache'

import { errorDePostgrest, fallo, type Resultado } from '@/shared/lib/errores'

import { ETIQUETA_DE_CONFIG, leerFilaDeConfig, type ConfigCalculadora } from '../../entities/config'
import { crearClientePublico } from '../cliente-publico'

// Los datos del panel para la calculadora pública (semilla §5.2, B4), por `publico.config_calculadora()`: lee la fila única de
// `config_calculadora` sin `actualizado_por`. Cacheada 1 hora (las páginas públicas son estáticas con revalidación de 1 h) y con la
// etiqueta `calculadora`, que el panel invalida al guardar (P21). Un fallo no tumba la página: se devuelve como valor, la calculadora
// dice que no pudo calcular y se reintenta en minutos, no en una hora.
export async function leerConfigCalculadora(): Promise<Resultado<ConfigCalculadora>> {
  'use cache'
  cacheTag(ETIQUETA_DE_CONFIG)

  const { data, error } = await crearClientePublico().rpc('config_calculadora')
  if (error) {
    cacheLife('minutes')
    console.error(`config_calculadora: ${error.code} ${error.message}`)
    const { codigo, mensaje } = errorDePostgrest(error)
    return fallo(codigo, mensaje)
  }

  const config = leerFilaDeConfig(data as unknown)
  if (!config.ok) {
    cacheLife('minutes')
    console.error('config_calculadora: la respuesta no cumple el esquema')
    return config
  }
  cacheLife('hours')
  return config
}
