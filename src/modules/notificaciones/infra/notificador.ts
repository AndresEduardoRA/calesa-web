// El notificador: todo lo que el resto de la app hace con los correos de Calesa (enviar, programar, cancelar, reprogramar, reintentar,
// despachar los vencidos). Recibe el registro por la interfaz de `entities/registro.ts`; lo demás tiene valores por defecto (el kit de
// correo y el entorno) que las pruebas reemplazan.
import { fallo, ok, type Resultado } from '../../../shared/lib/errores'
import type { RegistroDeCorreos } from '../entities/registro'
import { correoDelKit, entornoDeCorreo, type EntornoDeCorreo, type PuertoDeCorreo } from './correo'
import { crearCancelaciones } from './cancelar'
import { crearEnvios } from './enviar'
import { resumen, type ResultadoDeEnvio } from './nucleo'
import { crearProgramaciones } from './programar'

export type OpcionesDelNotificador = {
  registro: RegistroDeCorreos
  correo?: PuertoDeCorreo
  entorno?: () => EntornoDeCorreo
  reloj?: () => Date
  esperar?: (ms: number) => Promise<void>
}

const esperarDeVerdad = (ms: number) => new Promise<void>((listo) => setTimeout(listo, ms))

export function crearNotificador(opciones: OpcionesDelNotificador) {
  const deps = {
    registro: opciones.registro,
    correo: opciones.correo ?? correoDelKit,
    entorno: opciones.entorno ?? entornoDeCorreo,
    reloj: opciones.reloj ?? (() => new Date()),
    esperar: opciones.esperar ?? esperarDeVerdad,
  }
  const envios = crearEnvios(deps)
  const programaciones = crearProgramaciones(deps, envios.avisarFallo)
  const cancelaciones = crearCancelaciones(deps)

  // Sólo un `fallido`. Si todavía le falta tiempo para su hora, vuelve a programarse; si no, sale ahora.
  async function reintentar(id: string): Promise<Resultado<ResultadoDeEnvio>> {
    const fila = await deps.registro.porId(id)
    if (!fila.ok) return fila
    if (!fila.data) return fallo('no_encontrado', 'No hay un correo con ese id.')
    if (fila.data.estado !== 'fallido')
      return fallo('regla', 'Sólo se reintenta un correo fallido.')
    const { programadoPara } = fila.data
    const futuro = programadoPara !== null && Date.parse(programadoPara) > deps.reloj().getTime()
    const marcada = futuro
      ? await programaciones.volverAProgramar(fila.data, programadoPara)
      : await envios.reenviar(fila.data)
    return marcada.ok ? ok(resumen(marcada.data, false)) : marcada
  }

  return {
    enviarAhora: envios.enviarAhora,
    despacharVencidos: envios.despacharVencidos,
    programar: programaciones.programar,
    cancelar: cancelaciones.cancelar,
    cancelarDeReunion: cancelaciones.cancelarDeReunion,
    cancelarDeSolicitud: cancelaciones.cancelarDeSolicitud,
    reprogramar: programaciones.reprogramar,
    reintentar,
  }
}

export type Notificador = ReturnType<typeof crearNotificador>
