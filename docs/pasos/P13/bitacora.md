# Bitácora · P13 · Tarea diaria y webhook de Resend

e2e completo: no (en esta máquina Playwright no tiene navegadores: `~/.cache/ms-playwright` no existe y el piloto no instala
dependencias; 8 de 14 cayeron al lanzar Chromium y pasaron los 6 que no abren navegador. P13 no agrega ninguna ruta ni pantalla. Lo
corre el CI del PR)

## Qué se hizo

- `git merge --no-ff origin/main` (`1d16b0e`) antes de planificar, para leer el `main` de hoy (P27–P34 integrados).
- `f7cc6f8` · `feat(tareas): orquestar la tarea diaria por puertos con su latido`: `medicion/entities/tarea-diaria.ts` (puertos, resumen,
  `armarErrorDelLatido`) e `infra/tarea-diaria.ts` (`correrTareaDiaria`), con su entrada en `index.ts` y la ficha.
- `2f3323b` · `feat(tareas): atender el webhook de resend con su firma verificada`: `src/app/api/webhooks/resend/` (`firma.ts`,
  `evento.ts`, `manejador.ts`).
- `b788e2a` · `feat(tareas): atender la llamada del cron diario con su secreto`: `src/app/api/cron/diario/manejador.ts`.
- Sin `route.ts`, `vercel.json` ni e2e: son de P42 (ver `decisiones.md`).

## Lo corrido

| Qué                                | Resultado                                                                                                                                                                         | Salida                                            |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Pruebas nuevas contra HEAD (rojo)  | 6 archivos caen por el import                                                                                                                                                     | `.piloto/salidas/P13/rojo.txt`                    |
| Pruebas nuevas con el código       | 14 archivos, 138 pruebas, 0 fallas (`medicion` y `src/app/api`)                                                                                                                   | `.piloto/salidas/P13/verde.txt`                   |
| Mutaciones M1–M20                  | las 20 caen con la prueba esperada; cada archivo vuelve con `cp` + `cmp`                                                                                                          | `.piloto/salidas/P13/mutaciones.txt`              |
| `pnpm lint`                        | sin errores ni warnings                                                                                                                                                           | `.piloto/salidas/P13/verificacion-1.txt`          |
| `pnpm typecheck`                   | sin errores                                                                                                                                                                       | ídem                                              |
| `pnpm test` (Vitest)               | 116 archivos, 1877 pruebas, 0 fallas                                                                                                                                              | ídem                                              |
| `pnpm test` (`test:kit`)           | 5 fallas ajenas a P13 (abajo)                                                                                                                                                     | ídem y `.piloto/salidas/P13/test-kit-sin-env.txt` |
| `bash scripts/mapa.sh --check`     | verde (también en cada commit, por lefthook)                                                                                                                                      | —                                                 |
| `pnpm db:reset` y `pnpm db:probar` | verde: 198 pruebas, 0 fallas                                                                                                                                                      | `.piloto/salidas/P13/base.txt`                    |
| `pnpm test:e2e:completo`           | 1.ª corrida: `next build` se detuvo por un aviso de seguridad de Next 16.4.3 («retry the same command»). 2.ª: 6 pasan y 8 caen por `browserType.launch: Executable doesn't exist` | `.piloto/salidas/P13/e2e-completo.txt`, `…-2.txt` |

- **`test:kit`, las 5 fallas.** P13 no toca `scripts/` ni `piloto.config`.
  - 4 caen porque las pruebas heredan `PILOTO_AUTO` del entorno del bucle. Sin las variables `PILOTO_*`, pasan 48 de 49.
  - La que queda, `coordinador.test.mjs:92` («el ciclo completo»), lee el `piloto.config` real, que ahora trae
    `COORD_MERGE_AUTO=verde,ambar,rojo`. Ya la había anotado P12 como ajena.
- **Pruebas saltadas nuevas:** ninguna (`git diff 1d16b0e..HEAD | grep -nE '\.(skip|fixme|only)\('` no da nada).
- **Nivel** (`node scripts/piloto/nivel.mjs` sobre los archivos): 1, sin disparadores. Marca `toca_interfaz` sólo porque los cuatro
  archivos están bajo `src/app/`; no dibujan nada. Se corrió igual el comando de nivel 2 del paso.

## Pendientes, para la persona

- **Next 16.4.3:** `next build` avisa de una vulnerabilidad conocida y para una vez. Subir la versión es una dependencia: es una decisión
  del dueño, no de este paso.
- **Playwright sin navegadores:** para correr el e2e en esta máquina, `pnpm exec playwright install chromium`.
- **git sin identidad en el entorno del piloto:** los commits llevan `-c user.name/user.email` con el mismo autor que los pasos
  anteriores.
