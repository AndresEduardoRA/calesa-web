import { TriangleAlert } from 'lucide-react'
import { useId } from 'react'

import type { CampoDelFormulario as Campo } from '../schemas/formulario'

type Props = {
  nombre: Campo
  etiqueta: string
  valor: string
  error: string | undefined
  onCambio: (valor: string) => void
  prefijo?: string
  sufijo?: string
  opciones?: readonly (readonly [string, string])[]
}

const CONTROL =
  'min-h-[2.75rem] min-w-0 flex-1 bg-transparent px-3 text-(length:--text-base) text-(--color-ink) outline-none tabular-nums'

const CAJA =
  'flex min-w-0 items-center rounded-md border border-(--color-line-strong) bg-(--color-surface) focus-within:shadow-(--shadow-focus) has-aria-invalid:border-(--color-peligro)'

// Un campo de la calculadora con su etiqueta visible y su error debajo (C7, C9). La región del error existe desde el inicio, vacía,
// y es `aria-live`: el lector anuncia el mensaje cuando aparece.
export function CampoDelFormulario({
  nombre,
  etiqueta,
  valor,
  error,
  onCambio,
  prefijo,
  sufijo,
  opciones,
}: Props) {
  const id = useId()
  const idDelError = `${id}-error`
  const comunes = {
    id,
    name: nombre,
    value: valor,
    'aria-invalid': error !== undefined ? true : undefined,
    'aria-describedby': error !== undefined ? idDelError : undefined,
  }

  return (
    <div data-campo={nombre} className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-(length:--text-sm) font-medium text-(--color-ink)">
        {etiqueta}
      </label>
      <div className={CAJA}>
        {prefijo ? <span className="pl-3 text-(--color-ink-soft)">{prefijo}</span> : null}
        {opciones ? (
          <select {...comunes} onChange={(e) => onCambio(e.target.value)} className={CONTROL}>
            <option value="">Elige una opción</option>
            {opciones.map(([opcion, texto]) => (
              <option key={opcion} value={opcion}>
                {texto}
              </option>
            ))}
          </select>
        ) : (
          <input
            {...comunes}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            onChange={(e) => onCambio(e.target.value)}
            className={CONTROL}
          />
        )}
        {sufijo ? <span className="pr-3 text-(--color-ink-soft)">{sufijo}</span> : null}
      </div>
      <p
        id={idDelError}
        aria-live="polite"
        className="flex items-start gap-1.5 text-(length:--text-sm) text-(--color-peligro-ink)"
      >
        {error !== undefined ? (
          <>
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {error}
          </>
        ) : null}
      </p>
    </div>
  )
}
