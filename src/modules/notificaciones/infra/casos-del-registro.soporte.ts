// La tabla de casos de `RegistroDeCorreos`: la corren el registro en memoria y el adaptador sobre las RPC (con un cliente falso que por detrás
// usa la memoria), como la de `ContarEnvio` en `seguridad/`. `supabase/tests/correos-*.sql` es su copia en la base. Cada caso arma su estado
// sólo por la interfaz (nunca `sembrar`) y devuelve lo que se compara con `esperado`. Toda hora va en la forma de `toISOString()`.
import { fallo, ok, type Resultado } from '@/shared/lib/errores'
import type { FilaDeCorreo, NuevaFila, RegistroDeCorreos } from '../entities/registro'

export type CasoDelRegistro = {
  nombre: string
  correr: (registro: RegistroDeCorreos) => Promise<unknown>
  esperado: unknown
  // La línea que el adaptador deja en el registro del servidor (el registro en memoria no escribe ninguna).
  registra?: string
}

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const REUNION_A = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b'
const REUNION_B = '0c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f'
const SOLICITUD = '7a9d0e2c-1b3f-4c5d-8e6a-0f1b2c3d4e5f'
const H = (hhmm: string) => `2026-11-05T${hhmm}:00.000Z`

const comun: NuevaFila = {
  para: 'ana@ejemplo.com',
  plantilla: 'recordatorio-24h',
  datos: { a: 1 },
  adjuntoIcs: null,
  estado: 'programado',
  resendId: null,
  programadoPara: H('14:00'),
  intentos: 0,
  ultimoError: null,
  enviadoEn: null,
  referencia: null,
  reunionId: null,
  solicitudId: null,
}
const programado = (p: Partial<NuevaFila> = {}): NuevaFila => ({ ...comun, ...p })
const enviado = (p: Partial<NuevaFila> = {}): NuevaFila => ({
  ...comun,
  estado: 'enviado',
  programadoPara: null,
  enviadoEn: H('12:00'),
  intentos: 1,
  resendId: 're_1',
  ...p,
})
const fallido = (p: Partial<NuevaFila> = {}): NuevaFila => ({
  ...comun,
  estado: 'fallido',
  intentos: 3,
  ultimoError: 'sin red',
  resendId: 're_1',
  ...p,
})

const conId = (n: number, nueva: NuevaFila): FilaDeCorreo => ({ id: ID(n), ...nueva })
const idsDe = (r: Resultado<FilaDeCorreo[]>) => (r.ok ? r.data.map((f) => f.id) : r)
const MARCAS = {
  enviado: (r: RegistroDeCorreos, id: string) =>
    r.marcarEnviado(id, { resendId: 're_9', intentos: 2, enviadoEn: H('13:00') }),
  fallido: (r: RegistroDeCorreos, id: string) =>
    r.marcarFallido(id, { intentos: 2, ultimoError: 'otra vez' }),
  cancelado: (r: RegistroDeCorreos, id: string) => r.marcarCancelado(id),
  programado: (r: RegistroDeCorreos, id: string) => r.marcarReprogramado(id, H('18:00')),
} as const
const prohibido = (estado: string, destino: keyof typeof MARCAS) =>
  fallo('regla', `Un correo ${estado} no pasa a ${destino}.`)

async function reprogramaciones(r: RegistroDeCorreos) {
  await r.registrar(fallido({ referencia: 'f:1' }))
  const sin = await r.marcarReprogramado(ID(1), H('18:00'))
  const limpia = await r.marcarReprogramado(ID(1), H('19:00'), null)
  const pone = await r.marcarReprogramado(ID(1), H('20:00'), 're_2')
  return [sin, limpia, pone].map((x) =>
    x.ok
      ? {
          estado: x.data.estado,
          hora: x.data.programadoPara,
          resendId: x.data.resendId,
          intentos: x.data.intentos,
          error: x.data.ultimoError,
        }
      : x,
  )
}

export const CASOS_DEL_REGISTRO: readonly CasoDelRegistro[] = [
  {
    nombre:
      'registrar un enviado devuelve la fila con id, y porId y porReferencia la devuelven igual',
    correr: async (r) => ({
      registrada: await r.registrar(enviado({ referencia: 'a:1' })),
      porId: await r.porId(ID(1)),
      porReferencia: await r.porReferencia('a:1'),
    }),
    esperado: (() => {
      const fila = conId(1, enviado({ referencia: 'a:1' }))
      return { registrada: ok(fila), porId: ok(fila), porReferencia: ok(fila) }
    })(),
  },
  {
    nombre: 'una referencia repetida da `duplicado`; dos filas sin referencia conviven',
    correr: async (r) => {
      await r.registrar(programado({ referencia: 'a:1' }))
      const repetida = await r.registrar(programado({ referencia: 'a:1' }))
      const una = await r.registrar(programado())
      const otra = await r.registrar(programado())
      return { repetida, convive: una.ok && otra.ok }
    },
    esperado: {
      repetida: fallo('duplicado', 'Ya existe un correo con esa referencia.'),
      convive: true,
    },
  },
  {
    nombre: 'porId y porReferencia de lo que no está dan ok(null)',
    correr: async (r) => [await r.porId(ID(7)), await r.porReferencia('no:esta')],
    esperado: [ok(null), ok(null)],
  },
  {
    nombre: 'marcarEnviado limpia el error, conserva la hora y pisa el resendId (también con null)',
    correr: async (r) => {
      await r.registrar(fallido({ programadoPara: H('14:00') }))
      await r.registrar(programado({ resendId: 're_1' }))
      return [
        await r.marcarEnviado(ID(1), { resendId: null, intentos: 4, enviadoEn: H('15:00') }),
        await r.marcarEnviado(ID(2), { resendId: 're_2', intentos: 1, enviadoEn: H('15:00') }),
      ]
    },
    esperado: [
      ok(
        conId(
          1,
          fallido({
            estado: 'enviado',
            resendId: null,
            intentos: 4,
            ultimoError: null,
            enviadoEn: H('15:00'),
            programadoPara: H('14:00'),
          }),
        ),
      ),
      ok(
        conId(
          2,
          programado({ estado: 'enviado', resendId: 're_2', intentos: 1, enviadoEn: H('15:00') }),
        ),
      ),
    ],
  },
  {
    nombre: 'marcarFallido conserva el resendId y la hora programada',
    correr: (r) =>
      r
        .registrar(programado({ resendId: 're_1' }))
        .then(() => r.marcarFallido(ID(1), { intentos: 3, ultimoError: 'sin red' })),
    esperado: ok(
      conId(
        1,
        programado({ estado: 'fallido', resendId: 're_1', intentos: 3, ultimoError: 'sin red' }),
      ),
    ),
  },
  {
    nombre: 'marcarCancelado dos veces: la segunda devuelve la misma fila',
    correr: async (r) => {
      await r.registrar(programado())
      return [await r.marcarCancelado(ID(1)), await r.marcarCancelado(ID(1))]
    },
    esperado: (() => {
      const fila = ok(conId(1, programado({ estado: 'cancelado' })))
      return [fila, fila]
    })(),
  },
  {
    nombre: 'sobre un enviado, las cuatro marcas dan `regla`',
    correr: async (r) => {
      await r.registrar(enviado())
      return Promise.all(Object.values(MARCAS).map((marca) => marca(r, ID(1))))
    },
    esperado: (['enviado', 'fallido', 'cancelado', 'programado'] as const).map((d) =>
      prohibido('enviado', d),
    ),
  },
  {
    nombre: 'sobre un cancelado, marcarEnviado, marcarFallido y marcarReprogramado dan `regla`',
    correr: async (r) => {
      await r.registrar(programado())
      await r.marcarCancelado(ID(1))
      return [
        await MARCAS.enviado(r, ID(1)),
        await MARCAS.fallido(r, ID(1)),
        await MARCAS.programado(r, ID(1)),
      ]
    },
    esperado: (['enviado', 'fallido', 'programado'] as const).map((d) => prohibido('cancelado', d)),
  },
  {
    nombre: 'las cuatro marcas sobre un id que no está (o que no es guid) dan `no_encontrado`',
    correr: async (r) => {
      const ids = [ID(99), 'no-es-guid']
      return Promise.all(ids.flatMap((id) => Object.values(MARCAS).map((marca) => marca(r, id))))
    },
    esperado: Array.from({ length: 8 }, () => fallo('no_encontrado', 'No se encontró el correo.')),
  },
  {
    nombre:
      'marcarReprogramado: sin tercer argumento conserva el resendId, con null lo limpia y con un id lo pone',
    correr: reprogramaciones,
    esperado: [
      { estado: 'programado', hora: H('18:00'), resendId: 're_1', intentos: 3, error: null },
      { estado: 'programado', hora: H('19:00'), resendId: null, intentos: 3, error: null },
      { estado: 'programado', hora: H('20:00'), resendId: 're_2', intentos: 3, error: null },
    ],
  },
  {
    nombre:
      'programadosDe trae sólo los programados de esa reunión, por hora e id, y corta después de ordenar',
    correr: async (r) => {
      await r.registrar(programado({ reunionId: REUNION_A, programadoPara: H('10:00') }))
      await r.registrar(programado({ reunionId: REUNION_A, programadoPara: H('09:00') }))
      await r.registrar(programado({ reunionId: REUNION_A, programadoPara: H('09:00') }))
      await r.registrar(enviado({ reunionId: REUNION_A }))
      await r.registrar(fallido({ reunionId: REUNION_A }))
      await r.registrar(programado({ reunionId: REUNION_B }))
      await r.registrar(programado({ solicitudId: SOLICITUD }))
      return {
        todos: idsDe(await r.programadosDe({ reunionId: REUNION_A }, 10)),
        cortado: idsDe(await r.programadosDe({ reunionId: REUNION_A }, 2)),
        deSolicitud: idsDe(await r.programadosDe({ solicitudId: SOLICITUD }, 10)),
      }
    },
    esperado: { todos: [ID(2), ID(3), ID(1)], cortado: [ID(2), ID(3)], deSolicitud: [ID(7)] },
  },
  {
    nombre:
      'vencidos trae los programados sin resendId con hora ≤ ahora (incluida la exacta), por hora e id, y corta',
    correr: async (r) => {
      await r.registrar(programado({ programadoPara: H('08:00') }))
      await r.registrar(programado({ programadoPara: H('08:00') }))
      await r.registrar(programado({ programadoPara: H('09:00') }))
      await r.registrar(programado({ programadoPara: H('08:00'), resendId: 're_1' }))
      await r.registrar(programado({ programadoPara: H('10:00') }))
      await r.registrar(fallido({ programadoPara: H('08:00') }))
      return {
        todos: idsDe(await r.vencidos(H('09:00'), 10)),
        cortado: idsDe(await r.vencidos(H('09:00'), 2)),
      }
    },
    esperado: { todos: [ID(1), ID(2), ID(3)], cortado: [ID(1), ID(2)] },
  },
  {
    nombre: 'registrar un cancelado da `regla`',
    correr: (r) => r.registrar({ ...programado(), estado: 'cancelado' }),
    esperado: fallo('regla', 'Un dato del correo no es válido.'),
    registra: 'notificaciones: registrar_correo 22023 hint=p_estado',
  },
]
