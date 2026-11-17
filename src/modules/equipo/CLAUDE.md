# equipo

La sección pública «Quiénes somos» (semilla §6.2, sección 8; A6, E6): lee las filas visibles del equipo y las dibuja. La gestión desde el panel es de P16.

## Tablas

- `equipo` (la lee `anon` sólo por `publico.equipo_visible()`, que ya filtra `visible`, ordena por `orden, id` y trae a lo sumo 100) y el bucket público `equipo` de storage (las fotos, por su URL pública).

## Entra y sale

- Entra: sólo `shared` (`config/entorno`, `lib/errores`). No depende de ningún módulo.
- Sale, por `index.ts` (servidor): `leerEquipoVisible`, `ETIQUETA_DEL_EQUIPO` y el tipo `MiembroDelEquipo`.
- Sale, por `pantallas/inicio.ts` (sólo `src/app`): `SeccionQuienesSomos` y `leerEquipoVisible`. El componente no sale por `index.ts`: `next/image` es un módulo de cliente.
- Sin `client.ts`: nada viaja al navegador.
- Uso que espera P08, con `Suspense` porque leer base va tras él (cacheada, no cuesta nada: entra al prerender):
  `<Suspense fallback={null}><Equipo /></Suspense>`, con `Equipo` un Server Component async que hace `<SeccionQuienesSomos equipo={await leerEquipoVisible()} />`.

## Archivos clave

- `entities/miembro.ts` — `esquemaFilaDelEquipoVisible` (la fila de la RPC), `leerFilasDelEquipo` (valida, limita a 100 y arma `MiembroDelEquipo`), `urlDeFoto` y `ETIQUETA_DEL_EQUIPO`.
- `infra/cliente-publico.ts` — el cliente `anon` sin cookies sobre el esquema `publico`.
- `infra/queries/equipo-visible.ts` — `leerEquipoVisible()` con `'use cache'`, etiqueta `equipo`, 1 hora; un fallo se devuelve como valor y se reintenta en minutos.
- `features/quienes-somos/components/seccion-quienes-somos.tsx` — la sección, pura y síncrona.

## No se rompe

- Sin filas o con la lectura fallida, la sección no dibuja nada (se oculta); un fallo no tumba la portada.
- Las fotos llevan `unoptimized` (R5.1): no se consulta la optimización de Vercel.
- La lectura nunca usa cookies ni la secret key: va dentro de `'use cache'`, como `anon`.
- Una tarjeta sin foto sale sin imagen: nombre, cargo y frase.

## Ojo

- La respuesta de la RPC va sin tipo y pasa por Zod: `db:types` sólo genera `public`, así que `Database` no conoce `publico`. Cuando el carril `base` lo cambie (y ofrezca un cliente sin cookies en `shared`), `cliente-publico.ts` se simplifica.
- La action de P16 que guarda el equipo llama `updateTag(ETIQUETA_DEL_EQUIPO)` (revalidación inmediata), no `revalidateTag(…, 'max')`.
- El e2e de P08 cubre la sección en escritorio y móvil, con el texto al 200 % y sin scroll horizontal (`plan.yaml` no lo nombra).
- R5.1 guarda una sola versión de 800 px y la sección la muestra a 160 px; no hay miniatura de 480 px (no es lista de registros y no crece: tope de 100).
- En producción la tarjeta del fundador no existe hasta que alguien la crea (P16 o el lanzamiento): la semilla de datos sólo corre en local.
