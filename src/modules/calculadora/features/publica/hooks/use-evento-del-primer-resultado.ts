import { useEffect, useRef } from 'react'

// La primera vez que la calculadora da un resultado en esta carga, avisa `calesa:evento` con `calculadora_usada` (semilla §9.6). El
// oyente que lo registra es de P17. Sale una sola vez aunque cambien los datos, y no lleva nada del visitante (X7).
export function useEventoDelPrimerResultado(listo: boolean) {
  const yaSalio = useRef(false)
  useEffect(() => {
    if (!listo || yaSalio.current) return
    yaSalio.current = true
    window.dispatchEvent(
      new CustomEvent('calesa:evento', { detail: { tipo: 'calculadora_usada' } }),
    )
  }, [listo])
}
