import { ROTULO_DE_PRUEBA, TEXTO_DE_PRUEBA } from '../../../entities/prueba'

// El bloque de prueba de `/` (semilla §6.2, A2): el rótulo en el estilo etiqueta (las mayúsculas las pone el CSS) y el texto exacto
// de A0.2. Sin logo ni nombre del cliente.
export function BloqueDePrueba() {
  return (
    <section aria-label={ROTULO_DE_PRUEBA} className="mx-auto w-full max-w-6xl px-4 py-12">
      <div className="flex flex-col gap-3 rounded-(--radius-card) border border-(--color-line) bg-(--color-surface) p-6">
        <p className="font-mono text-(length:--text-xs) leading-[1.3] font-medium tracking-[0.06em] text-(--color-ink-soft) uppercase">
          {ROTULO_DE_PRUEBA}
        </p>
        <p className="text-(length:--text-lg) text-(--color-ink)">{TEXTO_DE_PRUEBA}</p>
      </div>
    </section>
  )
}
