# P28 · Bitácora

e2e completo: no (paso de `src/shared/lib/`, nivel 1: nada de `e2e/` toca el correo ni las fechas; además, en este carril `next build` ya
falló por `SecurityFatalError` en P06 y falta el navegador de Playwright. Lo corre el CI del PR)

## Qué se hizo

- `src/shared/lib/email/tipos.ts`: `esquemaDeAdjunto` y `adjuntos` (opcional, hasta 5) en `esquemaDeMensaje`; tipo `AdjuntoDeEmail`.
- `adaptadores/mailpit.ts`: `Attachments` (`Content`, `Filename`, `ContentType`). `adaptadores/resend-api.ts`: `attachments` (`filename`,
  `content`, `content_type`), en `enviar` y en `programar`. Sin adjuntos, ninguno de los dos agrega el campo.
- `src/shared/lib/fechas.ts`: `formatearFechaConDia()` → «mar 3 nov, 10:00».
- Pruebas: `email/adjuntos.test.ts` (nuevo), `adaptadores/resend-api.test.ts` y `fechas.test.ts`. Primero en rojo contra HEAD (18 fallos),
  después el código. 8 mutaciones, todas caen (`.piloto/salidas/P28/mutaciones.txt`).
- Ficha `src/shared/CLAUDE.md` al día.

## Lo corrido

`pnpm lint`, `pnpm typecheck`, `pnpm test` y `bash scripts/mapa.sh --check`: ver `.piloto/salidas/P28/`.

## Ojo

- El plan lo escribí yo en `.piloto/planes/P28.md`, sin los subagentes `planificador` y `auditor`: paso ámbar de un solo archivo de
  contrato, `revisor: ninguno` en el ruteo.
- Las cabeceras de Resend para el adjunto salen de su documentación de `send-email` (`attachments[].filename|content|content_type`); no
  se probó contra la API real (no hay clave en el carril): la prueba es el contrato del cuerpo, como en el resto del adaptador.
