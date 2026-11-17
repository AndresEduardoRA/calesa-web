# prospeccion

Los códigos de los enlaces de prospección (semilla §3, A4, R4.19): normalizarlos, validarlos y leer el `?ref`; por ahora sólo reglas puras.

## Tablas

- `enlaces_prospeccion` (el check de `codigo` es `^[A-Z0-9-]{2,20}$`). Este paso no la lee ni la escribe.

## Entra y sale

- Entra: nada. No depende de ningún módulo.
- Sale (`index.ts`): `normalizarCodigo`, `esCodigoValido`, `esquemaCodigoDeProspeccion`, `codigoDeRef`, `PATRON_CODIGO` y `MENSAJE_CODIGO_INVALIDO`.
- `features/`, `infra/` y `pantallas/` (crear, copiar y desactivar enlaces en `/panel/prospeccion`) son de P16.

## Archivos clave

- `entities/codigo.ts` — `normalizarCodigo` (recorta y pasa a mayúscula sólo a–z ASCII), `esCodigoValido` (el patrón de la tabla), `esquemaCodigoDeProspeccion` (Zod: entrega el código normalizado o el mensaje) y `codigoDeRef` (el `?ref`: código normalizado o `null`).

## No se rompe

- El patrón es el mismo del check de la tabla: si uno cambia, cambia el otro (y la migración es nueva, nunca editada).
- Nunca `toUpperCase()` general: «ß» → «SS» y «ı» → «I» harían válido lo que la persona no escribió.
- `codigoDeRef` no consulta la base: un código bien escrito pero inexistente o inactivo lo ignora la RPC (R4.19; P05 y P11).

## Ojo

- El texto del error de formato (`MENSAJE_CODIGO_INVALIDO`) lo decidió P20; «Ese código ya existe.» (código repetido) es de P16, que atrapa el `duplicado` de la base.
- Un `?ref` con varios valores llega como arreglo en `searchParams`: se ignora, no se toma el primero.
