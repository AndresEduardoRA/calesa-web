// Reparto parejo (§5.6): da lo siguiente a quien menos tiene. Es genérico: el `conteo` son las
// reuniones de la semana, las solicitudes de la semana o los clics de WhatsApp, según quién llame.

export type CandidatoReparto = {
  id: string
  conteo: number
  // Cuándo recibió lo último; null = nunca.
  ultimaEn: string | null
  creadoEn: string
}

const ANTES_DE_TODO = Number.NEGATIVE_INFINITY

// Los instantes se comparan en milisegundos: el ISO admite desfases y no ordena como texto.
const ms = (iso: string | null): number => (iso === null ? ANTES_DE_TODO : Date.parse(iso))

function comparar(a: CandidatoReparto, b: CandidatoReparto): number {
  if (a.conteo !== b.conteo) {
    return a.conteo - b.conteo
  }
  // «Nunca tuvo» (null) va primero; después, la última recibida más antigua.
  if (ms(a.ultimaEn) !== ms(b.ultimaEn)) {
    return ms(a.ultimaEn) < ms(b.ultimaEn) ? -1 : 1
  }
  if (ms(a.creadoEn) !== ms(b.creadoEn)) {
    return ms(a.creadoEn) - ms(b.creadoEn)
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

// El id de quien gana, o null con la lista vacía. Menor conteo; empate: la última más antigua
// (o nunca); empate: `creadoEn` más antiguo; empate: el id menor, para que sea determinista.
export function repartoParejo(candidatos: CandidatoReparto[]): string | null {
  const [primero] = [...candidatos].sort(comparar)
  return primero?.id ?? null
}
