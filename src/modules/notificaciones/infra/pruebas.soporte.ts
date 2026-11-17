// Lo que arman las pruebas de `infra/`: un notificador con registro y correo falsos y el reloj fijo (no sale por `index.ts`).
import { crearNotificador } from './notificador'
import { CorreoFalso, RegistroEnMemoria } from './registro-en-memoria.soporte'

// El reloj fijo de las pruebas: lun 2 nov 2026, 08:00 en La Paz.
export const AHORA = '2026-11-02T12:00:00.000Z'

export function armarPrueba(opciones: { programa?: boolean } = {}) {
  const registro = new RegistroEnMemoria()
  const correo = new CorreoFalso(opciones.programa ?? true)
  const esperas: number[] = []
  const notificador = crearNotificador({
    registro,
    correo,
    entorno: () => ({
      sitio: 'https://calesa.app',
      organizador: { email: 'hola@getcalesa.com', nombre: 'Calesa' },
      avisos: 'equipo@getcalesa.com',
    }),
    reloj: () => new Date(AHORA),
    esperar: (ms) => {
      esperas.push(ms)
      return Promise.resolve()
    },
  })
  return { registro, correo, esperas, notificador }
}
