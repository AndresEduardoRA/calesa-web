// Lo que comparten enviar y programar: las dependencias, armar el correo desde los datos o desde una fila del registro, y cerrar un envío
// (registrarlo, o devolver la fila que ya estaba). `infra/` no consulta Supabase: el registro entra por la interfaz de `entities/registro.ts`.
import { z } from 'zod'

import { fallo, ok, type ErrorApp, type Resultado } from '../../../shared/lib/errores'
import type { MensajeDeEmail } from '../../../shared/lib/email/tipos'
import {
  datosParaGuardar,
  esParaElEquipo,
  esquemaDatos,
  idsDe,
  type DatosDeCorreo,
} from '../entities/datos'
import { referenciaDe } from '../entities/referencia'
import type {
  EstadoDeCorreo,
  FilaDeCorreo,
  NuevaFila,
  RegistroDeCorreos,
} from '../entities/registro'
import { renderizar } from '../entities/render'
import type { PuertoDeCorreo, EntornoDeCorreo } from './correo'

export type Dependencias = {
  registro: RegistroDeCorreos
  correo: PuertoDeCorreo
  entorno: () => EntornoDeCorreo
  reloj: () => Date
  esperar: (ms: number) => Promise<void>
}

export type ResultadoDeEnvio = {
  id: string | null
  estado: EstadoDeCorreo | 'omitido'
  yaEstaba: boolean
}

export type CorreoArmado = {
  datos: DatosDeCorreo
  mensaje: MensajeDeEmail
  referencia: string
  ics: string | null
}

const correoValido = z.email()
export const MENSAJE_NO_REGISTRADO = 'El correo salió pero no quedó registrado.'
const MENSAJE_INVALIDO = 'El correo no se mandó: faltan datos o no son válidos.'

function armar(
  datos: DatosDeCorreo,
  para: string | undefined,
  deps: Dependencias,
): Resultado<CorreoArmado> {
  const entorno = deps.entorno()
  const destino = esParaElEquipo(datos.plantilla) ? entorno.avisos : para
  if (destino === undefined || !correoValido.safeParse(destino).success)
    return fallo('validacion', 'El correo no se mandó: falta un destinatario válido.')
  const dibujado = renderizar(datos, {
    sitio: entorno.sitio,
    ahora: deps.reloj().toISOString(),
    organizador: entorno.organizador,
  })
  const referencia = referenciaDe(datos)
  return ok({
    datos,
    referencia,
    ics: dibujado.ics,
    mensaje: {
      para: destino,
      asunto: dibujado.asunto,
      html: dibujado.html,
      texto: dibujado.texto,
      etiquetas: { plantilla: datos.plantilla },
      referencia,
    },
  })
}

// Lo que pide quien llama: valida los datos (si no, `validacion`) y arma el correo.
export function prepararDesdeDatos(
  entrada: { para?: string; datos: unknown },
  deps: Dependencias,
): Resultado<CorreoArmado> {
  const valido = esquemaDatos.safeParse(entrada.datos)
  if (!valido.success) return fallo('validacion', MENSAJE_INVALIDO)
  return armar(valido.data, entrada.para, deps)
}

// Lo que se vuelve a armar desde el registro (reintento, envío de un vencido): sin el enlace de gestión, que no se guardó.
export function prepararDesdeFila(fila: FilaDeCorreo, deps: Dependencias): Resultado<CorreoArmado> {
  const valido = esquemaDatos.safeParse({ ...fila.datos, plantilla: fila.plantilla })
  if (!valido.success)
    return fallo('validacion', 'Los datos guardados del correo ya no son válidos.')
  return armar(valido.data, fila.para, deps)
}

export const resumen = (fila: FilaDeCorreo, yaEstaba: boolean): ResultadoDeEnvio => ({
  id: fila.id,
  estado: fila.estado,
  yaEstaba,
})

// Cómo terminó el intento con el proveedor.
export type Salida = { ok: true; resendId: string | null } | { ok: false; error: ErrorApp }

type Cierre = { correo: CorreoArmado; salida: Salida; intentos: number; cuando: string | null }

function filaNueva(cierre: Cierre, ahora: string): NuevaFila {
  const { correo, salida, intentos, cuando } = cierre
  const programado = cuando !== null
  const ids = idsDe(correo.datos)
  const [estado, enviadoEn] = ((): [EstadoDeCorreo, string | null] => {
    if (!salida.ok) return ['fallido', null]
    return programado ? ['programado', null] : ['enviado', ahora]
  })()
  return {
    para: Array.isArray(correo.mensaje.para) ? correo.mensaje.para.join(',') : correo.mensaje.para,
    plantilla: correo.datos.plantilla,
    datos: datosParaGuardar(correo.datos),
    adjuntoIcs: correo.ics,
    estado,
    resendId: salida.ok ? salida.resendId : null,
    programadoPara: cuando,
    intentos,
    ultimoError: salida.ok ? null : salida.error.mensaje,
    enviadoEn,
    referencia: correo.referencia,
    ...ids,
  }
}

// Un fallo por proveedor apagado (`regla`) no es un correo perdido: no avisa a nadie.
export const avisaDelFallo = (salida: Salida): boolean =>
  !salida.ok && salida.error.codigo !== 'regla'

async function yaRegistrado(
  deps: Dependencias,
  referencia: string,
): Promise<Resultado<ResultadoDeEnvio>> {
  const previa = await deps.registro.porReferencia(referencia)
  if (!previa.ok) return previa
  return previa.data
    ? ok(resumen(previa.data, true))
    : fallo('conflicto', 'Ese correo ya va en camino.')
}

// Registra lo que pasó con el proveedor. Un `conflicto` (409: esa referencia ya salió o va en curso) no es un fallo: se devuelve la fila
// que ya está. Si el registro falla con el correo ya enviado, el mensaje lo dice.
export async function cerrarSalida(
  deps: Dependencias,
  cierre: Cierre,
  avisarFallo: (fila: FilaDeCorreo) => Promise<void>,
): Promise<Resultado<ResultadoDeEnvio>> {
  const { correo, salida } = cierre
  if (!salida.ok && salida.error.codigo === 'conflicto')
    return yaRegistrado(deps, correo.referencia)
  const registrada = await deps.registro.registrar(filaNueva(cierre, deps.reloj().toISOString()))
  if (!registrada.ok) {
    if (registrada.error.codigo === 'duplicado') return yaRegistrado(deps, correo.referencia)
    return salida.ok ? fallo('inesperado', MENSAJE_NO_REGISTRADO) : registrada
  }
  if (avisaDelFallo(salida)) await avisarFallo(registrada.data)
  return ok(resumen(registrada.data, false))
}

export const resultadoDelKit = (r: Resultado<{ id: string }>): Salida =>
  r.ok ? { ok: true, resendId: r.data.id } : { ok: false, error: r.error }
