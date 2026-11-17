// Los cupos gratis (R5.2): se avisa a más del 80 % del plan gratis. Quien mide (la tarea diaria, P13) da los valores.

// 400 MB (R5.2), en bytes decimales: avisa un poco antes que con 400 MiB.
export const UMBRAL_DE_BASE_BYTES = 400_000_000
// 80 correos al día (R5.2).
export const UMBRAL_DE_CORREOS_DIA = 80

export type Cupo = 'base' | 'correos'

const cuenta = (valor: number, umbral: number) => Number.isFinite(valor) && valor > umbral

// Los cupos que pasan el umbral («más del 80 %»), siempre en el orden base, correos.
export function evaluarCupos({
  bytesDeBase,
  correosDelDia,
}: {
  bytesDeBase: number
  correosDelDia: number
}): Cupo[] {
  const pasan: Cupo[] = []
  if (cuenta(bytesDeBase, UMBRAL_DE_BASE_BYTES)) {
    pasan.push('base')
  }
  if (cuenta(correosDelDia, UMBRAL_DE_CORREOS_DIA)) {
    pasan.push('correos')
  }
  return pasan
}

const COMPLETA_EL_AVISO: Record<Cupo, string> = {
  base: 'la base de datos',
  correos: 'correos',
}

// El banner de UX.md: «Te acercas al límite gratis de <base o correos>.»
export function textoDelAvisoDeCupo(cupo: Cupo): string {
  return `Te acercas al límite gratis de ${COMPLETA_EL_AVISO[cupo]}.`
}
