import { Check } from 'lucide-react'

import { cn } from '@/shared/lib/utils'

import { TEXTO_DE_CELDA, type Celda } from '../../../entities/tabla'

// Una celda de la tabla completa (semilla §6.3): el texto tal cual, o el check y el guion con su nombre oculto para el lector.
export function CeldaDeTabla({ celda, numerica }: { celda: Celda; numerica: boolean }) {
  return (
    <td
      className={cn(
        'border-b border-(--color-line) px-4 py-3 align-top text-(length:--text-sm) text-(--color-ink)',
        numerica && 'text-right tabular-nums',
      )}
    >
      {celda.tipo === 'texto' ? celda.texto : null}
      {celda.tipo === 'incluido' ? (
        <>
          <Check aria-hidden className="size-4 text-(--color-positivo)" />
          <span className="sr-only">{TEXTO_DE_CELDA.incluido}</span>
        </>
      ) : null}
      {celda.tipo === 'no_incluido' ? (
        <>
          <span aria-hidden className="text-(--color-ink-faint)">
            —
          </span>
          <span className="sr-only">{TEXTO_DE_CELDA.no_incluido}</span>
        </>
      ) : null}
    </td>
  )
}
