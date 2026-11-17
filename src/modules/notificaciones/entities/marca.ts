// La envoltura de marca de todos los correos (§6.8, §8.1): tabla de 600 px, estilos en línea y colores en hex (los clientes de correo no
// leen `oklch` ni variables CSS). Dibuja los bloques de `contenido.ts` en HTML (con escape) y en texto.
//
// La etiqueta de plantilla se importa como `seguro` y no como `html`: Prettier reformatea el contenido de toda plantilla etiquetada `html`
// y le mete saltos y espacios al correo.
import type { Bloque } from './contenido'
import { crudo, html as seguro, urlSegura, type HtmlSeguro, type ParteDeHtml } from './html'

export const MARCA = {
  marca: '#4B2259',
  accion: '#5C2C6D',
  tinta: '#17141A',
  texto2: '#5A5866',
  borde: '#DCDBE2',
  fondo: '#F5F5F7',
  blanco: '#FFFFFF',
} as const

const FUENTE = 'Archivo, Arial, sans-serif'

function filaHtml([etiqueta, valor]: readonly [string, string]): HtmlSeguro {
  return seguro`<tr><td style="padding:4px 12px 4px 0;font-size:14px;color:${MARCA.texto2};vertical-align:top">${etiqueta}</td><td style="padding:4px 0;font-size:14px;color:${MARCA.tinta}">${valor}</td></tr>`
}

function botonHtml(texto: string, url: string): HtmlSeguro | null {
  const segura = urlSegura(url)
  if (!segura) return null
  return seguro`<p style="margin:8px 0 24px"><a href="${segura}" style="display:inline-block;padding:12px 24px;background:${MARCA.accion};color:${MARCA.blanco};border-radius:10px;font-size:16px;font-weight:bold;text-decoration:none">${texto}</a></p>`
}

function tablaHtml(bloque: Extract<Bloque, { tipo: 'tabla' }>): HtmlSeguro {
  const celda = (contenido: string, extra: string) =>
    seguro`<td style="padding:6px 8px;border-bottom:1px solid ${MARCA.borde};font-size:14px;color:${MARCA.tinta};${crudo(extra)}">${contenido}</td>`
  const encabezado = bloque.columnas.map((c) => celda(c, 'font-weight:bold'))
  const filas = bloque.filas.map((fila) => seguro`<tr>${fila.map((c) => celda(c, ''))}</tr>`)
  return seguro`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border-collapse:collapse"><tr>${encabezado}</tr>${filas}</table>`
}

function bloqueHtml(bloque: Bloque): HtmlSeguro | null {
  switch (bloque.tipo) {
    case 'parrafo':
      return seguro`<p style="margin:0 0 16px;font-size:16px;line-height:24px;color:${MARCA.tinta}">${bloque.texto}</p>`
    case 'subtitulo':
      return seguro`<p style="margin:24px 0 8px;font-size:14px;line-height:20px;font-weight:bold;color:${MARCA.texto2}">${bloque.texto}</p>`
    case 'filas':
      return seguro`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px">${bloque.filas.map(filaHtml)}</table>`
    case 'tabla':
      return tablaHtml(bloque)
    case 'boton':
      return botonHtml(bloque.texto, bloque.url)
  }
}

function bloqueTexto(bloque: Bloque): string | null {
  switch (bloque.tipo) {
    case 'parrafo':
    case 'subtitulo':
      return bloque.texto
    case 'filas':
      return bloque.filas.map(([etiqueta, valor]) => `${etiqueta}: ${valor}`).join('\n')
    case 'tabla':
      return [bloque.columnas, ...bloque.filas].map((fila) => fila.join(' | ')).join('\n')
    case 'boton': {
      const url = urlSegura(bloque.url)
      return url ? `${bloque.texto}:\n${url}` : null
    }
  }
}

export type CorreoDibujado = { html: string; texto: string }

const PARA_LA_FICHA_DE_UN_CLIENTE = `<meta name="viewport" content="width=device-width,initial-scale=1">`

// `sitio` sin barra final. El pie lleva el enlace a /privacidad.
export function envolver(args: {
  titulo: string
  bloques: readonly Bloque[]
  sitio: string
}): CorreoDibujado {
  const { titulo, bloques, sitio } = args
  const cuerpo: ParteDeHtml = bloques.map(bloqueHtml)
  const privacidad = `${sitio}/privacidad`
  const documento = seguro`<!doctype html>
<html lang="es"><head><meta charset="utf-8">${crudo(PARA_LA_FICHA_DE_UN_CLIENTE)}<title>${titulo}</title></head>
<body style="margin:0;padding:0;background:${MARCA.fondo};font-family:${FUENTE}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${MARCA.fondo}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${MARCA.blanco};border:1px solid ${MARCA.borde};border-radius:10px;font-family:${FUENTE}">
<tr><td style="background:${MARCA.marca};padding:20px 32px;border-radius:10px 10px 0 0;color:${MARCA.blanco};font-size:22px;font-weight:bold">Calesa</td></tr>
<tr><td style="padding:32px"><h1 style="margin:0 0 16px;font-size:22px;line-height:28px;color:${MARCA.tinta}">${titulo}</h1>${cuerpo}</td></tr>
<tr><td style="padding:16px 32px;border-top:1px solid ${MARCA.borde};font-size:12px;color:${MARCA.texto2}">Calesa · ${sitio} · <a href="${privacidad}" style="color:${MARCA.texto2}">Privacidad</a></td></tr>
</table></td></tr></table></body></html>`
  const texto = [
    titulo,
    ...bloques.map(bloqueTexto),
    `Calesa · ${sitio}\nPrivacidad:\n${privacidad}`,
  ]
    .filter((parte): parte is string => parte !== null)
    .join('\n\n')
  return { html: documento.valor, texto }
}
