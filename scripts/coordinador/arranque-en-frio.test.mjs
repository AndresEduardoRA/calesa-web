// Una máquina sin el estado del coordinador (otra PC, o `<común de git>/coordinador/` borrado) tiene que reconstruirlo de main y de
// GitHub, sin volver a dar un paso integrado ni rehacer uno publicado. Con el historial y el plan reales de calesa-web (fixtures/):
// P01 entró con un merge normal y el coordinador se lo volvía a dar al carril base.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { estadoInicial, integradosEnMain, leerPlan, pasosDePrs, siguiente } from './plan.mjs'

const fixture = (nombre) => readFileSync(new URL(`./fixtures/${nombre}`, import.meta.url), 'utf8')
const PLAN = leerPlan(fixture('plan-calesa-web.yaml'))
const ASUNTOS = fixture('asuntos-calesa-web.txt')

test('reconoce el squash y el merge normal de la rama de un paso; no una rama de kit', () => {
  const enMain = integradosEnMain(
    [
      'P22 · Layout (#28)',
      'Merge pull request #2 from Dueño-1/base/p01',
      'Merge pull request #24 from Dueño-1/plan/pasos-propuestos-2',
      'Merge pull request #19 from Dueño-1/kit/migrar-remoto',
      'P01 · Otra vez (#40)',
    ].join('\n'),
  )
  assert.deepEqual(
    [...enMain],
    [
      ['P22', 28],
      ['P01', 2],
    ],
  )
})

test('con el historial real, todo paso con commit en main queda integrado (P01 incluido)', () => {
  const enMain = integradosEnMain(ASUNTOS)
  assert.equal(enMain.get('P01'), 2)
  const conCommit = new Set([...ASUNTOS.matchAll(/^(P\d+) · /gm)].map((m) => m[1]))
  for (const id of conCommit) assert.ok(enMain.has(id), `${id} tiene commit en main`)
})

test('arranque en frío: ningún carril recibe un paso que ya está en main', () => {
  const enMain = integradosEnMain(ASUNTOS)
  const estado = estadoInicial(PLAN, { pasos: {} }, enMain)
  for (const { id: carril } of PLAN.carriles) {
    const r = siguiente(PLAN, estado, carril)
    if (r.accion === 'paso') assert.ok(!enMain.has(r.paso.id), `${carril} recibió ${r.paso.id}`)
  }
  const base = siguiente(PLAN, estado, 'base')
  assert.equal(base.accion, 'paso')
  assert.notEqual(base.paso.id, 'P01')
})

test('un PR abierto en GitHub deja el paso publicado: no se reasigna como nuevo', () => {
  const abiertos = pasosDePrs(PLAN, [
    { number: 50, headRefName: 'base/p24' },
    { number: 51, headRefName: 'base/p25' },
    { number: 52, headRefName: 'kit/otra-cosa' },
    { number: 53, headRefName: 'datos/p24' }, // la rama de otro carril no es la del paso
  ])
  assert.deepEqual(
    [...abiertos],
    [
      ['P24', 50],
      ['P25', 51],
    ],
  )
  const estado = estadoInicial(PLAN, { pasos: {} }, integradosEnMain(ASUNTOS), abiertos)
  assert.deepEqual(estado.pasos.P24, {
    estado: 'publicado',
    pr: 50,
    carril: 'base',
    arreglar: null,
  })
  const r = siguiente(PLAN, estado, 'base')
  if (r.accion === 'paso') assert.ok(!['P24', 'P25'].includes(r.paso.id), `recibió ${r.paso.id}`)
})

test('lo que esta máquina ya sabe manda sobre un PR abierto: un paso asignado sigue asignado', () => {
  const previo = { pasos: { P24: { estado: 'asignado', carril: 'base' } } }
  const estado = estadoInicial(PLAN, previo, new Map(), new Map([['P24', 50]]))
  assert.equal(estado.pasos.P24.estado, 'asignado')
})
