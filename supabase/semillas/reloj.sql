-- El reloj fijo de las pruebas locales (paso P38; semilla §9.7 l. 945): con su fila, `public._ahora()` devuelve esa hora en vez de
-- now(). Va en `[db.seed] sql_paths` de config.toml, después de `pruebas.sql` (que crea el esquema y se lo quita a PUBLIC): existe en
-- local y en `pnpm db:probar`, nunca en la nube. Nace vacía, así nada cambia hasta que una prueba fija la hora. Sólo la toca su dueño
-- (postgres): sin usage en el esquema ni grants para anon, authenticated ni service_role, y con RLS sin policies.
--
-- El contrato del e2e, como postgres (`e2e/soporte/sql.ts`):
--   fijar:  insert into pruebas.reloj (ahora) values ($1) on conflict (id) do update set ahora = excluded.ahora;
--   soltar: delete from pruebas.reloj where id = 1;
-- La hora queda quieta hasta que se mueve o se suelta (P1.1). Toda prueba que la fija la suelta al terminar.
create schema if not exists pruebas;

create table if not exists pruebas.reloj (
  id smallint primary key default 1 check (id = 1),
  ahora timestamptz not null
);

alter table pruebas.reloj enable row level security;
revoke all on table pruebas.reloj from public, anon, authenticated, service_role;
