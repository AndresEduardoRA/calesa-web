// El escape del HTML de los correos. React Email está prohibido por el lint (P01): el escape es nuestro y es la única forma de meter un
// dato en el HTML. `html` escapa cada interpolación; sólo un `HtmlSeguro` armado por `html` o `crudo` pasa sin escapar.

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export class HtmlSeguro {
  constructor(readonly valor: string) {}
  toString(): string {
    return this.valor
  }
}

export type ParteDeHtml = string | number | HtmlSeguro | null | undefined | false | ParteDeHtml[]

export function escapar(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c)
}

function parteComoHtml(parte: ParteDeHtml): string {
  if (parte === null || parte === undefined || parte === false) return ''
  if (parte instanceof HtmlSeguro) return parte.valor
  if (Array.isArray(parte)) return parte.map(parteComoHtml).join('')
  return escapar(String(parte))
}

// Lo que escribes tú, en la plantilla, es HTML; lo que interpolas es dato y se escapa.
export function html(trozos: TemplateStringsArray, ...partes: ParteDeHtml[]): HtmlSeguro {
  let salida = ''
  trozos.forEach((trozo, i) => {
    salida += trozo
    if (i < partes.length) salida += parteComoHtml(partes[i])
  })
  return new HtmlSeguro(salida)
}

// HTML fijo del propio módulo (nunca un dato de la persona).
export function crudo(valor: string): HtmlSeguro {
  return new HtmlSeguro(valor)
}

// Un enlace sólo es `http:` o `https:`: un `javascript:`, `data:` o cualquier otro esquema no se dibuja (null).
export function urlSegura(url: string): string | null {
  try {
    const { protocol } = new URL(url)
    return protocol === 'https:' || protocol === 'http:' ? url : null
  } catch {
    return null
  }
}
