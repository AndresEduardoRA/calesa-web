# P32 · Decisiones

La RPC del límite de envíos, `contar_envio`. Es de riesgo rojo y pasó por una compuerta `datos`. El plan auditado tuvo dos rondas: la
primera dejó observaciones, que se resolvieron, y la segunda pasó. Lo aprobó `PILOTO_AUTO`.

## Autoelección (2026-11-17)

Tal cual la anotó el bucle (`hechos.json` › `autoelecciones`):

- 2026-11-17T11:52:50-04:00 · P32 · compuerta datos contestada sola (PILOTO_AUTO): aprobar

Con eso rigen las recomendadas de las dos preguntas del plan:

- **P1 · Argumentos inválidos.** La RPC da error `22023`, con el parámetro en `hint` y un texto fijo, antes de escribir nada:
  - clave nula, vacía o de más de 200 caracteres: `p_clave`, «La clave del límite de envíos no es válida.»;
  - máximo nulo o menor que 1: `p_maximo`, «El máximo del límite de envíos tiene que ser 1 o más.»;
  - ventana nula o fuera de rango: `p_ventana_segundos`, «La ventana del límite de envíos va de 1 segundo a 1 día.».

  Se valida en ese orden y sale el primero que falla. Quien limita falla cerrado: `limitar` devuelve el fallo y el envío no pasa
  (`src/shared/lib/seguridad/limites.ts:57`).

- **P2 · La ventana va de 1 a 86 400 s (un día).** `limites` se guarda 2 días (semilla §3) y la limpieza de P30 corre una vez por día,
  así que con ventanas de hasta un día nunca corta una ventana viva. Hoy la única ventana es 3600 (`VENTANA_SEGUNDOS`).

## Lo no obvio (2026-11-17)

- **El reloj es `now()`, no `clock_timestamp()`.** Por PostgREST cada llamada es su propia transacción, así que `now()` es la hora del
  pedido. Las pruebas se apoyan en eso: dentro de un bloque la hora no cambia y el tiempo se mueve corriendo `ventana_inicio` hacia
  atrás.
- **El reinicio usa `>=`, igual que `crearContadorEnMemoria`.** A los 3599,999999 s sigue la misma ventana y a los 3600 s exactos se
  reinicia con conteo 1. Pasado el máximo, en la misma ventana, el conteo sigue subiendo (con máximo 5, el 6.º envío deja la fila en
  6), como en la memoria. La RPC
  devuelve sólo el booleano, nunca el conteo ni la ventana.
- **`creado_en` no se toca al reiniciar.** Queda la primera vez que se vio la clave.
- **La concurrencia la da una sola sentencia** (`insert … on conflict (clave) do update … returning`). En READ COMMITTED, dos llamadas
  con la misma clave se serializan en el bloqueo de la fila, y ninguna da `40001` ni `23505`. No hay prueba de carreras: el kit no
  tiene `db:carreras` y PGlite usa una sola conexión. Lo defiende el bloque «forma» de `supabase/tests/limites.sql`, que cae si alguien
  la reescribe como leer y después escribir.
- **Por qué hay un `grant` a `service_role`.** Los privilegios por defecto ya le dan EXECUTE, pero el `grant` explícito dice a
  propósito quién la llama. Por eso, quitar sólo el `grant` no es una mutación que caiga; la mutación M11 lo cambia por un `revoke`.
- **La tabla de casos se repite a propósito.** `supabase/tests/limites.sql` copia la de
  `src/shared/lib/seguridad/contador-en-memoria.test.ts` y los máximos de `LIMITES`, porque SQL no importa TS. Si cambia `LIMITES`,
  cambia `limites.sql`.

## Para los pasos que siguen

- **P33 (carril base, `contadorDeSupabase`):**
  - Llamar con `cliente.rpc('contar_envio', { p_clave, p_maximo, p_ventana_segundos })` y validar la respuesta con `z.boolean()`.
  - **No dejar pasar al visitante el texto de un `22023` de `contar_envio`.** `errorDePostgrest` deja pasar el texto si es legible
    (`src/shared/lib/errores.ts:93-94`) y `limitar` devuelve el fallo tal cual (`limites.ts:57`). Con un bug en P33, el visitante leería
    «La clave del límite de envíos no es válida.». P33 lo convierte en `TEXTO_LIMITE` o en `MENSAJE_INESPERADO`, sin dejar de fallar
    cerrado.
- **P30 (`retencion_diaria`):** limpiar `limites` con `ventana_inicio < now() - interval '2 days'`. Con ventanas de hasta un día, así no
  corta ninguna viva.
- **Términos para la próxima versión de la semilla** (`docs/GLOSARIO.md` sale de ella): **límite de envíos** y **ventana fija**.
