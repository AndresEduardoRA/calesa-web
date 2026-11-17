-- El reloj de la base (paso P38; semilla §9.7 l. 945): `public._ahora()` es `now()` salvo que exista la tabla `reloj` del esquema
-- `pruebas` con su fila, que crea sólo la semilla local `semillas/reloj.sql` (vacía). Corre después de las demás pruebas del reloj (por
-- nombre): el bloque de la tabla vacía también descubre una fila que se escapó de su bloque. F = lun 2 nov 2026 08:00 La Paz.

-- @test reloj: sin el esquema pruebas, _ahora() es now()
begin;
drop schema pruebas cascade;
-- Sin el esquema no hay `pruebas.caso`: la afirmación va suelta.
do $$
begin
  if public._ahora() is distinct from now() then
    raise exception 'sin el esquema pruebas, _ahora() no es now(): %', public._ahora();
  end if;
end $$;
rollback;

-- @test reloj: sin la tabla, to_regclass no la encuentra y _ahora() es now()
begin;
drop table pruebas.reloj;
do $$
begin
  if to_regclass('pruebas.reloj') is not null then
    raise exception 'la tabla del reloj sigue ahí';
  end if;
  if public._ahora() is distinct from now() then
    raise exception 'sin la tabla, _ahora() no es now(): %', public._ahora();
  end if;
end $$;
rollback;

-- @test reloj: la semilla la crea vacía y con la tabla vacía _ahora() es now()
begin;
do $$
begin
  if to_regclass('pruebas.reloj') is null then
    raise exception 'la semilla local no creó la tabla del reloj';
  end if;
  if exists (select 1 from pruebas.reloj) then
    raise exception 'la tabla del reloj no está vacía: la semilla la llenó o una prueba no soltó el reloj';
  end if;
  if public._ahora() is distinct from now() then
    raise exception 'con la tabla vacía, _ahora() no es now(): %', public._ahora();
  end if;
end $$;
rollback;

-- @test reloj: con la fila, _ahora() es su hora para postgres, authenticated y service_role; fijar es un upsert y soltar, un delete
begin;
insert into pruebas.reloj (ahora) values ('2026-11-02 12:00Z');
do $$
begin
  if public._ahora() is distinct from '2026-11-02 12:00Z'::timestamptz then
    raise exception 'con la fila, _ahora() no es la hora fijada: %', public._ahora();
  end if;
  perform pruebas.caso('V1 lee la hora fijada', 'V1', $q$select public._ahora() = '2026-11-02 12:00Z'::timestamptz$q$, 'verdad');
  perform pruebas.caso('service_role lee la hora fijada', 'service_role',
    $q$select public._ahora() = '2026-11-02 12:00Z'::timestamptz$q$, 'verdad');
  -- Quieto: dos lecturas dan lo mismo aunque pase el tiempo real.
  if public._ahora() is distinct from public._ahora() then
    raise exception 'el reloj fijado se movió';
  end if;
end $$;
-- El contrato del e2e (como postgres): fijar otra hora es el mismo upsert; soltar, el delete con where.
insert into pruebas.reloj (ahora) values ('2026-11-09 15:30Z') on conflict (id) do update set ahora = excluded.ahora;
do $$
begin
  if public._ahora() is distinct from '2026-11-09 15:30Z'::timestamptz or (select count(*) from pruebas.reloj) <> 1 then
    raise exception 'el upsert no movió el reloj: %', public._ahora();
  end if;
end $$;
delete from pruebas.reloj where id = 1;
do $$
begin
  if public._ahora() is distinct from now() then
    raise exception 'soltado el reloj, _ahora() no volvió a now(): %', public._ahora();
  end if;
end $$;
rollback;

-- @test reloj: nadie del API llega a la tabla del reloj (sin usage en el esquema, sin grants, RLS encendida)
begin;
do $$
declare
  v_rol text;
begin
  foreach v_rol in array array['anon', 'authenticated', 'service_role'] loop
    if has_schema_privilege(v_rol, 'pruebas', 'usage, create') then
      raise exception '% tiene usage o create en el esquema pruebas', v_rol;
    end if;
    if has_table_privilege(v_rol, 'pruebas.reloj', 'select, insert, update, delete, truncate, references, trigger') then
      raise exception '% tiene un privilegio sobre la tabla del reloj', v_rol;
    end if;
  end loop;
  if not (select c.relrowsecurity from pg_class c where c.oid = 'pruebas.reloj'::regclass) then
    raise exception 'la tabla del reloj no tiene RLS';
  end if;
  perform pruebas.caso('anon no lee el reloj', 'anon', 'select * from pruebas.reloj', 'error=42501');
  perform pruebas.caso('V1 no lee el reloj', 'V1', 'select * from pruebas.reloj', 'error=42501');
  perform pruebas.caso('V1 no fija el reloj', 'V1', $q$insert into pruebas.reloj (ahora) values (now())$q$, 'error=42501');
  perform pruebas.caso('service_role no fija el reloj', 'service_role', $q$insert into pruebas.reloj (ahora) values (now())$q$,
    'error=42501');
end $$;
rollback;

-- @test reloj: _ahora() es de definidor, stable, con search_path vacío y la ejecutan authenticated y service_role (no anon)
begin;
do $$
begin
  if not exists (select 1 from pg_proc p
                  where p.oid = 'public._ahora()'::regprocedure and p.prosecdef and p.proconfig = array['search_path=""']
                    and p.provolatile = 's' and p.prorettype = 'timestamptz'::regtype) then
    raise exception '_ahora() no es de definidor, stable, con search_path vacío y timestamptz';
  end if;
  if not has_function_privilege('authenticated', 'public._ahora()', 'execute')
     or not has_function_privilege('service_role', 'public._ahora()', 'execute') then
    raise exception 'authenticated o service_role no ejecutan _ahora()';
  end if;
  if has_function_privilege('anon', 'public._ahora()', 'execute') then
    raise exception 'anon ejecuta _ahora()';
  end if;
end $$;
rollback;
