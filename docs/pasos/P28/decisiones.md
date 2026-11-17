# P28 · Decisiones

Fecha: 2026-11-17 (America/La_Paz). Paso ámbar sin decisiones de la semilla ligadas (`decisiones: []`); se siguió §6.8. Autoelecciones de
este paso en `hechos.json`: ninguna (la única registrada es de P06).

- **El adjunto viaja como `{ nombre, tipo, contenido }` con el contenido en base64.** Es el formato que ya cruza JSON sin pérdida: lo
  necesitan por igual la API de cada proveedor y el registro de correos de P29 (`correos_salientes`). Un `Buffer` no cruzaría ni la base ni
  una Server Action.
- **Topes:** hasta 5 adjuntos, 5 MB (decodificados) cada uno. Resend admite 40 MB por correo y los buzones comunes 25 MB; con 5 × 5 MB
  nunca se pasa. Un `.ics` pesa menos de 2 KB: el tope sólo frena un uso indebido.
- **El nombre es una lista cerrada de caracteres** (letras, números, espacio, `.`, `_`, `-`, paréntesis; empieza con letra o número). Así no entra
  ninguna ruta (`../`, `\`) ni un salto de línea que se cuele a una cabecera MIME. El `tipo` también va en una sola línea y admite
  parámetros (`text/calendar; method=REQUEST|CANCEL`), que es lo que P29 necesita para el .ics.
- **Nombre de la función de fecha: `formatearFechaConDia`** (`EEE d MMM, HH:mm`, hora del proyecto). Sin año, como pide §6.8. Una fecha sin
  hora sale a las 00:00; nadie la usa así, pero no lanza.
- **Sin entrada en `docs/GLOSARIO.md`:** «adjunto» no es un término del dominio, y el glosario se genera de la semilla.
- **Pendiente para P29:** las plantillas usan `formatearFechaConDia` y arman el `.ics`; este paso sólo deja la tubería.
