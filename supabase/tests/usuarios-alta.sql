-- El alta del invitado (semilla F5, R4.14, X12; paso P34, C7, C8). `aceptar_invitacion` es del panel (sólo `authenticated`, sin
-- parámetros): con una invitación pendiente y vigente para el correo de la sesión, crea el perfil (vendedor, activo, fuera de turno) con
-- el nombre de la invitación y la marca aceptada; si ya tiene perfil lo devuelve sin mirar invitaciones. Las llamadas corren como
-- postgres con el usuario nuevo puesto en la sesión; los rechazos, con `pruebas.intentar` (definida aquí: `pruebas.error` sólo conoce a
-- A, V1, V2 y V3). Sus grants están en `usuarios-acceso.sql`. A = …01 (admin), V2 = …03, V3 = …04 (inactivo); I1 = …51, invitación
-- pendiente de nuevo@ejemplo.test a nombre de «Persona Nueva».

-- @test acceso: alta · el invitado acepta (correo en otra caja) y nace vendedor, activo y fuera de turno; la segunda vez no cambia (C7, C8)
begin;
do $$
declare
  u constant uuid := '00000000-0000-4000-8000-000000000071';
  i1 constant uuid := '00000000-0000-4000-8000-000000000051';
  r jsonb;
  r2 jsonb;
begin
  insert into auth.users (id, email) values (u, 'NUEVO@ejemplo.test');
  perform set_config('request.jwt.claim.sub', u::text, true);
  r := public.aceptar_invitacion();
  r2 := public.aceptar_invitacion();
  perform set_config('request.jwt.claim.sub', '', true);
  if not pruebas.claves(r, array['perfil', 'nueva'])
     or not pruebas.claves(r -> 'perfil', array['id', 'nombre', 'email', 'rol', 'activo', 'enTurno', 'actualizadoEn'])
     or r ->> 'nueva' <> 'true' or r #>> '{perfil,id}' <> u::text
     or not exists (select 1 from public.perfiles where id = u and rol = 'vendedor' and activo and not en_turno
                      and nombre = 'Persona Nueva' and email::text = 'nuevo@ejemplo.test') then
    raise exception 'el invitado no nació como se espera: %', r;
  end if;
  if not exists (select 1 from public.invitaciones where id = i1 and estado = 'aceptada' and aceptada_en is not null) then
    raise exception 'la invitación no quedó aceptada';
  end if;
  if r2 ->> 'nueva' <> 'false' or r2 -> 'perfil' <> r -> 'perfil' then
    raise exception 'la segunda llamada cambió algo: %', r2;
  end if;
end $$;
rollback;

-- @test acceso: alta rechazada · revocada, vencida, sin invitación, sin sesión o con el correo de otro perfil: E23 y sin perfil (C8)
begin;
create function pruebas.intentar(p_sub uuid, p_sql text)
returns text
language plpgsql
as $f$
declare
  v_e text;
  v_m text;
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_sub::text, ''), true);
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_e = returned_sqlstate, v_m = message_text;
  end;
  perform set_config('request.jwt.claim.sub', '', true);
  return coalesce(v_e || ' ' || v_m, 'ok');
end;
$f$;
do $$
declare
  u constant uuid := '00000000-0000-4000-8000-000000000072';
  w constant uuid := '00000000-0000-4000-8000-000000000073';
  n constant uuid := '00000000-0000-4000-8000-000000000074';
  i1 constant uuid := '00000000-0000-4000-8000-000000000051';
  e23 constant text := '42501 Tu invitación no es válida o venció. Pide otra al administrador.';
begin
  insert into auth.users (id, email) values (u, 'nuevo@ejemplo.test'), (w, 'luis.nuevo@ejemplo.test'), (n, 'nadie@ejemplo.test');
  update public.invitaciones set estado = 'revocada' where id = i1;
  if pruebas.intentar(u, 'select public.aceptar_invitacion()') is distinct from e23 then
    raise exception 'una revocada no dio E23';
  end if;
  update public.invitaciones set estado = 'pendiente', expira_en = now() - interval '1 day' where id = i1;
  if pruebas.intentar(u, 'select public.aceptar_invitacion()') is distinct from e23 then
    raise exception 'una vencida no dio E23';
  end if;
  if pruebas.intentar(n, 'select public.aceptar_invitacion()') is distinct from e23 then
    raise exception 'sin invitación no dio E23';
  end if;
  if pruebas.intentar(null, 'select public.aceptar_invitacion()') is distinct from e23 then
    raise exception 'sin sesión no dio E23';
  end if;
  -- Auth no repite correos: el choque es con un perfil que quedó con un correo que Auth ya no le da (el de V2).
  update public.perfiles set email = 'luis.nuevo@ejemplo.test' where id = '00000000-0000-4000-8000-000000000003';
  insert into public.invitaciones (email, invitado_por, nombre)
  values ('luis.nuevo@ejemplo.test', '00000000-0000-4000-8000-000000000001', 'Luis Otro');
  if pruebas.intentar(w, 'select public.aceptar_invitacion()') is distinct from e23 then
    raise exception 'el correo de otro perfil no dio E23';
  end if;
  if exists (select 1 from public.perfiles where id in (u, w, n)) then
    raise exception 'un rechazo dejó un perfil';
  end if;
end $$;
rollback;

-- @test acceso: desactivado · un perfil inactivo con una invitación pendiente no se reactiva ni la acepta (C8)
begin;
do $$
declare
  v3 constant uuid := '00000000-0000-4000-8000-000000000004';
  v_i uuid;
  r jsonb;
begin
  insert into public.invitaciones (email, invitado_por, nombre)
  values ('inactivo@ejemplo.test', '00000000-0000-4000-8000-000000000001', 'Vendedor Inactivo')
  returning id into v_i;
  perform set_config('request.jwt.claim.sub', v3::text, true);
  r := public.aceptar_invitacion();
  perform set_config('request.jwt.claim.sub', '', true);
  if r ->> 'nueva' <> 'false' or (select activo from public.perfiles where id = v3)
     or (select estado from public.invitaciones where id = v_i) <> 'pendiente' then
    raise exception 'un desactivado se reactivó o aceptó: %', r;
  end if;
end $$;
rollback;

