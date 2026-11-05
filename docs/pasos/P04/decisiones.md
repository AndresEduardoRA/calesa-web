# P04 · Decisiones

Fecha: 2026-11-05 (America/La_Paz). Plan auditado en una ronda (observaciones, sin bloqueo).

**Autoelecciones ámbar (I2 e I10), tal cual:** un admin asignado no le gana a un vendedor elegible. §5.6 dice «si esa persona es elegible,
gana ella», pero X5 y R1.2 hablan del vendedor y dejan al admin sólo de respaldo (R4.9). Se eligió la lectura de X5/R4.9. **P05 (rojo)
debe confirmarla en SQL.**

**I10, también ámbar:** §5.6 desempata por «la última reunión asignada» y su ejemplo dice «V1 recibió la última hace 2 días»; eso
puede leerse como el momento en que se asignó o como el inicio de la reunión. Se eligió el **inicio de la última reunión no
cancelada** (`Persona.ultimaReunionEn`), porque es lo que tiene la tabla `reuniones` sin columnas nuevas. Puede estar en el futuro y
cambia quién gana un empate. **P05 debe confirmarla en SQL.**

## Interpretaciones (para P05: la misma regla en SQL)

- **I1** · Último desempate del reparto parejo: el `id` menor, para que sea determinista. La semilla sólo llega a `creado_en`.
- **I2** · Ver arriba.
- **I3** · El conteo de la semana usa reuniones `confirmada`, al pie de la letra de §5.6. Las que pasan a `realizada` dejan de contar.
- **I4** · La reunión de `excluirReunionId` (la que se reagenda, R2.3) no cuenta ni en la elegibilidad ni en el conteo de la semana.
- **I5** · `esZonaValida` acepta lo que `Intl.DateTimeFormat` reconoce (no sólo `Intl.supportedValuesOf`, que trae nombres canónicos) y
  rechaza desfases como `+05:00`, que no son IANA.
- **I6** · `horasParaVisitante` no lanza: con una zona inválida muestra la hora de La Paz. Valida en el borde `esquemaZona`.
- **I7** · `agendada → nueva` sólo la hace el `servidor`: el panel cancela por `cancelar_reunion` (R4.7), que actúa como servidor.
- **I8** · «Después del inicio» es `ahora ≥ inicio` de la reunión, comparando instantes.
- **I9** · R4.5, «completa los campos vacíos»: se llenan los nulos, los `origenes` se unen y nada con valor se pisa. El par de autos se
  trata junto: no entra un valor que deje `autosMeta < autosHoy` (check de §3).
- **I10** · `Persona.ultimaReunionEn` no es columna de `perfiles`: es el **inicio de la última reunión no cancelada** del anfitrión. Lo
  arma `infra/` (P11) o la RPC (P05); si P05 cuenta otra cosa, SQL y TS repartirían distinto.

## Otras

- La asignación de una **solicitud nueva** (§5.6, viñeta 3) no está en el `terminado`: la hace `crear_o_juntar_solicitud` en P05, con
  `repartoParejo` como criterio (que además sirve para los clics de WhatsApp).
- `client.ts` de los dos módulos queda para P11 (no está en los `modulos` de P04).
- `ejemplos.soporte.ts` está en `entities/` y exporta funciones sin test al lado: es el ayudante de los tests (el mapa ya ignora
  `*.soporte.*`) y no sale por `index.ts`.
- `docs/GLOSARIO.md` no cambia: «elegible» y «solicitud repetida» son palabras de la propia semilla; si se quieren en el glosario, va en
  la próxima versión de la semilla.
- El paso de los inicios es fijo de 30 min (X10) y la duración (X2) sólo decide si el inicio cabe en el tramo.
- Se calcula el día de una reunión sólo para las cercanas a la hora candidata (±2 días), para no llamar a `diaEnZona` por cada
  reunión del horizonte en cada inicio.
