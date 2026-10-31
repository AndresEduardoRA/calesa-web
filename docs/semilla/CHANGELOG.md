# CHANGELOG · calesa-web

## v1 · 2026-10-31
- Primera semilla: sitio de marketing + agenda propia por turnos + panel con roles admin/vendedor.
- 105 decisiones en registro.md (3 rondas), 0 abiertas.
- plan.yaml: 19 pasos en 11 carriles; 12 rojos con Opus xhigh y revisor en sesión nueva.
- Validador: 0 errores, 0 avisos. Generada con Opus 5.5 · high (confirmado por el dueño).

## v2 · 2026-10-31
- X11: la regla de US$ 25 por auto extra sale de la web (queda para la propuesta).
- C5: responsable con domicilio en Santa Cruz de la Sierra, Bolivia; ley y tribunales de Bolivia; el abogado confirma si hace falta la dirección completa.
- X14: cuenta del admin alpiryk@gmail.com.
- Validador: 0 errores, 0 avisos.

## v3 · 2026-10-31
- Ronda 4 desde la auditoría independiente (Fable 5.1): 9 contradicciones y 20 huecos cerrados (R4.1–R4.22).
- Dueño: vendedor reagenda y cancela lo suyo; reasignación mueve la reunión si hay hueco; desactivación sin reemplazo pasa al admin; vendedor ve su embudo e historial; solicitudes repetidas se juntan; hosting Vercel Pro (presupuesto ~US$ 45/mes).
- Técnica: Vercel Cron reemplaza pg_cron/pg_net; máquina de estados en trigger; métricas por persona; latidos; /api/horas; plantillas con identificador (12); zona IANA libre; ejemplo de Santiago con cambio de horario.
- plan.yaml: dependencias corregidas (P08←P02, P09←P11, P14←P05, P16←P07; retención probada en P05).
- registro.md: filas pegadas y líneas en blanco corregidas.
- Validador: 0 errores, 0 avisos.

## v4 · 2026-10-31
- Costo de ~US$ 45 a ~US$ 20/mes: solo Vercel Pro; Supabase, Resend y Turnstile en plan gratis (G1, X13).
- Sin cron por minuto: correos al momento de la acción; recordatorios y aviso de 15 min programados en Resend; un solo cron diario (X6, R4.22).
- Respaldo diario cifrado y restauración semanal automática con GitHub Actions (X13).
- Imágenes sin optimización paga (R5.1), aviso de cupos gratis (R5.2), webhook de rebotes de Resend (R5.3).
- Validador: 0 errores, 0 avisos.

## v5 · 2026-10-31
- X15: Node 24 o más reciente (requisito del kit de semilla-a-repo).
- ESTADO.md dice explícitamente que la auditoría independiente se hizo.
- Validador: 0 errores, 0 avisos.

## v6 · 2026-10-31
- X16: §8.7 con los nombres de token del contrato del kit (`design/tokens.css`) y los valores de Calesa; tema oscuro como `.dark`; `descripcion` y `carriles_max: 3` en el frontmatter.
- Validador: 0 errores, 0 avisos. Réplica del ensayo de semilla-a-repo (`nuevo-proyecto.mjs --en-seco` con el código real del kit): pasa.

## v7 · 2026-10-31
- X17: alineada con el kit de semilla-a-repo (AGENTS.md y .claude/rules): módulos en src/modules (acceso, planes, calculadora, solicitudes, agenda, notificaciones, prospeccion, equipo, medicion, sitio), src/shared, e2e/, comandos del kit, correo por enviarEmail() con adaptador resend, catálogo de permisos con puede(), escrituras sensibles solo por RPC con PT409, notas en docs/pasos/<PASO>/.
- §9 y §10 reescritos; plan.yaml con 22 pasos en 11 carriles y verificaciones con los comandos reales del kit (pnpm lint, typecheck, test, db:probar, test:e2e, test:e2e:completo, mapa.sh --check).
- Login en /entrar; variables de correo con los nombres del kit (EMAIL_*).
- Validador: 0 errores, 0 avisos. Réplica del ensayo del kit: pasa.
