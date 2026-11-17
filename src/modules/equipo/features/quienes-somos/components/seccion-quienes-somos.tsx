import Image from 'next/image'

import type { Resultado } from '@/shared/lib/errores'

import type { MiembroDelEquipo } from '../../../entities/miembro'

// «Quiénes somos» (semilla §6.2, sección 8): las filas visibles del equipo, por orden. Pura y síncrona: recibe lo que leyó
// `leerEquipoVisible()`. Si no hay filas, o la lectura falló, no dibuja nada: la sección se oculta (UX `/`).
export function SeccionQuienesSomos({
  equipo,
}: {
  equipo: Resultado<readonly MiembroDelEquipo[]>
}) {
  if (!equipo.ok || equipo.data.length === 0) return null

  return (
    <section aria-labelledby="quienes-somos-titulo" className="mx-auto w-full max-w-6xl px-4 py-16">
      <h2
        id="quienes-somos-titulo"
        className="text-(length:--text-xl) font-semibold text-(--color-ink)"
      >
        Quiénes somos
      </h2>
      <ul className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-2 lg:grid-cols-3">
        {equipo.data.map((miembro) => (
          <li
            key={miembro.id}
            className="flex min-w-0 flex-col gap-3 rounded-(--radius-card) border border-(--color-line) bg-(--color-surface) p-6"
          >
            {miembro.fotoUrl ? (
              // R5.1: la foto ya llega reducida (WebP, 800 px); `unoptimized` no gasta la optimización de Vercel.
              <Image
                src={miembro.fotoUrl}
                alt={miembro.nombre}
                width={160}
                height={160}
                unoptimized
                className="size-40 rounded-(--radius-card) object-cover"
              />
            ) : null}
            <h3 className="text-(length:--text-lg) font-semibold text-(--color-ink)">
              {miembro.nombre}
            </h3>
            <p className="text-(length:--text-sm) text-(--color-ink-soft)">{miembro.cargo}</p>
            {miembro.frase !== null ? (
              <p className="text-(length:--text-base) text-(--color-ink)">«{miembro.frase}»</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
