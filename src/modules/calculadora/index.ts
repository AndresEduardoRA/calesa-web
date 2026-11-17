// La entrada de servidor de `calculadora`: esquemas, fórmulas puras y sus tipos. La usa el servidor para recalcular con los datos
// del visitante (sin creerle al navegador) y la pantalla de la calculadora.
export {
  TIEMPOS_DE_RESPUESTA,
  esquemaEntradasCalculadora,
  type EntradasCalculadora,
  type TiempoRespuesta,
} from './entities/entradas'
export {
  VOLATILIDADES,
  esquemaConfigCalculadora,
  type ConfigCalculadora,
  type Volatilidad,
} from './entities/config'
export { calcularFugas, type Escenario, type ResultadoFugas } from './entities/calculadora'
export { resumenDeFugas, type FilaDeFugas, type ResumenDeFugas } from './entities/resumen'
export {
  calcularEscala,
  esquemaEntradasEscala,
  textosDeEscala,
  type EntradasEscala,
  type ResultadoEscala,
  type TextosDeEscala,
} from './entities/escala'
