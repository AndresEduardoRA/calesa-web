# P01 · Bitácora

Paso partido (ver `decisiones.md`): P01 hizo el entorno de §4, el correo por Resend y el formato US$. El resto del `terminado` original
quedó propuesto como P22–P25.

## Qué se hizo

- `feat(base): declarar las variables de entorno de calesa`:
  - `esquemas.ts` con las variables de §4, obligatorias sólo en Vercel y todas nombradas en una vuelta.
  - `problemasDe()` con un problema por variable.
  - `entorno.ts` con las públicas nuevas y `urlDelSitio()`.
  - `.env.example` con Calesa.
- `feat(base): enviar y programar correos por resend`:
  - `adaptadores/resend-api.ts`, con enviar, programar, cancelar y reprogramar, por `fetch`.
  - `programarEmail`, `cancelarEmail`, `reprogramarEmail` y `programaCorreos` en `@/shared/lib/email`.
  - `referencia` como clave de idempotencia.
  - En Vercel el proveedor es `resend`.
- `feat(base): formatear montos y rangos en dólares`: `formatoUSD` y `formatoRango` con los ejemplos de §5.1.
- `test(base): probar que urlDelSitio lee el entorno ya validado`: lo pidió la auditoría del informe.
- La ficha `src/shared/CLAUDE.md` quedó al día en los tres commits.
- La API de Resend se contrastó con su documentación antes de escribir los fakes (S1). Las URL y lo que cambió de la tabla de errores
  están en `decisiones.md`.

## Pruebas en rojo, después en verde

Las salidas están en `.piloto/salidas/P01/`, que no se versiona.

| Commit  | En rojo antes del código                                                                                   | En verde después                          |
| ------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| entorno | 9 de 22 (`esquemas.test.ts`, `entorno.test.ts`); la guarda «sin Vercel bastan las tres» ya estaba en verde | 27 de 27, con `scripts/env-check.test.ts` |
| Resend  | 10 de 37, y `resend-api.test.ts` no cargaba porque el módulo no existía                                    | 62 de 62                                  |
| formato | 5 de 17 (`formatoUSD` no existía)                                                                          | 17 de 17                                  |

## Mutaciones

21 de 21 hicieron caer su prueba y quedaron restauradas con `cp` + `cmp`:

- M1–M17, las del plan.
- 2 de más: «resend sin `RESEND_API_KEY` pasa» y «en Vercel se acepta otro proveedor».
- M20 y M21, que pidió la auditoría del informe: `urlDelSitio()` con `process.env` crudo por defecto, y `problemasDe()` con una variable
  repetida.

El script y sus salidas están en `.piloto/salidas/P01/`: `mutar.py`, `mutaciones.txt` y `mutaciones-fix.txt`.

## Auditoría del informe

Dio «observaciones», sin bloqueos.

- **El 451 no está en la documentación de Resend.** El auditor recordaba un `451 security_error`. Se volvió a abrir la página de errores,
  también en su Markdown (`https://resend.com/docs/api-reference/errors.md`), el 2026-10-31: los status son 400, 401, 403, 404, 405, 409,
  422, 429, 500 y 503, sin 451. Tampoco hay `403 invalid_api_key`, ni un ejemplo del cuerpo de un error. `decisiones.md` sigue igual.
- **El entorno por defecto de `urlDelSitio()` no tenía prueba.** Se agregó en un commit aparte, `test(base): …`, con su mutación (M20).
- **`mapa.sh --check` no imprime nada cuando pasa.** La corrida final guarda cada comando y su código de salida en `verif-4-final.txt`.

## Verificación

Con el comando del paso, después del último cambio de código (el `test(base)`). Cada comando y su código de salida están en
`.piloto/salidas/P01/verif-4-final.txt`:

- `pnpm lint` y `pnpm typecheck`, sin errores ni warnings.
- `pnpm test`: 752 pruebas de Vitest en 26 archivos y 40 del kit (`node --test`), todas en verde.
- `bash scripts/mapa.sh --check`, en verde.
- `pnpm db:reset` y `pnpm db:probar`, en verde. El paso no toca `supabase/`, pero el comando de verificación los pide.
- `pnpm test:e2e:completo`: 2 de 2 (`e2e/inicio.spec.ts`, el humo del kit, en `escritorio` y en `movil`).
- e2e dirigidos: ninguno, porque ningún spec depende de lo tocado (`US$`, `EMAIL_`, `VERCEL_ENV`).

e2e completo: sí (2 de 2, escritorio y móvil; `pnpm test:e2e:completo` con el stack del carril `base`)

## No verificado

- El adaptador **no se probó contra Resend de verdad**. Su contrato sale de la documentación y se prueba con un `fetch` falso. La primera
  prueba real es en una vista previa, con una clave de prueba y el dominio verificado. Ahí hay que mirar sobre todo dos cosas que la
  documentación no muestra: el cuerpo de un error y el status de repetir la misma `Idempotency-Key` con el mismo cuerpo.
- Si alguien quiere probar Resend en local, tiene que copiar las variables nuevas al `.env.local` de la principal. Para P01 no hace falta.
