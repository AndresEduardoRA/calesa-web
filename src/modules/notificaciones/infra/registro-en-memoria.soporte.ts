// El registro de correos y el correo falsos de las pruebas (no salen por `index.ts`). El registro en memoria cumple la misma interfaz que
// tendrá el adaptador sobre las RPC (P29).
import { fallo, ok, type Resultado } from '@/shared/lib/errores'
import type { EnvioDeEmail, MensajeDeEmail } from '@/shared/lib/email/tipos'
import type { FilaDeCorreo, NuevaFila, Quien, RegistroDeCorreos } from '../entities/registro'
import type { PuertoDeCorreo } from './correo'

export class RegistroEnMemoria implements RegistroDeCorreos {
  readonly filas = new Map<string, FilaDeCorreo>()
  private contador = 0
  // Para que una prueba haga fallar una operación: `fallar.registrar = true`.
  readonly fallar: Partial<Record<'registrar' | 'porReferencia', boolean>> = {}

  private nuevoId(): string {
    this.contador += 1
    return `00000000-0000-4000-8000-${String(this.contador).padStart(12, '0')}`
  }

  sembrar(nueva: Partial<NuevaFila> & Pick<NuevaFila, 'plantilla' | 'datos'>): FilaDeCorreo {
    const fila: FilaDeCorreo = {
      id: this.nuevoId(),
      para: 'ana@ejemplo.com',
      adjuntoIcs: null,
      estado: 'programado',
      resendId: null,
      programadoPara: null,
      intentos: 0,
      ultimoError: null,
      enviadoEn: null,
      referencia: null,
      reunionId: null,
      solicitudId: null,
      ...nueva,
    }
    this.filas.set(fila.id, fila)
    return fila
  }

  porPlantilla(plantilla: string): FilaDeCorreo[] {
    return [...this.filas.values()].filter((f) => f.plantilla === plantilla)
  }

  private cambiar(id: string, cambios: Partial<FilaDeCorreo>): Resultado<FilaDeCorreo> {
    const fila = this.filas.get(id)
    if (!fila) return fallo('no_encontrado', 'No se encontró el correo.')
    const nueva = { ...fila, ...cambios }
    this.filas.set(id, nueva)
    return ok(nueva)
  }

  porReferencia(referencia: string) {
    if (this.fallar.porReferencia) return Promise.resolve(fallo('inesperado', 'registro caído'))
    const fila = [...this.filas.values()].find((f) => f.referencia === referencia) ?? null
    return Promise.resolve(ok(fila))
  }

  porId(id: string) {
    return Promise.resolve(ok(this.filas.get(id) ?? null))
  }

  registrar(nueva: NuevaFila) {
    if (this.fallar.registrar) return Promise.resolve(fallo('inesperado', 'registro caído'))
    if (nueva.referencia && [...this.filas.values()].some((f) => f.referencia === nueva.referencia))
      return Promise.resolve(fallo('duplicado', 'Ya existe un registro con esos datos.'))
    const fila = { ...nueva, id: this.nuevoId() }
    this.filas.set(fila.id, fila)
    return Promise.resolve(ok(fila))
  }

  marcarEnviado(id: string, d: { resendId: string | null; intentos: number; enviadoEn: string }) {
    return Promise.resolve(this.cambiar(id, { ...d, estado: 'enviado', ultimoError: null }))
  }

  marcarFallido(id: string, d: { intentos: number; ultimoError: string }) {
    return Promise.resolve(this.cambiar(id, { ...d, estado: 'fallido' }))
  }

  marcarCancelado(id: string) {
    return Promise.resolve(this.cambiar(id, { estado: 'cancelado' }))
  }

  marcarReprogramado(id: string, programadoPara: string, resendId?: string | null) {
    return Promise.resolve(
      this.cambiar(id, {
        estado: 'programado',
        programadoPara,
        ultimoError: null,
        ...(resendId === undefined ? {} : { resendId }),
      }),
    )
  }

  programadosDe(quien: Quien, tope: number) {
    const filas = [...this.filas.values()]
      .filter((f) => f.estado === 'programado')
      .filter((f) =>
        'reunionId' in quien
          ? f.reunionId === quien.reunionId
          : f.solicitudId === quien.solicitudId,
      )
    return Promise.resolve(ok(filas.slice(0, tope)))
  }

  vencidos(ahora: string, tope: number) {
    const filas = [...this.filas.values()]
      .filter((f) => f.estado === 'programado' && f.resendId === null)
      .filter((f) => f.programadoPara !== null && Date.parse(f.programadoPara) <= Date.parse(ahora))
      .sort((a, b) => Date.parse(a.programadoPara ?? '') - Date.parse(b.programadoPara ?? ''))
    return Promise.resolve(ok(filas.slice(0, tope)))
  }
}

type Metodo = 'enviar' | 'programar' | 'cancelar' | 'reprogramar'
export type Llamada = { metodo: Metodo; mensaje?: MensajeDeEmail; id?: string; cuando?: string }

// Un correo falso que anota cada llamada y responde lo que diga el guion (en orden); sin guion, responde bien.
export class CorreoFalso implements PuertoDeCorreo {
  readonly llamadas: Llamada[] = []
  readonly guion: Partial<Record<Metodo, Resultado<EnvioDeEmail>[]>> = {}
  private contador = 0

  constructor(private readonly programaSiempre = true) {}

  programa(): boolean {
    return this.programaSiempre
  }

  private responder(
    metodo: Metodo,
    llamada: Omit<Llamada, 'metodo'>,
  ): Promise<Resultado<EnvioDeEmail>> {
    this.llamadas.push({ metodo, ...llamada })
    const siguiente = this.guion[metodo]?.shift()
    if (siguiente) return Promise.resolve(siguiente)
    this.contador += 1
    return Promise.resolve(
      ok({ id: `10000000-0000-4000-8000-${String(this.contador).padStart(12, '0')}` }),
    )
  }

  enviar(mensaje: MensajeDeEmail) {
    return this.responder('enviar', { mensaje })
  }

  programar(mensaje: MensajeDeEmail, cuando: string) {
    return this.responder('programar', { mensaje, cuando })
  }

  cancelar(id: string) {
    return this.responder('cancelar', { id })
  }

  reprogramar(id: string, cuando: string) {
    return this.responder('reprogramar', { id, cuando })
  }

  de(metodo: Metodo): Llamada[] {
    return this.llamadas.filter((l) => l.metodo === metodo)
  }
}
