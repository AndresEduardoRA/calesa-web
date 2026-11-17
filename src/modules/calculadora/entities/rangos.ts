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

// Para el `when` de una regla cruzada: corre si esos campos pasaron su rango, aunque otro campo haya fallado (por tipo o por rango).
// Sin `when`, Zod 4 la salta sólo si otro campo falló por tipo; con `() => true`, compararía un valor que ya falló. Si la entrada no
// es un objeto, Zod deja un problema sin campo y no corre: la regla leería campos que no existen.
export function cuandoPasaron(...campos: string[]) {
  return ({ issues }: zod.core.ParsePayload) =>
    issues.every((problema) => {
      const campo = problema.path?.[0]
      return campo !== undefined && !campos.includes(String(campo))
    })
}
