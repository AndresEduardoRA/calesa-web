import type { Resultado } from '@/shared/lib/errores'

import type { ConfigCalculadora } from '../../../entities/config'
import { CalculadoraPublica } from './calculadora-publica'

// La sección de la calculadora de `/` (semilla §6.2, sección 4): el título y la calculadora. Síncrona y sin `'use client'`: recibe lo
// que leyó `leerConfigCalculadora()` (un objeto plano) y P08 la monta dentro de un `<Suspense>`.
export function SeccionCalculadora({ config }: { config: Resultado<ConfigCalculadora> }) {
  return (
    <section
      id="calculadora"
      aria-labelledby="calculadora-titulo"
      className="mx-auto w-full max-w-6xl px-4 py-16"
    >
      <h2
        id="calculadora-titulo"
        className="mb-8 text-(length:--text-xl) font-semibold text-(--color-ink)"
      >
        ¿Cuánto se te escapa al mes?
      </h2>
      <CalculadoraPublica config={config} />
    </section>
  )
}
