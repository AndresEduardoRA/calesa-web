// El selector Mensual / Anual de las tarjetas (semilla §5.4, B6). Radios nativos: las flechas funcionan solas y el foco se ve. Cada
// opción mide 44 px de alto como mínimo, en px como pide `.claude/rules/ui.md` (crece con el texto).

export type FormaDePago = 'mensual' | 'anual'

const OPCIONES: readonly [FormaDePago, string][] = [
  ['mensual', 'Mensual'],
  ['anual', 'Anual'],
]

export function SelectorDePago({
  valor,
  onCambio,
}: {
  valor: FormaDePago
  onCambio: (valor: FormaDePago) => void
}) {
  return (
    <fieldset className="inline-flex flex-wrap gap-1 rounded-(--radius-pill) border border-(--color-line) bg-(--color-surface) p-1">
      <legend className="sr-only">Forma de pago</legend>
      {OPCIONES.map(([opcion, texto]) => (
        <label
          key={opcion}
          className="relative inline-flex min-h-[44px] cursor-pointer items-center rounded-(--radius-pill) px-5 text-(length:--text-sm) font-medium text-(--color-ink) transition has-checked:bg-(--color-primario) has-checked:text-(--color-sobre-primario) has-focus-visible:shadow-(--shadow-focus)"
        >
          <input
            type="radio"
            name="forma-de-pago"
            value={opcion}
            checked={valor === opcion}
            onChange={() => onCambio(opcion)}
            className="sr-only"
          />
          {texto}
        </label>
      ))}
    </fieldset>
  )
}
