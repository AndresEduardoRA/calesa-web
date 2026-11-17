-- La semilla de pruebas (R4.12, semilla §4 › Matriz RLS y §9.7): los usuarios y los datos de ejemplo de la matriz, y el ayudante
-- `pruebas.caso` con que la recorren `supabase/tests/rls-calesa.sql` y `permisos-calesa.sql` (y las pruebas de P05). Va en
-- `[db.seed] sql_paths` de config.toml: existe en local y en `pnpm db:probar`, nunca en la nube (la nube no corre seeds). Los usuarios
-- sólo están en `auth.users` con id y email: no sirven para entrar por enlace mágico.
--
-- Ids fijos (`00000000-0000-4000-8000-0000000000NN`):
--   A  …01 admin (andres@ejemplo.test)         V1 …02 vendedora (carla@ejemplo.test)
--   V2 …03 vendedor (luis@ejemplo.test)        V3 …04 vendedor inactivo (inactivo@ejemplo.test)
--   S1 …11 solicitud de V1 (agendada)          S2 …12 solicitud de V2 (nueva)
--   R1 …21 reunión de S1, anfitriona V1         E1 …41 equipo visible          E2 …42 equipo oculto
--   I1 …51 invitación pendiente de A           LU-01: enlace de prospección de V2 (GT-02 lo crea la fila 30)

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000001', 'andres@ejemplo.test', '{"nombre": "Andrés"}'),
  ('00000000-0000-4000-8000-000000000002', 'carla@ejemplo.test', '{"nombre": "Carla"}'),
  ('00000000-0000-4000-8000-000000000003', 'luis@ejemplo.test', '{"nombre": "Luis"}'),
  ('00000000-0000-4000-8000-000000000004', 'inactivo@ejemplo.test', '{"nombre": "Vendedor Inactivo"}');

insert into public.perfiles (id, nombre, email, rol, whatsapp, enlace_meet, activo, en_turno) values
  ('00000000-0000-4000-8000-000000000001', 'Andrés', 'andres@ejemplo.test', 'admin', null, null, true, false),
  ('00000000-0000-4000-8000-000000000002', 'Carla', 'carla@ejemplo.test', 'vendedor', '+59170000002',
   'https://meet.google.com/abc-defg-hij', true, true),
  ('00000000-0000-4000-8000-000000000003', 'Luis', 'luis@ejemplo.test', 'vendedor', '+59170000003',
   'https://meet.google.com/klm-nopq-rst', true, true),
  ('00000000-0000-4000-8000-000000000004', 'Vendedor Inactivo', 'inactivo@ejemplo.test', 'vendedor', null, null, false, false);

insert into public.solicitudes (id, origen, nombre, email, importadora, pais, whatsapp, autos_hoy, consentimiento_en, asignado_a, estado)
values
  ('00000000-0000-4000-8000-000000000011', 'formulario', 'Cliente Uno', 'cliente1@ejemplo.test', 'Importadora Uno', 'BO',
   '+59171000011', 30, '2026-11-02 12:00Z', '00000000-0000-4000-8000-000000000002', 'agendada'),
  ('00000000-0000-4000-8000-000000000012', 'formulario', 'Cliente Dos', 'cliente2@ejemplo.test', 'Importadora Dos', 'GT',
   '+50271000012', 80, '2026-11-02 13:00Z', '00000000-0000-4000-8000-000000000003', 'nueva');

insert into public.reuniones (id, solicitud_id, anfitrion_id, inicio, fin, zona_visitante, enlace_meet, token_hash) values
  ('00000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000002',
   '2026-11-03 18:00Z', '2026-11-03 18:30Z', 'America/La_Paz', 'https://meet.google.com/abc-defg-hij',
   extensions.digest('r1-prueba', 'sha256'));

insert into public.notas (id, solicitud_id, autor_id, texto) values
  ('00000000-0000-4000-8000-000000000031', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000002',
   'Pidió la demo para el martes.'),
  ('00000000-0000-4000-8000-000000000032', '00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000003',
   'Todavía no contesta.');

insert into public.equipo (id, nombre, cargo, frase, orden, visible) values
  ('00000000-0000-4000-8000-000000000041', 'Persona Visible', 'Ventas', null, 2, true),
  ('00000000-0000-4000-8000-000000000042', 'Persona Oculta', 'Soporte', null, 3, false);

insert into public.enlaces_prospeccion (codigo, etiqueta, creado_por) values
  ('LU-01', 'Importadora Luz', '00000000-0000-4000-8000-000000000003');

insert into public.bloqueos (perfil_id, inicio, fin, motivo, creado_por) values
  ('00000000-0000-4000-8000-000000000003', '2026-11-10 14:00Z', '2026-11-10 16:00Z', 'Médico',
   '00000000-0000-4000-8000-000000000003');

-- Lo que V1 no tiene que ver: sin estas filas, «0 filas» no prueba nada.
insert into public.invitaciones (id, email, invitado_por) values
  ('00000000-0000-4000-8000-000000000051', 'nuevo@ejemplo.test', '00000000-0000-4000-8000-000000000001');
insert into public.eventos (tipo, pagina) values ('clic_agendar', '/');
insert into public.metricas_diarias (dia, solicitudes) values ('2026-11-02', 2);
insert into public.correos_salientes (para, plantilla, estado) values ('cliente1@ejemplo.test', 'confirmacion', 'enviado');
insert into public.latidos (tarea, ultimo_ok) values ('diario', '2026-11-02 06:00Z');
insert into public.auditoria (actor_id, accion, tabla, registro_id, antes, despues) values
  ('00000000-0000-4000-8000-000000000002', 'estado', 'solicitudes', '00000000-0000-4000-8000-000000000011',
   '{"estado": "nueva"}', '{"estado": "agendada"}'),
  ('00000000-0000-4000-8000-000000000003', 'estado', 'solicitudes', '00000000-0000-4000-8000-000000000012',
   '{"estado": "nueva"}', '{"estado": "nueva"}');
insert into public.metricas_persona (dia, perfil_id, solicitudes_asignadas, reuniones_reservadas) values
  ('2026-11-02', '00000000-0000-4000-8000-000000000002', 1, 1),
  ('2026-11-02', '00000000-0000-4000-8000-000000000003', 1, 0);

-- El ayudante. Fuera de `public` y sin acceso para nadie más que quien corre las pruebas: ejecuta SQL con cambio de rol. Es de
-- invocador (sin definidor ni `set`): `set_config('role', …)` no se puede dentro de una función de definidor.
--   p_como:   anon | service_role | A | V1 | V2 | V3 (authenticated con ese usuario) | definer:<X> (no cambia de rol y pone el
--             usuario X: simula una RPC de definidor llamada por X)
--   p_espera: filas=N | error=SSSSS (y sin hint: un grant o una policy) | error=SSSSS:hint (un trigger) | verdad (p_sql da true)
--   p_antes:  corre antes, con el rol de la sesión y sin usuario (un grant de prueba, un dato distinto)
-- En p_sql y p_antes, `{A}`, `{S1}`… se reemplazan por el uuid de la tabla de arriba.
create schema if not exists pruebas;
revoke all on schema pruebas from public;

create or replace function pruebas.caso(p_fila text, p_como text, p_sql text, p_espera text, p_antes text default null)
returns void
language plpgsql
as $$
declare
  v_ids constant jsonb := '{"A": "00000000-0000-4000-8000-000000000001", "V1": "00000000-0000-4000-8000-000000000002",
    "V2": "00000000-0000-4000-8000-000000000003", "V3": "00000000-0000-4000-8000-000000000004",
    "S1": "00000000-0000-4000-8000-000000000011", "S2": "00000000-0000-4000-8000-000000000012",
    "R1": "00000000-0000-4000-8000-000000000021", "E1": "00000000-0000-4000-8000-000000000041",
    "E2": "00000000-0000-4000-8000-000000000042", "I1": "00000000-0000-4000-8000-000000000051"}'::jsonb;
  v_nombre text;
  v_uuid text;
  v_usuario text;
  v_rol text;
  v_filas bigint;
  v_verdad boolean;
  v_estado text;
  v_hint text;
  v_salio text;
begin
  for v_nombre, v_uuid in select key, value from jsonb_each_text(v_ids) loop
    p_sql := replace(p_sql, '{' || v_nombre || '}', quote_literal(v_uuid) || '::uuid');
    p_antes := replace(p_antes, '{' || v_nombre || '}', quote_literal(v_uuid) || '::uuid');
  end loop;
  v_usuario := v_ids ->> regexp_replace(p_como, '^definer:', '');
  v_rol := case
    when p_como like 'definer:%' then null
    when p_como in ('anon', 'service_role') then p_como
    when v_usuario is not null then 'authenticated'
  end;
  if (p_como like 'definer:%' and v_usuario is null) or (p_como not like 'definer:%' and v_rol is null) then
    raise exception 'fila %: no conozco «%»', p_fila, p_como;
  end if;

  -- Sin usuario para lo de antes: un `sub` de una llamada anterior del mismo bloque dispararía reglas que miran auth.uid().
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', '', true);
  perform set_config('request.jwt.claims', '', true);
  if p_antes is not null then
    execute p_antes;
  end if;

  begin
    perform set_config('request.jwt.claim.sub', coalesce(v_usuario, ''), true);
    perform set_config('request.jwt.claim.role', coalesce(v_rol, 'authenticated'), true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', v_usuario, 'role', coalesce(v_rol, 'authenticated'))::text, true);
    if v_rol is not null then
      perform set_config('role', v_rol, true);
    end if;
    if p_espera = 'verdad' then
      execute p_sql into v_verdad;
      v_salio := case when v_verdad then 'verdad' when v_verdad is null then 'nulo' else 'falso' end;
    else
      execute p_sql;
      get diagnostics v_filas = row_count;
      v_salio := 'filas=' || v_filas;
    end if;
    perform set_config('role', 'none', true);
  exception when others then
    -- El bloque que cae deshace sus set_config: vuelve solo al rol de la sesión.
    get stacked diagnostics v_estado = returned_sqlstate, v_hint = pg_exception_hint;
    v_salio := 'error=' || v_estado || case when coalesce(v_hint, '') <> '' then ':' || v_hint else '' end;
  end;
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', '', true);
  perform set_config('request.jwt.claims', '', true);

  if v_salio is distinct from p_espera then
    raise exception 'fila %: se esperaba %, salió %', p_fila, p_espera, v_salio;
  end if;
end;
$$;

revoke all on function pruebas.caso(text, text, text, text, text) from public, anon, authenticated;
