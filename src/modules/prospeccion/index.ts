// La entrada de servidor de `prospeccion`: los códigos de los enlaces de prospección (R4.19). Por ahora sólo reglas puras; los
// enlaces del panel (crear, copiar, desactivar) llegan con P16.
export {
  MENSAJE_CODIGO_INVALIDO,
  PATRON_CODIGO,
  codigoDeRef,
  esCodigoValido,
  esquemaCodigoDeProspeccion,
  normalizarCodigo,
} from './entities/codigo'
