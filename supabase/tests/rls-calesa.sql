-- La matriz RLS de Calesa (semilla §4): un bloque por fila, con la semilla de pruebas (A admin, V1 y V2 vendedores, V3 inactivo,
-- S1 de V1, S2 de V2, R1 de S1, E1 visible, E2 oculto, I1 invitación pendiente). `pruebas.caso(fila, como, sql, espera, antes)`
-- está en `supabase/semillas/pruebas.sql`. «Denegado» es exacto (decisiones de P02): sin grant → `error=42501`; una policy de
-- `with check` → `error=42501`; una de `using` → `filas=0`; el trigger de columnas protegidas → `error=42501:<columna>`. Donde §4
-- dice «0 filas» y el rol no tiene el grant, se espera `42501` (más estricto). Con la respuesta P2 a) de P02, lo que §3 manda por
-- RPC (estado, asignado_a, borrar, config_calculadora) se rechaza directo; el caso permitido lo prueba P05 por su RPC.

-- @test fila 1 · anon · equipo · select: sólo las visibles, por publico.equipo_visible()
begin;
select pruebas.caso('1', 'anon', $$select exists (select 1 from publico.equipo_visible() where id = {E1})
  and not exists (select 1 from publico.equipo_visible() where id = {E2})$$, 'verdad');
rollback;

-- @test filas 2 y 3 · anon · config_calculadora · la lee por publico.config_calculadora(); no la cambia
begin;
select pruebas.caso('2', 'anon', $$select precio = 18000 from publico.config_calculadora()$$, 'verdad');
select pruebas.caso('3', 'anon', $$update public.config_calculadora set precio = 1$$, 'error=42501');
rollback;

-- @test fila 4 · anon · solicitudes · insert: denegado
begin;
select pruebas.caso('4', 'anon', $$insert into public.solicitudes (origen, nombre, email, autos_hoy, consentimiento_en)
  values ('calculadora', 'Visitante', 'visitante@ejemplo.test', 10, now())$$, 'error=42501');
rollback;

-- @test filas 5–7 · anon · solicitudes, perfiles, reuniones · select: denegado
begin;
select pruebas.caso('5', 'anon', $$select count(*) from public.solicitudes$$, 'error=42501');
select pruebas.caso('6', 'anon', $$select count(*) from public.perfiles$$, 'error=42501');
select pruebas.caso('7', 'anon', $$select count(*) from public.reuniones$$, 'error=42501');
rollback;

-- @test fila 8 · V1 · solicitudes · select: sólo las asignadas
begin;
select pruebas.caso('8', 'V1', $$select array_agg(id) = array[{S1}] from public.solicitudes$$, 'verdad');
rollback;

-- @test fila 9 · V1 · solicitudes · update de S1: el estado sólo por RPC (P05); ultimo_contacto_en, directo
begin;
select pruebas.caso('9', 'V1', $$update public.solicitudes set estado = 'realizada' where id = {S1}$$, 'error=42501');
select pruebas.caso('9', 'V1', $$update public.solicitudes set ultimo_contacto_en = now() where id = {S1}$$, 'filas=1');
rollback;

-- @test fila 9b · V1 · solicitudes · ultimo_contacto_en sólo avanza y no va al futuro (la retención de C2 lo lee)
begin;
select pruebas.caso('9b', 'V1', $$update public.solicitudes set ultimo_contacto_en = '2000-01-01Z' where id = {S1}$$,
  'error=42501:ultimo_contacto_en');
select pruebas.caso('9b', 'V1', $$update public.solicitudes set ultimo_contacto_en = now() + interval '1 day' where id = {S1}$$,
  'error=42501:ultimo_contacto_en');
rollback;

-- @test fila 9c · A · solicitudes · con un ultimo_contacto_en futuro (puesto por una RPC), otra columna se sigue editando
begin;
select pruebas.caso('9c', 'A', $$update public.solicitudes set email = 'corregido@ejemplo.test' where id = {S1}$$, 'filas=1',
  $$update public.solicitudes set ultimo_contacto_en = now() + interval '1 day' where id = {S1}$$);
rollback;

-- @test fila 10 · V1 · solicitudes · update de S2: 0 filas (la columna que sí tiene grant; con P2 a), el estado va por RPC)
begin;
select pruebas.caso('10', 'V1', $$update public.solicitudes set ultimo_contacto_en = now() where id = {S2}$$, 'filas=0');
rollback;

-- @test fila 11 · V1 · solicitudes · update asignado_a de S1: el trigger lo rechaza aunque tuviera el grant
begin;
select pruebas.caso('11', 'V1', $$update public.solicitudes set asignado_a = {V2} where id = {S1}$$, 'error=42501:asignado_a',
  $$grant update (asignado_a) on public.solicitudes to authenticated$$);
rollback;

-- @test fila 12 · V1 · solicitudes · update email de S1: trigger (sin solicitudes.editar_contacto)
begin;
select pruebas.caso('12', 'V1', $$update public.solicitudes set email = 'otro@ejemplo.test' where id = {S1}$$, 'error=42501:email');
rollback;

-- @test fila 13 · V1 · solicitudes · delete S1: denegado
begin;
select pruebas.caso('13', 'V1', $$delete from public.solicitudes where id = {S1}$$, 'error=42501');
rollback;

-- @test filas 14 y 15 · V1 · notas · insert en S1 sí, en S2 no
begin;
select pruebas.caso('14', 'V1', $$insert into public.notas (solicitud_id, autor_id, texto) values ({S1}, {V1}, 'Llamar el lunes.')$$,
  'filas=1');
select pruebas.caso('15', 'V1', $$insert into public.notas (solicitud_id, autor_id, texto) values ({S2}, {V1}, 'No es mía.')$$,
  'error=42501');
rollback;

-- @test filas 14b, 21b, 32d y 32e · al insertar, el dueño es quien inserta (C13)
begin;
select pruebas.caso('14b', 'V1', $$insert into public.notas (solicitud_id, autor_id, texto) values ({S1}, {V2}, 'A nombre de otro.')$$,
  'error=42501');
select pruebas.caso('21b', 'V1', $$insert into public.bloqueos (perfil_id, inicio, fin, creado_por)
  values ({V1}, '2026-11-12 14:00Z', '2026-11-12 15:00Z', {V2})$$, 'error=42501');
select pruebas.caso('32d', 'A', $$insert into public.invitaciones (email, invitado_por) values ('otra@ejemplo.test', {V1})$$,
  'error=42501');
select pruebas.caso('32e', 'A', $$insert into public.invitaciones (email, invitado_por) values ('otra@ejemplo.test', {A})$$, 'filas=1');
rollback;

-- @test fila 16 · V1 · notas · select de S2: 0 filas
begin;
select pruebas.caso('16', 'V1', $$select not exists (select 1 from public.notas where solicitud_id = {S2})
  and exists (select 1 from public.notas where solicitud_id = {S1})$$, 'verdad');
rollback;

-- @test filas 17 y 18 · reuniones · select: V1 ve R1, V2 no
begin;
select pruebas.caso('17', 'V1', $$select array_agg(id) = array[{R1}] from public.reuniones$$, 'verdad');
select pruebas.caso('18', 'V2', $$select not exists (select 1 from public.reuniones where id = {R1})$$, 'verdad');
rollback;

-- @test filas 19 y 20 · V1 · reuniones · update estado e inicio de R1: el trigger, aunque hubiera grant y policy
begin;
select pruebas.caso('19', 'V1', $$update public.reuniones set estado = 'cancelada' where id = {R1}$$, 'error=42501:estado',
  $$grant update (estado) on public.reuniones to authenticated;
    create policy prueba_actualizar on public.reuniones for update to authenticated using (true) with check (true)$$);
rollback;
begin;
select pruebas.caso('20', 'V1', $$update public.reuniones set inicio = inicio + interval '1 hour' where id = {R1}$$,
  'error=42501:inicio', $$grant update (inicio) on public.reuniones to authenticated;
    create policy prueba_actualizar on public.reuniones for update to authenticated using (true) with check (true)$$);
rollback;

-- @test filas 21 y 22 · V1 · bloqueos · insert propio sí, para V2 no
begin;
select pruebas.caso('21', 'V1', $$insert into public.bloqueos (perfil_id, inicio, fin, creado_por)
  values ({V1}, '2026-11-12 14:00Z', '2026-11-12 15:00Z', {V1})$$, 'filas=1');
select pruebas.caso('22', 'V1', $$insert into public.bloqueos (perfil_id, inicio, fin, creado_por)
  values ({V2}, '2026-11-12 14:00Z', '2026-11-12 15:00Z', {V1})$$, 'error=42501');
rollback;

-- @test fila 23 · V1 · perfiles · update su whatsapp: permitido
begin;
select pruebas.caso('23', 'V1', $$update public.perfiles set whatsapp = '+59170000001' where id = {V1}$$, 'filas=1');
rollback;

-- @test filas 24 y 25 · V1 · perfiles · su rol y su en_turno: el trigger, aunque tuviera el grant
begin;
select pruebas.caso('24', 'V1', $$update public.perfiles set rol = 'admin' where id = {V1}$$, 'error=42501:rol',
  $$grant update (rol) on public.perfiles to authenticated$$);
select pruebas.caso('25', 'V1', $$update public.perfiles set en_turno = false where id = {V1}$$, 'error=42501:en_turno',
  $$grant update (en_turno) on public.perfiles to authenticated$$);
rollback;

-- @test fila 26 · V1 · perfiles · select V2: 0 filas
begin;
select pruebas.caso('26', 'V1', $$select not exists (select 1 from public.perfiles where id = {V2})$$, 'verdad');
rollback;

-- @test filas 27 y 28 · V1 · horario_base y config_calculadora · update: denegado
begin;
select pruebas.caso('27', 'V1', $$update public.horario_base set hasta = '18:30' where dia_semana = 1 and desde = '14:00'$$,
  'error=42501');
select pruebas.caso('28', 'V1', $$update public.config_calculadora set precio = 1 where id = 1$$, 'error=42501');
rollback;

-- @test fila 29 · V1 · equipo · update E1: 0 filas
begin;
select pruebas.caso('29', 'V1', $$update public.equipo set cargo = 'Otro cargo' where id = {E1}$$, 'filas=0');
rollback;

-- @test filas 30 y 31 · V1 · enlaces_prospeccion · insert propio sí; el de V2 no lo ve
begin;
select pruebas.caso('30', 'V1', $$insert into public.enlaces_prospeccion (codigo, etiqueta, creado_por)
  values ('GT-02', 'Importadora prospecto', {V1})$$, 'filas=1');
select pruebas.caso('31', 'V1', $$select not exists (select 1 from public.enlaces_prospeccion where codigo = 'LU-01')$$, 'verdad');
rollback;

-- @test fila 32 · V1 · invitaciones, eventos, metricas_diarias, correos_salientes, latidos · select: 0 filas
begin;
select pruebas.caso('32', 'V1', $$select not exists (select 1 from public.invitaciones) and not exists (select 1 from public.eventos)
  and not exists (select 1 from public.metricas_diarias) and not exists (select 1 from public.correos_salientes)
  and not exists (select 1 from public.latidos)$$, 'verdad');
rollback;

-- @test filas 32b y 32c · A · invitaciones · update: sólo revocar una pendiente
begin;
select pruebas.caso('32b', 'A', $$update public.invitaciones set estado = 'revocada' where id = {I1}$$, 'filas=1');
rollback;
begin;
select pruebas.caso('32c', 'A', $$update public.invitaciones set estado = 'aceptada' where id = {I1}$$, 'error=42501');
rollback;

-- @test fila 33 · V3 (inactivo) · solicitudes · select: 0 filas aunque tenga asignadas
begin;
select pruebas.caso('33', 'V3', $$select not exists (select 1 from public.solicitudes)$$, 'verdad',
  $$update public.solicitudes set asignado_a = {V3} where id = {S2}$$);
rollback;

-- @test fila 33b · A inactivo · solicitudes · select: un admin inactivo tampoco ve nada (§2: un inactivo no puede nada)
begin;
select pruebas.caso('33b', 'A', $$select not exists (select 1 from public.solicitudes) and not public.tiene_permiso('solicitudes.ver')$$,
  'verdad', $$update public.perfiles set activo = false where id = {A}$$);
rollback;

-- @test fila 34 · A · solicitudes · select: todas
begin;
select pruebas.caso('34', 'A', $$select array_agg(id order by id) = array[{S1}, {S2}] from public.solicitudes$$, 'verdad');
rollback;

-- @test filas 35 y 36 · A · solicitudes · reasignar y borrar: sólo por RPC (P05)
begin;
select pruebas.caso('35', 'A', $$update public.solicitudes set asignado_a = {V2} where id = {S1}$$, 'error=42501');
select pruebas.caso('36', 'A', $$delete from public.solicitudes where id = {S1}$$, 'error=42501');
rollback;

-- @test fila 37 · A · perfiles · update su activo a false: el trigger, aunque tuviera el grant
begin;
select pruebas.caso('37', 'A', $$update public.perfiles set activo = false where id = {A}$$, 'error=42501:activo',
  $$grant update (activo) on public.perfiles to authenticated$$);
rollback;

-- @test filas 37b y 37c · como una RPC llamada por A · perfiles · no puede desactivarse a sí mismo; a V1 sí
begin;
select pruebas.caso('37b', 'definer:A', $$update public.perfiles set activo = false where id = {A}$$, 'error=42501:activo');
select pruebas.caso('37c', 'definer:A', $$update public.perfiles set activo = false where id = {V1}$$, 'filas=1');
rollback;

-- @test fila 38 · A · config_calculadora · update: sólo por RPC (P05)
begin;
select pruebas.caso('38', 'A', $$update public.config_calculadora set precio = 20000 where id = 1$$, 'error=42501');
rollback;

-- @test fila 39 · A · equipo · insert, update y delete: permitido
begin;
select pruebas.caso('39', 'A', $$insert into public.equipo (nombre, cargo, orden) values ('Persona Nueva', 'Ventas', 5)$$, 'filas=1');
select pruebas.caso('39', 'A', $$update public.equipo set visible = true where id = {E2}$$, 'filas=1');
select pruebas.caso('39', 'A', $$delete from public.equipo where id = {E2}$$, 'filas=1');
rollback;

-- @test filas 40 a 42 · storage equipo · subir: anon no, A sí (jpg de 1 MB), V1 no
begin;
select pruebas.caso('40', 'anon', $$insert into storage.objects (bucket_id, name, metadata) values ('equipo',
  'f0e4c2f76c58916ec258f246851bea091d14d4247a2fc3e18694461b1816e13b.jpg', '{"size": 1048576, "mimetype": "image/jpeg"}')$$,
  'error=42501');
select pruebas.caso('41', 'A', $$insert into storage.objects (bucket_id, name, metadata) values ('equipo',
  'f0e4c2f76c58916ec258f246851bea091d14d4247a2fc3e18694461b1816e13b.jpg', '{"size": 1048576, "mimetype": "image/jpeg"}')$$,
  'filas=1');
select pruebas.caso('42', 'V1', $$insert into storage.objects (bucket_id, name, metadata) values ('equipo',
  '5d41402abc4b2a76b9719d911017c592ae2b9c1d5e6f7a8b9c0d1e2f3a4b5c6d.jpg', '{"size": 1048576, "mimetype": "image/jpeg"}')$$,
  'error=42501');
rollback;

-- @test filas 43 y 44 · V1 · auditoria · ve el cambio de S1, no el de S2
begin;
select pruebas.caso('43', 'V1', $$select exists (select 1 from public.auditoria where registro_id = {S1})$$, 'verdad');
select pruebas.caso('44', 'V1', $$select not exists (select 1 from public.auditoria where registro_id = {S2})$$, 'verdad');
rollback;

-- @test filas 45 y 46 · V1 · metricas_persona · las suyas sí, las de V2 no
begin;
select pruebas.caso('45', 'V1', $$select exists (select 1 from public.metricas_persona where perfil_id = {V1})$$, 'verdad');
select pruebas.caso('46', 'V1', $$select not exists (select 1 from public.metricas_persona where perfil_id = {V2})$$, 'verdad');
rollback;

-- @test fila 47 · service_role · reuniones · segunda reunión confirmada de S1: el índice único (R4.15)
begin;
select pruebas.caso('47', 'service_role', $$insert into public.reuniones (solicitud_id, anfitrion_id, inicio, fin, zona_visitante,
  enlace_meet, token_hash) values ({S1}, {V1}, '2026-11-04 18:00Z', '2026-11-04 18:30Z', 'America/La_Paz',
  'https://meet.google.com/abc-defg-hij', extensions.digest('r47', 'sha256'))$$, 'error=23505');
rollback;
