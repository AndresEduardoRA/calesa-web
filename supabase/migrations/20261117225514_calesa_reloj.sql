-- Calesa · el reloj de la base (paso P38; semilla §9.7 l. 945, R4.22): `public._ahora()` es la hora que leen las funciones y los
-- defaults de `public`. Devuelve `now()` salvo que exista la tabla `reloj` del esquema `pruebas` con su fila: entonces, esa hora, quieta
-- (P1.1). Esa tabla la crea sólo la semilla local `supabase/semillas/reloj.sql` (la nube no corre seeds), así que en producción es
-- siempre `now()`. Ninguna otra migración la nombra: lo vigila `supabase/tests/reloj.test.ts`.
--
-- De definidor: si fuera de invocador, `to_regclass` daría 42501 a un rol sin usage en el esquema de pruebas (authenticated, por un
-- trigger o un default) y la base local se portaría distinto que la nube. Lee la tabla con SQL dinámico para que compilarla no la
-- busque. La ejecutan authenticated (triggers de invocador y defaults de lo que inserta directo) y service_role (P3.1); anon, no.

create function public._ahora()
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ahora timestamptz;
begin
  if to_regclass('pruebas.reloj') is null then
    return now();
  end if;
  execute 'select r.ahora from pruebas.reloj r where r.id = 1' into v_ahora;
  return coalesce(v_ahora, now());
end;
$$;

revoke all on function public._ahora() from public, anon;
grant execute on function public._ahora() to authenticated, service_role;
