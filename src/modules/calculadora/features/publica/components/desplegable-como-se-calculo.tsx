import type { ComoSeCalculo } from '../../../entities/como-se-calculo'

// «Cómo se calculó» (C13, B4): cerrado de entrada; adentro, la frase de entrada, una frase por fuga y los datos del panel usados.
export function DesplegableComoSeCalculo({ como }: { como: ComoSeCalculo }) {
  return (
    <details className="rounded-(--radius-card) border border-(--color-line) bg-(--color-surface) p-4">
      <summary className="min-h-[2.75rem] cursor-pointer content-center font-medium text-(--color-ink)">
        Cómo se calculó
      </summary>
      <div className="mt-3 flex flex-col gap-3 text-(length:--text-sm) text-(--color-ink)">
        <p>{como.entrada}</p>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          {como.frases.map((frase) => (
            <li key={frase.fila}>{frase.texto}</li>
          ))}
        </ul>
        <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1">
          {como.datos.map((dato) => (
            <div key={dato.etiqueta} className="contents">
              <dt className="text-(--color-ink-soft)">{dato.etiqueta}</dt>
              <dd className="text-right tabular-nums">{dato.valor}</dd>
            </div>
          ))}
        </dl>
      </div>
    </details>
  )
}
