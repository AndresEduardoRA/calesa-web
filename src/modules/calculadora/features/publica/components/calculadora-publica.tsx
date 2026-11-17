'use client'

import { useState } from 'react'

import type { Resultado } from '@/shared/lib/errores'

import { enlaceParaAgendar } from '../../../entities/agendar'
import { calcularFugas } from '../../../entities/calculadora'
import { comoSeCalculo } from '../../../entities/como-se-calculo'
import type { ConfigCalculadora } from '../../../entities/config'
import { TIEMPOS_DE_RESPUESTA } from '../../../entities/entradas'
import { ETIQUETAS_DEL_FORMULARIO } from '../../../entities/etiquetas'
import { resumenDeFugas } from '../../../entities/resumen'
import { useEventoDelPrimerResultado } from '../hooks/use-evento-del-primer-resultado'
import {
  entradasDelFormulario,
  type CampoDelFormulario as Campo,
  type ValoresDelFormulario,
} from '../schemas/formulario'
import { CampoDelFormulario } from './campo-del-formulario'
import { DesplegableComoSeCalculo } from './desplegable-como-se-calculo'
import { ResultadoDeFugas, type VistaDelResultado } from './resultado-de-fugas'

const VACIO: ValoresDelFormulario = {
  autos: '',
  margen: '',
  consultas: '',
  respuesta: '',
  administracion: '',
}

const { campos: ETIQUETAS, respuestas: RESPUESTAS } = ETIQUETAS_DEL_FORMULARIO
const OPCIONES = TIEMPOS_DE_RESPUESTA.map((tiempo) => [tiempo, RESPUESTAS[tiempo]] as const)

const NUMERICOS: readonly {
  campo: Exclude<Campo, 'respuesta'>
  prefijo?: string
  sufijo?: string
}[] = [
  { campo: 'autos', sufijo: 'autos' },
  { campo: 'margen', prefijo: 'US$' },
  { campo: 'consultas' },
]

// La calculadora «Lo que se te escapa al mes» (semilla §5.2, B4, B5): 5 datos, sin pedir nada antes, y el resultado en vivo. Todo se
// calcula en el navegador con los datos del panel que leyó el servidor; nada del visitante sale de aquí salvo los dos números del
// enlace a agendar.
export function CalculadoraPublica({ config }: { config: Resultado<ConfigCalculadora> }) {
  const [valores, setValores] = useState<ValoresDelFormulario>(VACIO)
  const formulario = entradasDelFormulario(valores)
  const errores = formulario.estado === 'incompleto' ? formulario.errores : {}

  const vista: VistaDelResultado = !config.ok
    ? { tipo: 'sin_config' }
    : formulario.estado === 'incompleto'
      ? { tipo: 'incompleto', conErrores: Object.keys(formulario.errores).length > 0 }
      : {
          tipo: 'listo',
          resumen: resumenDeFugas(calcularFugas(formulario.entradas, config.data)),
          enlace: enlaceParaAgendar(formulario.entradas),
        }
  useEventoDelPrimerResultado(vista.tipo === 'listo')

  const cambiar = (campo: Campo) => (valor: string) =>
    setValores((anteriores) => ({ ...anteriores, [campo]: valor }))

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 md:grid-cols-2">
      <form noValidate onSubmit={(e) => e.preventDefault()} className="flex min-w-0 flex-col gap-4">
        {NUMERICOS.map(({ campo, prefijo, sufijo }) => (
          <CampoDelFormulario
            key={campo}
            nombre={campo}
            etiqueta={ETIQUETAS[campo]}
            valor={valores[campo]}
            error={errores[campo]}
            onCambio={cambiar(campo)}
            {...(prefijo ? { prefijo } : {})}
            {...(sufijo ? { sufijo } : {})}
          />
        ))}
        <CampoDelFormulario
          nombre="respuesta"
          etiqueta={ETIQUETAS.respuesta}
          valor={valores.respuesta}
          error={errores.respuesta}
          onCambio={cambiar('respuesta')}
          opciones={OPCIONES}
        />
        <CampoDelFormulario
          nombre="administracion"
          etiqueta={ETIQUETAS.administracion}
          valor={valores.administracion}
          error={errores.administracion}
          onCambio={cambiar('administracion')}
          sufijo="personas"
        />
      </form>
      <div className="flex min-w-0 flex-col gap-6">
        <ResultadoDeFugas vista={vista} />
        {config.ok ? <DesplegableComoSeCalculo como={comoSeCalculo(config.data)} /> : null}
      </div>
    </div>
  )
}
