'use client'

import { useState } from 'react'

import { tarjetasDePlanes } from '../../../entities/tarjetas'
import { SelectorDePago, type FormaDePago } from './selector-de-pago'
import { TarjetaDePlan } from './tarjeta-de-plan'

// Las 4 tarjetas de planes con el selector Mensual / Anual (semilla §5.4, §6.2 sección 6 y §6.3). El selector vive en el estado del
// componente, no en la URL: no filtra registros, y así el HTML prerenderizado sale entero, en «Mensual».
export function TarjetasConSelector() {
  const [pago, setPago] = useState<FormaDePago>('mensual')
  const tarjetas = tarjetasDePlanes()

  return (
    <div className="flex flex-col gap-6">
      <SelectorDePago valor={pago} onCambio={setPago} />
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-2 xl:grid-cols-4">
        {tarjetas.map((tarjeta) => (
          <TarjetaDePlan key={tarjeta.id} tarjeta={tarjeta} pago={pago} />
        ))}
      </ul>
    </div>
  )
}
