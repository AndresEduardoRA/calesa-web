import { buttonVariants } from '@/shared/ui/button'

import type { ResumenDeFugas } from '../../../entities/resumen'
import { DesgloseDeFugas } from './desglose-de-fugas'

export type VistaDelResultado =
  | { tipo: 'sin_config' }
  | { tipo: 'incompleto'; conErrores: boolean }
  | { tipo: 'listo'; resumen: ResumenDeFugas; enlace: string }

const ETIQUETA =
  'font-mono text-(length:--text-xs) leading-[1.3] font-medium tracking-[0.06em] uppercase'
const AVISO = 'text-(length:--text-base) text-(--color-ink-soft)'

// El resultado de la calculadora (C10): el aviso mientras falta algo, el error si no se pudieron leer los datos del panel, o la
// estimación con su rango, las horas, el desglose y el enlace a agendar. Las cifras llegan formateadas de `resumen.ts` (X3).
export function ResultadoDeFugas({ vista }: { vista: VistaDelResultado }) {
  if (vista.tipo === 'sin_config') {
    return (
      <p role="alert" className="text-(length:--text-base) text-(--color-peligro-ink)">
        No pudimos calcular. Revisa los datos.
      </p>
    )
  }
  if (vista.tipo === 'incompleto') {
    return (
      <p className={AVISO}>
        {vista.conErrores
          ? 'Revisa los datos marcados para ver cuánto se te escapa.'
          : 'Llena los 5 datos para ver cuánto se te escapa.'}
      </p>
    )
  }

  const { resumen, enlace } = vista
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <p className={`${ETIQUETA} text-(--color-ink-soft)`}>Estimación</p>
      <p className="text-(length:--text-base) text-(--color-ink)">
        Se te escapan cada mes, como mínimo
      </p>
      <p
        aria-live="polite"
        className="text-[2.5rem] leading-tight font-semibold text-(--color-ink) tabular-nums"
      >
        {resumen.titular}
      </p>
      <p className="text-(length:--text-base) text-(--color-ink-soft) tabular-nums">
        {resumen.rango}
      </p>
      <p className="text-(length:--text-base) text-(--color-ink)">{`Horas a mano al mes: ${resumen.horas}`}</p>
      <DesgloseDeFugas filas={resumen.filas} />
      {/* Un <a> y no <Link>: con `typedRoutes`, `/agendar` no compila hasta que exista la ruta (P35/P36). P37 lo cambia. */}
      <a
        href={enlace}
        data-evento="clic_agendar"
        className={buttonVariants({ className: 'min-h-[2.75rem] self-start px-6' })}
      >
        Agendar demo
      </a>
    </div>
  )
}
