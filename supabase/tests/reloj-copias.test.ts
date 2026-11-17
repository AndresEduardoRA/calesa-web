// Las funciones que P38 pasó a `public._ahora()` son copias fieles de su definición anterior (paso P38, C3): la misma sentencia con
// `now()` → `(select public._ahora())` y `create function` → `create or replace function`, nada más. Así una copia no pierde, sin que
// nadie lo note, su `security definer`, su `set search_path` ni una línea que le sumó un paso anterior. Se compara contra la definición
// de la misma firma anterior a la migración de P38 (no contra la última): un paso futuro que la redefina no rompe esta guarda.
import { describe, expect, it } from 'vitest'

import { definicionesEn, migracionesEnOrden } from '../../scripts/lib/definicion-sql'

// Función, migración de P38 que la copia (`<fecha>_calesa_reloj_<parte>.sql`) y su firma (para las sobrecargas).
const COPIAS: { nombre: string; parte: string; firma?: string }[] = [
  { nombre: '_hora_ofrecible', parte: 'agenda' },
  { nombre: 'reservar_reunion', parte: 'agenda' },
  { nombre: 'datos_para_horas', parte: 'agenda' },
  { nombre: '_reunion_del_token', parte: 'agenda' },
  { nombre: 'contar_envio', parte: 'agenda' },
  { nombre: '_elegir_asignado', parte: 'solicitudes' },
  { nombre: '_juntar_solicitud', parte: 'solicitudes' },
  { nombre: 'crear_o_juntar_solicitud', parte: 'solicitudes' },
  { nombre: 'elegir_whatsapp', parte: 'solicitudes' },
  { nombre: '_proteger_solicitudes', parte: 'panel' },
  { nombre: '_validar_estado_solicitud', parte: 'panel' },
  { nombre: '_efecto_en_reunion', parte: 'panel' },
  { nombre: 'actualizar_meet', parte: 'panel' },
  {
    nombre: '_repartir_reuniones',
    parte: 'panel',
    firma: 'p_perfil uuid, p_respaldo uuid, p_pausa boolean',
  },
  { nombre: 'aceptar_invitacion', parte: 'panel' },
  { nombre: 'retencion_diaria', parte: 'tareas' },
  { nombre: '_metricas_solicitud', parte: 'tareas' },
]

// Los argumentos de una definición, con los espacios normalizados (distingue las sobrecargas).
function firma(definicion: string): string {
  const abre = definicion.indexOf('(')
  let nivel = 0
  for (let i = abre; i < definicion.length; i++) {
    if (definicion[i] === '(') nivel++
    else if (definicion[i] === ')' && --nivel === 0) {
      return definicion
        .slice(abre + 1, i)
        .replace(/\s+/g, ' ')
        .trim()
    }
  }
  return ''
}

function copiaEsperada(anterior: string): string {
  return anterior
    .replace(/^create\s+function/i, 'create or replace function')
    .replaceAll('now()', '(select public._ahora())')
}

const migraciones = migracionesEnOrden()

describe('reloj de pruebas: copias fieles', () => {
  it.each(COPIAS)('$nombre ($parte)', ({ nombre, parte, firma: suya }) => {
    const i = migraciones.findIndex(({ archivo }) => archivo.endsWith(`_calesa_reloj_${parte}.sql`))
    expect(i, `falta la migración _calesa_reloj_${parte}.sql`).toBeGreaterThan(-1)
    const deLaFirma = (texto: string) =>
      definicionesEn(texto, nombre).filter((d) => suya === undefined || firma(d) === suya)
    const copias = deLaFirma(migraciones[i]?.texto ?? '')
    expect(copias, `${nombre} no está en _calesa_reloj_${parte}.sql`).toHaveLength(1)
    const anterior = migraciones
      .slice(0, i)
      .flatMap(({ texto }) => deLaFirma(texto))
      .at(-1)
    expect(anterior, `${nombre} no tiene definición anterior`).toBeDefined()
    expect(anterior).toContain('now()')
    expect(copias[0]).toBe(copiaEsperada(anterior ?? ''))
  })
})
