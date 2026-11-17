import { esquemaEntradasCalculadora, type EntradasCalculadora } from '../../../entities/entradas'

// Del texto del formulario a las entradas de la calculadora (semilla §5.2, B4). Un campo vacío es un campo sin llenar y no da error;
// un número es un entero, con o sin punto de miles («1.800»); cualquier otro texto da el mensaje de rango del campo. Valida con el
// mismo esquema que usa el servidor.

export type CampoDelFormulario = keyof EntradasCalculadora

export const CAMPOS_DEL_FORMULARIO = [
  'autos',
  'margen',
  'consultas',
  'respuesta',
  'administracion',
] as const satisfies readonly CampoDelFormulario[]

export type ValoresDelFormulario = Record<CampoDelFormulario, string>

export type EstadoDelFormulario =
  | { estado: 'listo'; entradas: EntradasCalculadora }
  | { estado: 'incompleto'; errores: Partial<Record<CampoDelFormulario, string>> }

const ENTERO = /^(?:\d+|\d{1,3}(?:\.\d{3})+)$/

// Un texto que no es un entero se pasa tal cual: el esquema lo rechaza con el mensaje de rango del campo.
const leerNumero = (texto: string): number | string =>
  ENTERO.test(texto) ? Number(texto.replaceAll('.', '')) : texto

export function entradasDelFormulario(valores: ValoresDelFormulario): EstadoDelFormulario {
  const llenos = CAMPOS_DEL_FORMULARIO.filter((campo) => valores[campo].trim() !== '')
  const crudo: Partial<Record<CampoDelFormulario, unknown>> = {}
  for (const campo of llenos) {
    const texto = valores[campo].trim()
    crudo[campo] = campo === 'respuesta' ? texto : leerNumero(texto)
  }

  const resultado = esquemaEntradasCalculadora.safeParse(crudo)
  if (resultado.success) return { estado: 'listo', entradas: resultado.data }

  const errores: Partial<Record<CampoDelFormulario, string>> = {}
  for (const problema of resultado.error.issues) {
    const campo = llenos.find((lleno) => lleno === problema.path[0])
    if (campo !== undefined && errores[campo] === undefined) errores[campo] = problema.message
  }
  return { estado: 'incompleto', errores }
}
