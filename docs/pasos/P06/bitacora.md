# P06 · Bitácora

e2e completo: no (1.ª vez, `next build` se cortó con `SecurityFatalError` de Next 16.4.3; 2.ª vez, la app compila pero en la máquina
del carril no está el navegador de Playwright, `chrome-headless-shell`, y el único spec, `inicio`, no llega a abrirlo. El nivel 2 queda
sin verificar hasta el CI del PR. Sin e2e dirigidos: nada en `e2e/` nombra seguridad, Turnstile, tokens ni el cron)

## Qué se hizo

`src/shared/lib/seguridad/`, sólo servidor por `index.ts` (C7, F8; F5 sin conducta aquí, ver `decisiones.md`):

- `9094f7b` `feat(base): agregar las primitivas criptográficas del servidor`: `igualesEnTiempoConstante` (sha256 de cada lado y
  `timingSafeEqual`, nunca lanza), `sha256Hex`, `verificarSecretoDelCron` (exactamente `Bearer <CRON_SECRET>`), `firmarTokenDeSolicitud` y
  `verificarTokenDeSolicitud` (`<id>.<exp>.<firma>`, 2 h desde `emitidoEn`, firma antes que vencimiento), `generarTokenDeGestion` y
  `hashDeTokenDeGestion` (32 bytes; bytea `\x` + sha256 de los bytes).
- `c9852e1` `feat(base): limitar los envíos por ip con un contador inyectable`: `ipDelPedido` (IP real normalizada), `ipParaLimite` (/64),
  `LIMITES` (5, 5, 10, 30, 60 por hora), `claveDeLimite` (`<accion>:<sha256(ip + sal)>`), `limitar(accion, ip, contar)` y
  `crearContadorEnMemoria` (el contrato de ventana fija, en `*.soporte.ts`).
- `fa6401e` `feat(base): verificar turnstile en el servidor`: `verificarTurnstile` (siteverify con tope de 5 s, falla cerrado) y la ficha
  `src/shared/CLAUDE.md`.
- De la auditoría del informe, aparte:
  - `1a7a5f7` `fix(base): rechazar el token de solicitud con un reloj inválido`: con un `ahora` inyectado inválido (`NaN`), un token con
    firma buena pasaba como vigente (fallaba abierto). Ahora se pregunta «¿está antes del vencimiento?», y con `NaN` falla cerrado.
  - `3217e8d` `test(base): probar el tope de 5 s del pedido a siteverify`: la prueba sólo miraba que hubiera un `AbortSignal`.
- **Pendiente:** la parte «sobre la RPC de limites» del `terminado` **no se cumple** en P06. `limitar` funciona con el contador inyectado;
  el enlace con la RPC queda para P32 (la RPC, carril `datos`) y P33 (el adaptador, carril `base`), propuestos en `decisiones.md` (P1).

## Lo corrido

Las salidas están en `.piloto/salidas/P06/`.

- **Rojo primero, contra HEAD** (antes de escribir el producto): las 8 pruebas caen porque el módulo no existe («Cannot find module» /
  «Failed to resolve import»): `rojo-cripto.txt`, `rojo-cron.txt`, `rojo-token-solicitud.txt`, `rojo-token-gestion.txt`, `rojo-ip.txt`,
  `rojo-limites.txt`, `rojo-contador-en-memoria.txt` y `rojo-turnstile.txt`.
- **Verde:** `pnpm exec vitest run src/shared/lib/seguridad/`: 8 archivos y 104 pruebas (`verde.txt` es de la primera corrida, con 101; la de
  ida y vuelta se sumó por M6, y las del reloj inválido y el tope de 5 s por la auditoría del informe).
- **Rojo de los arreglos de la auditoría** (`rojo-fix-auditoria.txt`): «con un reloj inválido falla cerrado» cae contra `fa6401e`; la del
  tope de 5 s cubre conducta que ya existía y su rojo es la mutación M25.
- **Vectores, con herramientas independientes** (`vectores.txt`):
  - firma: `printf '%s' "<id>.<exp>" | openssl dgst -sha256 -hmac "<secreto>" -binary | basenc --base64url | tr -d '='`;
  - token de gestión: `head -c 32 /dev/zero | sha256sum`;
  - `printf 'abc' | sha256sum` (FIPS 180-2).
- **Mutaciones: las 23 del plan y M24–M25 de la auditoría**, todas caen con la prueba nombrada y se revierten con `cp` + `cmp`
  (`mutaciones.txt`, 27 comprobaciones porque M11 y M14 se miran contra dos pruebas; script en `mutar.py`). M24 vuelve a `ahora >= exp`
  (cae «con un reloj inválido falla cerrado») y M25 sube el tope a 60 s (cae «corta el pedido a siteverify a los 5 s»). M4 y M5 se
  adaptaron a la forma nueva del vencimiento.
  - M6 (`7200 → 7140`) caía (3 pruebas de `firmarTokenDeSolicitud`), pero no la que nombraba el plan: «11:59:59 → ok» verifica el token
    literal del vector, que no depende de la duración. Se sumó la prueba de ida y vuelta «firmado a las 10:00, verificado a las 11:59:59
    vale», y M6 la hace caer.
- **`verificacion.comando`** (`pnpm lint && pnpm typecheck && pnpm test && bash scripts/mapa.sh --check`):
  - con el entorno del bucle cae en 5 pruebas **del kit** (`scripts/piloto/piloto.test.mjs`, `scripts/coordinador/coordinador.test.mjs`):
    leen `PILOTO_AUTO` y `COORD_MERGE_AUTO=verde,ambar,rojo` del entorno (`verificacion.txt`), como ya anotaron P04 y P07; no son de este
    paso;
  - sin `PILOTO_*` ni `COORD_*`, todo en verde sobre `3217e8d`, con el código de salida de cada comando: lint 0, typecheck 0, test 0
    (vitest con 65 archivos y 1357 pruebas, kit con 45 de 45), `mapa.sh --check` 0 y el comando encadenado 0
    (`verificacion-entorno-limpio.txt`; antes, `test-kit-sin-entorno-del-piloto.txt`).
- Sin `.skip`, `.fixme` ni `.only` nuevos. El archivo más largo tiene 157 líneas (`token-solicitud.test.ts`).
- Cada commit intermedio se sostiene solo (worktree temporal con `node_modules` enlazado): `next typegen` + `tsc --noEmit` exit 0, lint de
  `seguridad/` limpio y sus pruebas (55 en `9094f7b`, 85 en `c9852e1`) en verde (`commits-intermedios.txt`). Ahí `pnpm typecheck` dio
  exit 1, también en HEAD (`fa6401e`): es `pnpm` en ese worktree temporal, no el código; por eso se corrieron los dos comandos directos.
- `pnpm test:e2e:completo --project=escritorio` (nivel 2 por el disparador `shared`), con el candado del carril `base`:
  - 1.ª vez (`e2e-completo-escritorio.txt`): la base se reseteó y `next build` compiló, pero se cortó con `SecurityFatalError` (abajo);
  - 2.ª vez (`e2e-completo-escritorio-2.txt`): la app compiló y el único spec, `e2e/inicio.spec.ts`, cayó al abrir el navegador: falta
    `chrome-headless-shell` de Playwright en esta máquina (lo mismo que anotó P02). No se instaló nada.

## Hallazgos

- El `next build` del e2e se cortó con `SecurityFatalError`: Next.js 16.4.3 avisa que su versión tiene una vulnerabilidad conocida y
  recomienda actualizar. No se actualizó nada: cambiar una versión es una compuerta `dependencia` y no es de este paso.
- La primera ronda de la auditoría del plan bloqueó por dos cosas que habrían llegado a producción sin que nada las atrapara: la IPv6 en /64
  como `remoteip` (todo visitante IPv6 rechazado, porque todo falla cerrado) y la falta de pruebas de tiempo constante en el cron y el token
  (un `===` en esos archivos dejaba todo en verde). Las dos tienen ahora prueba y mutación (M18, M19, M22 y M23).
- No hay identidad de git configurada en este entorno: los commits llevan la de los commits anteriores del repo, por variables de entorno
  en cada comando (nada se escribió en la configuración de git), como en P07.
