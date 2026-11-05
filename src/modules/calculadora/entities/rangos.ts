import { type z as zod, z } from 'zod'
import { formatearNumero, formatoUSD } from '@/shared/lib/formato'

// Los rangos de los campos numéricos de la calculadora y de la escala. Cualquier valor que no sirva (decimal, fuera de rango, texto o
// vacío) da un solo mensaje, siempre el mismo, con el rango permitido (semilla §5.2; el texto lo eligió la persona en P03, P3).

function enteroEntre(min: number, max: number, mensaje: string) {
  return z.int({ error: mensaje }).min(min, { error: mensaje }).max(max, { error: mensaje })
}

// «Escribe un número entero entre 1 y 400.»
export function campoEntero(min: number, max: number) {
  return enteroEntre(
    min,
    max,
    `Escribe un número entero entre ${formatearNumero(min)} y ${formatearNumero(max)}.`,
  )
}

// «Escribe un monto entre US$ 100 y US$ 30.000, sin centavos.»
export function campoMonto(min: number, max: number) {
  return enteroEntre(
    min,
    max,
    `Escribe un monto entre ${formatoUSD(min)} y ${formatoUSD(max)}, sin centavos.`,
  )
}

// Para el `when` de una regla cruzada: corre si esos campos pasaron su rango, aunque otro campo haya fallado. Sin `when`, Zod 4 la
// salta en cuanto el objeto trae un problema; con `() => true`, compararía un valor que ya falló.
export function cuandoPasaron(...campos: string[]) {
  return (payload: zod.core.ParsePayload) =>
    !payload.issues.some((problema) => campos.includes(String(problema.path?.[0])))
}
