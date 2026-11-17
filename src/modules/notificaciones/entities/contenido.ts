// Lo que una plantilla entrega: sólo datos (asunto, título y bloques). `marca.ts` los dibuja en HTML y en texto desde el mismo contenido,
// así los dos dicen lo mismo y todo dato pasa por el escape. Sólo tipos.

export type Bloque =
  | { tipo: 'parrafo'; texto: string }
  | { tipo: 'subtitulo'; texto: string }
  | { tipo: 'filas'; filas: readonly (readonly [etiqueta: string, valor: string])[] }
  | { tipo: 'tabla'; columnas: readonly string[]; filas: readonly (readonly string[])[] }
  | { tipo: 'boton'; texto: string; url: string }

export type MetodoIcs = 'REQUEST' | 'CANCEL'

export type Contenido = {
  asunto: string
  titulo: string
  bloques: readonly Bloque[]
  ics: MetodoIcs | null
}

export type Organizador = { email: string; nombre: string }

// Lo que el módulo no puede saber solo: la URL del sitio, la hora y quién organiza. Lo da `infra/`.
export type Contexto = { sitio: string; ahora: string; organizador: Organizador }
