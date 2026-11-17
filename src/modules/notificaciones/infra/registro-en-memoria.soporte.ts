// El registro de correos y el correo falsos de las pruebas (no salen por `index.ts`). El registro en memoria cumple la misma interfaz que
// tiene el adaptador sobre las RPC (`registroDeSupabase`, P29), y sigue a P27: la tabla de transiciones, el orden y los textos.
import { fallo, ok, type Resultado } from '@/shared/lib/errores'
import type { EnvioDeEmail, MensajeDeEmail } from '@/shared/lib/email/tipos'
import type {
  EstadoDeCorreo,
  FilaDeCorreo,
  NuevaFila,
  Quien,
  RegistroDeCorreos,
} from '../entities/registro'
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

  // La tabla de transiciones de P27 (`_tomar_correo`): desde `programado` o `fallido` caben las cuatro marcas; `enviado` es terminal;
  // `cancelado` sólo vuelve a cancelarse, sin cambios.
  private cambiar(
    id: string,
    destino: EstadoDeCorreo,
    cambios: Partial<FilaDeCorreo>,
  ): Resultado<FilaDeCorreo> {
    const fila = this.filas.get(id)
    if (!fila) return fallo('no_encontrado', 'No se encontró el correo.')
    if (fila.estado === 'cancelado' && destino === 'cancelado') return ok(fila)
    if (fila.estado === 'enviado' || fila.estado === 'cancelado')
      return fallo('regla', `Un correo ${fila.estado} no pasa a ${destino}.`)
    const nueva = { ...fila, ...cambios, estado: destino }
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
    if (nueva.estado === 'cancelado')
      return Promise.resolve(fallo('regla', 'Un dato del correo no es válido.'))
    if (nueva.referencia && [...this.filas.values()].some((f) => f.referencia === nueva.referencia))
      return Promise.resolve(fallo('duplicado', 'Ya existe un correo con esa referencia.'))
    const fila = { ...nueva, id: this.nuevoId() }
    this.filas.set(fila.id, fila)
    return Promise.resolve(ok(fila))
  }

  marcarEnviado(id: string, d: { resendId: string | null; intentos: number; enviadoEn: string }) {
    return Promise.resolve(this.cambiar(id, 'enviado', { ...d, ultimoError: null }))
  }

  marcarFallido(id: string, d: { intentos: number; ultimoError: string }) {
    return Promise.resolve(this.cambiar(id, 'fallido', d))
  }

  marcarCancelado(id: string) {
    return Promise.resolve(this.cambiar(id, 'cancelado', {}))
  }

  marcarReprogramado(id: string, programadoPara: string, resendId?: string | null) {
    return Promise.resolve(
      this.cambiar(id, 'programado', {
        programadoPara,
        ultimoError: null,
        ...(resendId === undefined ? {} : { resendId }),
      }),
    )
  }

  // Como las RPC: por hora y, a igual hora, por id (lo que no tiene hora, al final); y se corta después de ordenar.
  private ordenadas(filas: FilaDeCorreo[], tope: number): FilaDeCorreo[] {
    const hora = (f: FilaDeCorreo) =>
      f.programadoPara === null ? Infinity : Date.parse(f.programadoPara)
    return filas.sort((a, b) => hora(a) - hora(b) || a.id.localeCompare(b.id)).slice(0, tope)
  }

  programadosDe(quien: Quien, tope: number) {
    const filas = [...this.filas.values()]
      .filter((f) => f.estado === 'programado')
      .filter((f) =>
        'reunionId' in quien
          ? f.reunionId === quien.reunionId
          : f.solicitudId === quien.solicitudId,
      )
    return Promise.resolve(ok(this.ordenadas(filas, tope)))
  }

  vencidos(ahora: string, tope: number) {
    const filas = [...this.filas.values()]
      .filter((f) => f.estado === 'programado' && f.resendId === null)
      .filter((f) => f.programadoPara !== null && Date.parse(f.programadoPara) <= Date.parse(ahora))
    return Promise.resolve(ok(this.ordenadas(filas, tope)))
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
