import type { ResumenDeFugas } from '../../../entities/resumen'

// El desglose del resultado (C10b): una fila por fuga con su mínimo y su máximo, ya formateados en `resumen.ts` (X3).
export function DesgloseDeFugas({ filas }: { filas: ResumenDeFugas['filas'] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-left text-(length:--text-sm)">
        <caption className="sr-only">Desglose por fuga</caption>
        <thead>
          <tr>
            <th scope="col" className="border-b border-(--color-line) py-2 pr-3 font-medium">
              Fuga
            </th>
            <th
              scope="col"
              className="border-b border-(--color-line) py-2 pr-3 text-right font-medium"
            >
              Mínimo
            </th>
            <th scope="col" className="border-b border-(--color-line) py-2 text-right font-medium">
              Máximo
            </th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={fila.fila}>
              <th scope="row" className="border-b border-(--color-line) py-2 pr-3 font-normal">
                {fila.etiqueta}
              </th>
              <td className="border-b border-(--color-line) py-2 pr-3 text-right tabular-nums">
                {fila.minimo}
              </td>
              <td className="border-b border-(--color-line) py-2 text-right tabular-nums">
                {fila.maximo}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
