// Números y montos con Intl, en el locale del proyecto. Nunca `toFixed` ni concatenar símbolos. La excepción es `formatoUSD`, por
// la semilla (§5.1): `Intl` en es-BO escribe «USD» y Calesa muestra «US$ 4.452» (decisión de P01).
// En pantalla los montos pasan por el componente de montos del sistema de diseño; esto es el texto que imprime.

// semilla-a-repo lo cambia por el locale de la semilla.
export const LOCALE_POR_DEFECTO = 'es-BO'

type OpcionesNumero = { locale?: string; decimales?: number }
type OpcionesMonto = { moneda: string; locale?: string; decimales?: number }

// Construir un Intl.NumberFormat es caro y una tabla lo pide cientos de veces con las mismas opciones.
const formateadores = new Map<string, Intl.NumberFormat>()

function formateador(locale: string, opciones: Intl.NumberFormatOptions): Intl.NumberFormat {
  const clave = `${locale}|${JSON.stringify(opciones)}`
  let existente = formateadores.get(clave)
  if (!existente) {
    try {
      existente = new Intl.NumberFormat(locale, opciones)
    } catch {
      // Un locale o una moneda que `Intl` no conoce (un dato mal guardado) no puede tumbar cada
      // pantalla que imprime un número: se formatea con lo de fábrica.
      existente = new Intl.NumberFormat(LOCALE_POR_DEFECTO, { ...opciones, currency: 'USD' })
    }
    formateadores.set(clave, existente)
  }
  return existente
}

// Hasta `decimales` decimales, sin ceros de relleno: 1234.5 → «1.234,5».
export function formatearNumero(valor: number, opciones: OpcionesNumero = {}): string {
  const { locale = LOCALE_POR_DEFECTO, decimales = 2 } = opciones
  return formateador(locale, { maximumFractionDigits: decimales }).format(valor)
}

// Siempre con los decimales de la moneda (2 por defecto): 1234.5 USD → «USD 1.234,50».
export function formatearMonto(valor: number, opciones: OpcionesMonto): string {
  const { moneda, locale = LOCALE_POR_DEFECTO, decimales = 2 } = opciones
  return formateador(locale, {
    style: 'currency',
    currency: moneda,
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valor)
}

// Recibe una fracción: 0.125 → «12,5%».
export function formatearPorcentaje(fraccion: number, opciones: OpcionesNumero = {}): string {
  const { locale = LOCALE_POR_DEFECTO, decimales = 1 } = opciones
  return formateador(locale, { style: 'percent', maximumFractionDigits: decimales }).format(
    fraccion,
  )
}

// El texto que se abre para editar un número: la precisión completa (15 cifras significativas, las del cast de la base), sin
// separador de miles y con la coma o el punto decimal del locale. No usa los decimales con que se muestra: abrir «1.234,57» y salir
// con Tab emitiría un cambio que nadie hizo. 0.1494 → «0,1494»; 0.1 + 0.2 → «0,3».
export function formatearParaEditar(valor: number, opciones: { locale?: string } = {}): string {
  const { locale = LOCALE_POR_DEFECTO } = opciones
  return formateador(locale, { maximumSignificantDigits: 15, useGrouping: false }).format(valor)
}

// Los montos de Calesa (semilla §5.1): «US$ », un espacio normal y el entero, con la mitad hacia arriba (X3) y punto de miles.
// 4451.87 → «US$ 4.452»; -1234.5 → «-US$ 1.235» (la semilla no define los negativos); -0.4 → «US$ 0», nunca «-0».
export function formatoUSD(valor: number): string {
  if (!Number.isFinite(valor)) return '—'
  const cifra = formateador(LOCALE_POR_DEFECTO, {
    maximumFractionDigits: 0,
    roundingMode: 'halfExpand',
    useGrouping: 'always',
    signDisplay: 'negative',
  }).format(valor)
  const negativo = cifra.startsWith('-') || cifra.startsWith('−')
  return negativo ? `-US$ ${cifra.slice(1)}` : `US$ ${cifra}`
}

// Un rango de montos, sin reordenar: «US$ 4.452 – US$ 8.935» (raya U+2013 entre espacios).
export function formatoRango(desde: number, hasta: number): string {
  return `${formatoUSD(desde)} – ${formatoUSD(hasta)}`
}
