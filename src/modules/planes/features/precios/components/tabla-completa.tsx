import { Fragment } from 'react'

import { cn } from '@/shared/lib/utils'

import { PIE_DE_TABLA, tablaDePlanes } from '../../../entities/tabla'
import { CeldaDeTabla } from './celda-de-tabla'

// La sección de Montos lleva cifras: a la derecha y con `tabular-nums`.
const SECCION_NUMERICA = 'Montos'

// La primera columna, fija al desplazar en celular; la sombra avisa que hay más a la derecha.
const PRIMERA_COLUMNA =
  'sticky left-0 z-10 bg-(--color-surface) shadow-[6px_0_6px_-6px_var(--color-line-strong)] md:static md:shadow-none'

// La tabla completa de `/planes` (semilla §6.3), sin la regla de exceso de autos (X11). Desde `md` el encabezado queda pegado arriba
// al bajar (la tabla no tiene overflow propio, así que `sticky` funciona contra la página); debajo de `md` la tabla se desplaza sola
// a lo ancho, con la primera columna fija, y la página no se ensancha.
export function TablaCompleta() {
  const { planes, secciones } = tablaDePlanes()

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto md:overflow-visible">
        <table className="w-max min-w-full border-separate border-spacing-0 text-left">
          <caption className="sr-only">Planes y precios: tabla completa</caption>
          <thead>
            <tr>
              <td className={cn(PRIMERA_COLUMNA, 'md:sticky md:top-0 md:z-20')} />
              {planes.map((plan) => (
                <th
                  key={plan.id}
                  scope="col"
                  className={cn(
                    'border-b-2 bg-(--color-surface) px-4 py-3 text-(length:--text-base) font-semibold text-(--color-ink) md:sticky md:top-0 md:z-20',
                    plan.recomendado ? 'border-(--color-marca)' : 'border-(--color-line)',
                  )}
                >
                  {plan.nombre}
                  {plan.recomendado ? <span className="sr-only"> (recomendado)</span> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {secciones.map((seccion) => (
              <Fragment key={seccion.titulo}>
                <tr>
                  <th
                    scope="colgroup"
                    colSpan={planes.length + 1}
                    className="bg-(--color-paper-dim) px-4 py-2 text-(length:--text-sm) font-semibold text-(--color-ink)"
                  >
                    {seccion.titulo}
                  </th>
                </tr>
                {seccion.filas.map((fila) => (
                  <tr key={fila.etiqueta}>
                    <th
                      scope="row"
                      className={cn(
                        PRIMERA_COLUMNA,
                        'border-b border-(--color-line) px-4 py-3 align-top text-(length:--text-sm) font-medium text-(--color-ink)',
                      )}
                    >
                      {fila.etiqueta}
                    </th>
                    {fila.celdas.map((celda, i) => (
                      <CeldaDeTabla
                        key={planes[i]?.id ?? i}
                        celda={celda}
                        numerica={seccion.titulo === SECCION_NUMERICA}
                      />
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-1 text-(length:--text-sm) text-(--color-ink-soft)">
        {PIE_DE_TABLA.map((texto) => (
          <p key={texto} data-pie>
            {texto}
          </p>
        ))}
      </div>
    </div>
  )
}
