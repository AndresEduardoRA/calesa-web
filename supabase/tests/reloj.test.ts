// La guarda del reloj de pruebas (paso P38; semilla §9.7 l. 945): la tabla `reloj` del esquema `pruebas` existe sólo donde la crea la
// semilla local. Si una migración la nombrara (la creara, le diera un grant, la leyera), llegaría a la nube y `public._ahora()` dejaría
// de ser `now()` en producción. La única excepción es la definición de `public._ahora`, que la busca con `to_regclass`. Se cuentan
// también los comentarios, y se lee la carpeta tal como está (no lo que sabe git).
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

import { definicionSql, definicionesEn, migracionesEnOrden } from '../../scripts/lib/definicion-sql'

const NOMBRA_EL_RELOJ = /"?pruebas"?\s*\.\s*"?reloj\b/i
const CREA_EL_RELOJ = /create\s+table\s+(?:if\s+not\s+exists\s+)?"?pruebas"?\s*\.\s*"?reloj"?\s*\(/i

// Las migraciones que nombran la tabla fuera de las definiciones de `public._ahora`.
function quienNombraElReloj(raiz = process.cwd()): string[] {
  return migracionesEnOrden(raiz)
    .filter(({ texto }) => {
      const sinAhora = definicionesEn(texto, '_ahora').reduce((t, d) => t.replace(d, ''), texto)
      return NOMBRA_EL_RELOJ.test(sinAhora)
    })
    .map(({ archivo }) => archivo)
}

// Las semillas de `[db.seed] sql_paths` de config.toml, en su orden (lo mismo que lee `scripts/probar-schema.mjs`).
function semillas(raiz = process.cwd()): string[] {
  const toml = readFileSync(join(raiz, 'supabase/config.toml'), 'utf8').replace(/^\s*#.*$/gm, '')
  const lista = /sql_paths\s*=\s*\[([^\]]*)\]/.exec(toml)?.[1] ?? ''
  return [...lista.matchAll(/"([^"]+)"/g)].map((m) => join(raiz, 'supabase', m[1] ?? ''))
}

describe('reloj de pruebas: el repo', () => {
  it('ninguna migración nombra la tabla del reloj fuera de public._ahora', () => {
    expect(quienNombraElReloj()).toEqual([])
  })

  it('la vigente public._ahora la busca con to_regclass, de definidor y con search_path vacío', () => {
    const { texto } = definicionSql('_ahora')
    expect(texto).toContain("to_regclass('pruebas.reloj')")
    expect(texto).toMatch(/\bsecurity\s+definer\b/i)
    expect(texto).toContain("set search_path = ''")
  })

  it('la crea una semilla de sql_paths, y ninguna migración', () => {
    const creadoras = semillas().filter((ruta) => CREA_EL_RELOJ.test(readFileSync(ruta, 'utf8')))
    expect(creadoras.map((ruta) => ruta.replace(/^.*\/supabase\//, ''))).toEqual([
      'semillas/reloj.sql',
    ])
    expect(migracionesEnOrden().filter(({ texto }) => CREA_EL_RELOJ.test(texto))).toEqual([])
  })
})

const AHORA =
  "create function public._ahora() returns timestamptz language plpgsql stable security definer set search_path = '' as $$\n" +
  "begin\n  if to_regclass('pruebas.reloj') is null then return now(); end if;\n  return now();\nend;\n$$;\n"

describe('reloj de pruebas: la guarda con migraciones de mentira', () => {
  const raiz = mkdtempSync(join(tmpdir(), 'reloj-'))
  afterAll(() => rmSync(raiz, { recursive: true, force: true }))
  const carpeta = join(raiz, 'supabase/migrations')
  mkdirSync(carpeta, { recursive: true })

  function con(archivos: Record<string, string>): string[] {
    rmSync(carpeta, { recursive: true, force: true })
    mkdirSync(carpeta, { recursive: true })
    for (const [nombre, texto] of Object.entries(archivos))
      writeFileSync(join(carpeta, nombre), texto)
    return quienNombraElReloj(raiz)
  }

  it('pasa si sólo la nombran las definiciones de _ahora (también una redefinición)', () => {
    expect(
      con({
        '20261101000000_reloj.sql': `-- la tabla reloj del esquema de pruebas\n${AHORA}`,
        '20261102000000_otra.sql': AHORA.replace('create function', 'create or replace function'),
      }),
    ).toEqual([])
  })

  it('cae con un create table, un grant con comillas, un comentario o el cuerpo de otra función', () => {
    expect(
      con({
        '20261101000000_reloj.sql': AHORA,
        '20261102000000_tabla.sql': 'create table pruebas.reloj (id int);\n',
        '20261103000000_grant.sql': 'grant select on "pruebas"."reloj" to authenticated;\n',
        '20261104000000_comentario.sql': '-- se fija en pruebas . reloj\nselect 1;\n',
        '20261105000000_otra.sql':
          'create function public.otra() returns timestamptz language sql as $$ select ahora from pruebas.reloj $$;\n',
      }),
    ).toEqual([
      '20261102000000_tabla.sql',
      '20261103000000_grant.sql',
      '20261104000000_comentario.sql',
      '20261105000000_otra.sql',
    ])
  })

  it('revisa también lo que se agrega después de la de _ahora y fuera de su definición en el mismo archivo', () => {
    expect(
      con({
        '20261101000000_reloj.sql': `${AHORA}grant select on pruebas.reloj to service_role;\n`,
        '20261201000000_tarde.sql': 'alter table pruebas.reloj owner to authenticated;\n',
      }),
    ).toEqual(['20261101000000_reloj.sql', '20261201000000_tarde.sql'])
  })
})
