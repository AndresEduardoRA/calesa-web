# P20 · Decisiones

Equipo y prospección (entities, lectura pública, sección «Quiénes somos»). Riesgo ámbar. No hubo compuerta: P1 y P2 son microdecisiones de `.claude/rules/ui.md` y se decidieron aquí (2026-11-17).

## Decisiones (2026-11-17)

- **Texto del error de formato de un código (P1).** «El código lleva de 2 a 20 letras de la A a la Z, números o guiones.» (`MENSAJE_CODIGO_INVALIDO`). `docs/UX.md` sólo da el del código repetido. «De la A a la Z» y no «sin tilde», porque la Ñ también la rechaza el patrón.
- **Tarjeta sin foto (P2).** Sale sin imagen: nombre, cargo y frase (la lectura literal de §6.2, sección 8). La del fundador nace sin foto en `seed.sql`.
- **`normalizarCodigo` sólo pasa a mayúscula a–z ASCII.** `toUpperCase()` general volvería «ß» en «SS» y «ı» en «I» y haría válido algo que la persona no escribió.
- **`codigoDeRef` descarta lo mal formado y un arreglo.** Un `?ref` repetido llega como arreglo en `searchParams`: se ignora, no se toma el primero. Que el código exista y esté activo lo decide la RPC (R4.19; P05 y P11).
- **Excepción a `.claude/rules/datos.md:6`** («el cliente de servidor se crea por request con `createClient()` de `@/shared/lib/supabase/server`»). La lectura de «Quiénes somos» usa un cliente propio, sin cookies, en `equipo/infra/cliente-publico.ts`: el de `server.ts` lee `cookies()` y eso no cabe en `'use cache'`. Corre como `anon`, con la clave publicable y sobre el esquema `publico`.
  - **Pendiente del carril `base`:** un cliente sin cookies en `@/shared/lib/supabase/` (lo usaría también `publico.config_calculadora()`, P09) y `--schema public,publico` en `db:types`. No bloquea P20: la respuesta va sin tipo y pasa por Zod (`esquemaFilaDelEquipoVisible`), sin `any` ni tipo de tabla escrito a mano. `pnpm typecheck` aceptó `createClient` sin el genérico `Database` (supuesto S1 del plan).
- **Caché y fallos.** `leerEquipoVisible()` lleva `'use cache'`, la etiqueta `equipo` y `cacheLife('hours')`. Si la RPC o la validación fallan devuelve el error como valor con `cacheLife('minutes')`: la sección se oculta y se reintenta pronto; la portada no se cae.
- **Una sola fila inválida oculta toda la sección** (`leerFilasDelEquipo`): mejor que mostrar un equipo a medias. Más de 100 filas también (tope de la RPC).
- **Dónde vive cada pieza.** `SeccionQuienesSomos` está en `features/quienes-somos/` y es pura (recibe el `Resultado`); la lectura está en `infra/`; las junta `pantallas/inicio.ts` (nombre como en `planes`). El componente no sale por `index.ts` porque `next/image` es un módulo de cliente.
- **Para P08 y P16 (en la ficha de `equipo`):** `<Suspense fallback={null}>` alrededor de la sección; la action de P16 llama `updateTag(ETIQUETA_DEL_EQUIPO)` (no `revalidateTag(…, 'max')`: el `terminado` pide revalidación inmediata); el e2e de P08 cubre la sección con el texto al 200 % y sin scroll horizontal; R5.1 guarda una sola versión de 800 px y la sección la muestra a 160 px (no hay miniatura de 480 px: no es lista de registros y no crece).

## Para el coordinador

- Corregir los `modulos` de P16: su `terminado` gestiona el equipo y no tiene `src/modules/equipo/features/`, `infra/` ni la ficha (la guarda ya deja pasar la carpeta, es del carril `equipo`).
- En producción la tarjeta del fundador no existe hasta que alguien la crea: P02 dice «el admin (P20)», pero P20 no tiene panel. La crea P16 desde el panel o el paso de lanzamiento.
- Carril `base`: el cliente sin cookies y `db:types` con `publico` (arriba).
- Un `e2e-dirigidos` de CI pedirá el completo: hay archivos de `src/` sin spec que los nombre (la sección no se monta en ninguna ruta hasta P08).

## Términos nuevos para la próxima versión de la semilla

`docs/GLOSARIO.md` se genera desde la semilla, así que no se tocó (como hizo P02):

- **Miembro del equipo**: una fila de `equipo`; el tipo es `MiembroDelEquipo`.
- **Código de prospección**: el `codigo` de un enlace de prospección (R4.19).
