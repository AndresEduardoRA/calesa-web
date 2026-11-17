import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BLOQUEA, BLOQUEA_PILOTO, PASA, PASA_PILOTO } from './bloquear-peligrosos.casos'

// `bloquear-peligrosos.sh` es el hook PreToolUse de Bash: lo irreversible, lo de afuera, las dependencias y saltarse el candado de
// la base se rechazan siempre; con `PILOTO=1` (las sesiones del piloto) también todo `git push`, `gh` que escribe y `claude`.
// Se prueba con el hook de verdad: una tabla de comandos → bloquea (exit 2 y el motivo por stderr) / pasa (exit 0), con repos de
// git temporales para la rama del push (el patrón de `scripts/ci-cambios.test.ts`).
const HOOK = resolve('.claude/hooks/bloquear-peligrosos.sh')

let raiz = ''
let enMain = ''
let enOtra = ''

function git(cwd: string, ...args: string[]) {
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@ejemplo.test', ...args], { cwd })
}

function repo(nombre: string, rama: string): string {
  const dir = join(raiz, nombre)
  mkdirSync(dir)
  git(dir, 'init', '-q', '-b', 'main')
  writeFileSync(join(dir, 'README.md'), 'x\n')
  git(dir, 'add', '.')
  git(dir, 'commit', '-q', '-m', 'inicio')
  if (rama !== 'main') git(dir, 'checkout', '-q', '-b', rama)
  return dir
}

function correr(command: string, opciones: { cwd?: string; piloto?: boolean } = {}) {
  const r = spawnSync('bash', [HOOK], {
    input: JSON.stringify({
      tool_name: 'Bash',
      tool_input: { command },
      cwd: opciones.cwd ?? enMain,
    }),
    encoding: 'utf8',
    env: {
      NODE_ENV: 'test',
      PATH: process.env['PATH'] ?? '',
      ...(opciones.piloto ? { PILOTO: '1' } : {}),
    },
  })
  return { estado: r.status, motivo: r.stderr }
}

beforeAll(() => {
  raiz = mkdtempSync(join(tmpdir(), 'bloquear-peligrosos-'))
  enMain = repo('en-main', 'main')
  enOtra = repo('en-otra', 'otra')
})

afterAll(() => {
  rmSync(raiz, { recursive: true, force: true })
})

describe('bloquear-peligrosos.sh', () => {
  it.each(BLOQUEA)('bloquea: %s', (comando) => {
    const real = comando.replace('ENOTRA', enOtra).replace('ENMAIN', enMain)
    const { estado, motivo } = correr(real)
    expect({ estado, motivo: motivo.trim().length > 0 }).toEqual({ estado: 2, motivo: true })
  })

  it.each(PASA)('deja pasar: %s', (comando) => {
    const real = comando.replace('ENOTRA', enOtra).replace('ENMAIN', enMain)
    expect(correr(real).estado).toBe(0)
  })

  it('sin comando (otra herramienta, JSON raro, nada) no hace nada', () => {
    for (const entrada of ['{}', '{"tool_input":{}}', 'no es json', '']) {
      const r = spawnSync('bash', [HOOK], { input: entrada, encoding: 'utf8' })
      expect(r.status, entrada).toBe(0)
    }
  })
})

// Una sesión empuja sólo la rama en la que está; main lo integra la persona al aprobar el PR.
describe('la rama del push', () => {
  it('un push sin rama sale de la rama del cwd: otra pasa, main no', () => {
    expect(correr('git push', { cwd: enOtra }).estado).toBe(0)
    expect(correr('git push origin', { cwd: enOtra }).estado).toBe(0)
    expect(correr('git push origin HEAD', { cwd: enOtra }).estado).toBe(0)
    expect(correr('git push', { cwd: enMain }).estado).toBe(2)
    expect(correr('git push origin HEAD', { cwd: enMain }).estado).toBe(2)
  })

  it('`git -C <carpeta>` manda sobre el cwd, también con una carpeta relativa', () => {
    expect(correr(`git -C ${enOtra} push`, { cwd: enMain }).estado).toBe(0)
    expect(correr(`git -C ${enMain} push`, { cwd: enOtra }).estado).toBe(2)
    expect(correr('git -C ../en-otra push', { cwd: enMain }).estado).toBe(0)
    expect(correr('git -C ../en-main push', { cwd: enOtra }).estado).toBe(2)
  })

  it('main nunca, ni nombrada desde otra rama; y sólo la rama propia', () => {
    expect(correr('git push origin main', { cwd: enOtra }).estado).toBe(2)
    expect(correr('git push origin otra', { cwd: enOtra }).estado).toBe(0)
    expect(correr('git push origin tercera', { cwd: enOtra }).estado).toBe(2)
  })

  it('un push junto a un `cd` se rechaza: el hook no ve en qué rama queda', () => {
    expect(correr('cd ../en-otra && git push', { cwd: enMain }).estado).toBe(2)
    expect(correr('cd ../en-otra && git push origin otra', { cwd: enOtra }).estado).toBe(2)
  })
})

describe('bloquear-peligrosos.sh con PILOTO=1', () => {
  it.each(BLOQUEA_PILOTO)('bloquea: %s', (comando) => {
    const { estado, motivo } = correr(comando.replace('ENOTRA', enOtra).replace('ENMAIN', enMain), {
      piloto: true,
    })
    expect({ estado, motivo: motivo.trim().length > 0 }).toEqual({ estado: 2, motivo: true })
  })

  it.each(PASA_PILOTO)('deja pasar: %s', (comando) => {
    expect(correr(comando, { piloto: true }).estado).toBe(0)
  })

  it('sin PILOTO=1 lo mismo pasa (una sesión de la persona)', () => {
    for (const comando of [
      'git push origin otra',
      'gh pr create --fill',
      'claude -p hola',
      'gh run rerun 1',
    ]) {
      expect(correr(comando, { cwd: enOtra }).estado, comando).toBe(0)
    }
  })

  it('el motivo del push dice que lo publica el bucle', () => {
    expect(correr('git push origin main', { piloto: true }).motivo).toContain('bucle')
  })
})

// La excepción que pidió el dueño: integrar un PR propio de kit/* o plan/* con el CI en verde. Un `gh` de mentira responde
// `gh pr view <n>` según el número: 1 kit en verde, 2 plan en verde, 3 kit con un check en rojo, 4 rama de un paso, 5 kit pendiente.
describe('bloquear-peligrosos.sh: integrar un PR de kit o de plan', () => {
  let bin = ''
  const verde = '{"conclusion":"SUCCESS"},{"conclusion":"SKIPPED"}'
  const respuestas: Record<string, string> = {
    '1': `{"headRefName":"kit/x","isDraft":false,"statusCheckRollup":[${verde}]}`,
    '2': `{"headRefName":"plan/x","isDraft":false,"statusCheckRollup":[${verde}]}`,
    '3': `{"headRefName":"kit/x","isDraft":false,"statusCheckRollup":[${verde},{"conclusion":"FAILURE"}]}`,
    '4': `{"headRefName":"ventas/p11","isDraft":false,"statusCheckRollup":[${verde}]}`,
    '5': `{"headRefName":"kit/x","isDraft":false,"statusCheckRollup":[{"conclusion":"","state":"PENDING"}]}`,
  }

  beforeAll(() => {
    bin = join(raiz, 'bin')
    mkdirSync(bin)
    const casos = Object.entries(respuestas)
      .map(([n, json]) => `  ${n}) echo '${json}' ;;`)
      .join('\n')
    writeFileSync(
      join(bin, 'gh'),
      `#!/usr/bin/env bash\ncase "$3" in\n${casos}\n  *) exit 1 ;;\nesac\n`,
      {
        mode: 0o755,
      },
    )
  })

  function integrar(comando: string, piloto = false) {
    const r = spawnSync('bash', [HOOK], {
      input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: comando }, cwd: enMain }),
      encoding: 'utf8',
      env: {
        NODE_ENV: 'test',
        PATH: `${bin}:${process.env['PATH'] ?? ''}`,
        ...(piloto ? { PILOTO: '1' } : {}),
      },
    })
    return r.status
  }

  it.each(['gh pr merge 1 --merge --delete-branch', 'gh pr merge 2 --squash'])(
    'deja pasar: %s',
    (comando) => {
      expect(integrar(comando)).toBe(0)
    },
  )

  it.each([
    'gh pr merge 3 --merge',
    'gh pr merge 4 --squash',
    'gh pr merge 5 --merge',
    'gh pr merge 1 --merge --admin',
    'gh pr merge --merge',
    'gh pr merge 99 --merge',
  ])('bloquea: %s', (comando) => {
    expect(integrar(comando)).toBe(2)
  })

  it('con PILOTO=1 no hay excepción', () => {
    expect(integrar('gh pr merge 1 --merge', true)).toBe(2)
  })
})
