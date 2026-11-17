import { cn } from '@/shared/lib/utils'

import type { Tarjeta } from '../../../entities/tarjetas'
import type { FormaDePago } from './selector-de-pago'

// Una tarjeta de plan (semilla §5.4, B6 y B7): nombre, tamaño, las 4 líneas, el plazo y la cuota al frente según la forma de pago.
// Los textos llegan hechos desde `entities/tarjetas.ts`: aquí no se compone ninguna cifra.
export function TarjetaDePlan({ tarjeta, pago }: { tarjeta: Tarjeta; pago: FormaDePago }) {
  return (
    <li
      className={cn(
        'flex min-w-0 flex-col gap-4 rounded-(--radius-card) border bg-(--color-surface) p-6',
        tarjeta.recomendado ? 'border-2 border-(--color-marca)' : 'border-(--color-line)',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-(length:--text-lg) font-semibold text-(--color-ink)">
          {tarjeta.nombre}
        </h3>
        {tarjeta.recomendado ? (
          <span className="rounded-(--radius-pill) bg-(--color-marca) px-3 py-1 text-(length:--text-xs) font-medium text-(--color-sobre-marca)">
            Recomendado
          </span>
        ) : null}
      </div>
      <p className="text-(length:--text-xl) font-semibold text-(--color-ink) tabular-nums">
        {pago === 'mensual' ? tarjeta.mensual : tarjeta.anual}
      </p>
      <p className="text-(length:--text-sm) text-(--color-ink-soft) tabular-nums">
        {tarjeta.implementacion}
      </p>
      <p className="text-(length:--text-sm) font-medium text-(--color-ink)">{tarjeta.tamano}</p>
      <ul className="flex flex-col gap-2 text-(length:--text-sm) text-(--color-ink)">
        {tarjeta.lineas.map((linea) => (
          <li key={linea}>{linea}</li>
        ))}
      </ul>
      <p className="mt-auto text-(length:--text-sm) text-(--color-ink-soft)">{tarjeta.plazo}</p>
    </li>
  )
}
