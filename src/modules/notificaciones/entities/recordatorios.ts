// Cuándo salen los recordatorios (§5.5, X6). El de 24 h sólo si la reunión se reservó antes de `inicio − 24 h`; el de 1 h, siempre.
const MS_POR_HORA = 3_600_000

export type MomentosDeRecordatorio = { r24: string | null; r1: string }

export function momentosDeRecordatorio(args: {
  reservadaEn: string
  inicio: string
}): MomentosDeRecordatorio {
  const inicio = Date.parse(args.inicio)
  const reservada = Date.parse(args.reservadaEn)
  const veinticuatro = inicio - 24 * MS_POR_HORA
  return {
    r24: reservada < veinticuatro ? new Date(veinticuatro).toISOString() : null,
    r1: new Date(inicio - MS_POR_HORA).toISOString(),
  }
}
