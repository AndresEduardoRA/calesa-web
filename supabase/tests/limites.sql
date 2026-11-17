-- El límite de envíos (semilla C7; paso P32, C1–C7 de su plan): `contar_envio(p_clave, p_maximo, p_ventana_segundos)`, la ventana
-- fija de `ContarEnvio`. La tabla de casos repite a propósito `src/shared/lib/seguridad/contador-en-memoria.test.ts` (máximo 2,
-- ventana 3600) y los máximos de `LIMITES` (`limites.ts`): SQL no importa TS, así que si cambia uno, cambia este archivo.
-- `now()` es fijo dentro de la transacción: el tiempo se mueve corriendo `ventana_inicio` hacia atrás como postgres (`limites` no
-- tiene triggers). Una llamada por sentencia: el orden de evaluación dentro de una expresión no está garantizado.
-- Cada bloque deja la base como estaba.

-- @test límites: hasta el máximo dentro de la ventana y después no; cada clave lleva su conteo
begin;
do $$
declare
  v_espera constant boolean[] := array[true, true, false];
  v boolean;
  f public.limites;
begin
  for i in 1 .. array_length(v_espera, 1) loop
    v := public.contar_envio('a', 2, 3600);
    if v is distinct from v_espera[i] then
      raise exception 'a, llamada %: se esperaba %, salió %', i, v_espera[i], v;
    end if;
  end loop;
  select * into f from public.limites where clave = 'a';
  if f.conteo is distinct from 3 or f.ventana_inicio is distinct from now() or f.creado_en is distinct from now() then
    raise exception 'la fila de a quedó con conteo %, ventana % y creado %', f.conteo, f.ventana_inicio, f.creado_en;
  end if;
  v := public.contar_envio('b', 2, 3600);
  if v is distinct from true then raise exception 'b: se esperaba true, salió %', v; end if;
  if (select conteo from public.limites where clave = 'b') is distinct from 1 then
    raise exception 'b no empezó con conteo 1';
  end if;
end $$;
rollback;

-- @test límites: a los 59:59 sigue la misma ventana; a la hora exacta se reinicia con conteo 1
begin;
do $$
declare
  p record;
  v boolean;
  f public.limites;
  v_i int := 0;
begin
  -- mover: cuánto antes de ahora queda `ventana_inicio` antes de llamar (nulo: no se toca); ventana: dónde debe quedar después.
  for p in select * from (values
      ('k', 2, 3600, null::interval, true, 1, 'ahora'),
      ('k', 2, 3600, null, true, 2, 'ahora'),
      ('k', 2, 3600, interval '3599 seconds', false, 3, 'movida'),
      ('k', 2, 3600, interval '3599.999999 seconds', false, 4, 'movida'),
      ('k', 2, 3600, interval '3600 seconds', true, 1, 'ahora'),
      ('k', 2, 3600, null, true, 2, 'ahora'),
      ('k', 2, 3600, null, false, 3, 'ahora'),
      ('m', 1, 60, null, true, 1, 'ahora'),
      ('m', 1, 60, interval '59 seconds', false, 2, 'movida'),
      ('m', 1, 60, interval '60 seconds', true, 1, 'ahora')) x (clave, maximo, ventana, mover, espera, conteo, queda) loop
    v_i := v_i + 1;
    if p.mover is not null then
      update public.limites set ventana_inicio = now() - p.mover where clave = p.clave;
    end if;
    v := public.contar_envio(p.clave, p.maximo, p.ventana);
    select * into f from public.limites where clave = p.clave;
    if v is distinct from p.espera or f.conteo is distinct from p.conteo
       or f.ventana_inicio is distinct from (case p.queda when 'ahora' then now() else now() - p.mover end) then
      raise exception 'paso % (%): se esperaba % con conteo % y ventana %, salió % con conteo % y ventana %', v_i, p.clave,
        p.espera, p.conteo, p.queda, v, f.conteo, now() - f.ventana_inicio;
    end if;
  end loop;

  -- Una fila vieja (la retención la borra a los 2 días) empieza una ventana nueva y no arrastra el conteo.
  insert into public.limites (clave, ventana_inicio, conteo, creado_en)
    values ('v', now() - interval '2 days', 50, now() - interval '2 days');
  v := public.contar_envio('v', 2, 3600);
  select * into f from public.limites where clave = 'v';
  if v is distinct from true or f.conteo is distinct from 1 or f.ventana_inicio is distinct from now()
     or f.creado_en is distinct from now() - interval '2 days' then
    raise exception 'v: salió % con conteo %, ventana % y creado %', v, f.conteo, f.ventana_inicio, f.creado_en;
  end if;
end $$;
rollback;

-- @test límites: los máximos de LIMITES (5/6, 10/11, 30/31, 60/61)
begin;
do $$
declare
  l record;
  v_clave text;
  v boolean;
begin
  for l in select * from (values ('formulario', 5), ('detalle', 5), ('reservas', 10), ('whatsapp', 30), ('eventos', 60))
      x (accion, maximo) loop
    -- La forma real de la clave: `<accion>:<sha256 en hex>`.
    v_clave := l.accion || ':' || encode(extensions.digest('203.0.113.7' || l.accion, 'sha256'), 'hex');
    for i in 1 .. l.maximo loop
      v := public.contar_envio(v_clave, l.maximo, 3600);
      if v is distinct from true then raise exception '%, envío %: se esperaba true, salió %', l.accion, i, v; end if;
    end loop;
    v := public.contar_envio(v_clave, l.maximo, 3600);
    if v is distinct from false then
      raise exception '%, envío %: se esperaba false, salió %', l.accion, l.maximo + 1, v;
    end if;
    if (select conteo from public.limites where clave = v_clave) is distinct from l.maximo + 1 then
      raise exception '%: el conteo no quedó en %', l.accion, l.maximo + 1;
    end if;
  end loop;
end $$;
rollback;

-- @test límites: argumentos inválidos dan 22023 con el parámetro en hint, sin escribir nada
begin;
select pruebas.caso('clave nula', 'service_role', $q$select public.contar_envio(null, 2, 3600)$q$, 'error=22023:p_clave');
select pruebas.caso('clave vacía', 'service_role', $q$select public.contar_envio('', 2, 3600)$q$, 'error=22023:p_clave');
select pruebas.caso('clave de 201', 'service_role', $q$select public.contar_envio(repeat('x', 201), 2, 3600)$q$,
  'error=22023:p_clave');
select pruebas.caso('clave de 200', 'service_role', $q$select public.contar_envio(repeat('x', 200), 2, 3600)$q$, 'verdad');
select pruebas.caso('máximo nulo', 'service_role', $q$select public.contar_envio('c', null, 3600)$q$, 'error=22023:p_maximo');
select pruebas.caso('máximo 0', 'service_role', $q$select public.contar_envio('c', 0, 3600)$q$, 'error=22023:p_maximo');
select pruebas.caso('máximo -1', 'service_role', $q$select public.contar_envio('c', -1, 3600)$q$, 'error=22023:p_maximo');
select pruebas.caso('máximo 1', 'service_role', $q$select public.contar_envio('c1', 1, 3600)$q$, 'verdad');
select pruebas.caso('ventana nula', 'service_role', $q$select public.contar_envio('c', 2, null)$q$,
  'error=22023:p_ventana_segundos');
select pruebas.caso('ventana 0', 'service_role', $q$select public.contar_envio('c', 2, 0)$q$, 'error=22023:p_ventana_segundos');
select pruebas.caso('ventana -1', 'service_role', $q$select public.contar_envio('c', 2, -1)$q$, 'error=22023:p_ventana_segundos');
select pruebas.caso('ventana 86401', 'service_role', $q$select public.contar_envio('c', 2, 86401)$q$,
  'error=22023:p_ventana_segundos');
select pruebas.caso('ventana 1', 'service_role', $q$select public.contar_envio('c2', 2, 1)$q$, 'verdad');
select pruebas.caso('ventana 86400', 'service_role', $q$select public.contar_envio('c3', 2, 86400)$q$, 'verdad');
select pruebas.caso('los tres mal', 'service_role', $q$select public.contar_envio('', 0, 0)$q$, 'error=22023:p_clave');
select pruebas.error('texto de la clave', 'service_role', $q$select public.contar_envio('', 2, 3600)$q$, '22023',
  'La clave del límite de envíos no es válida.');
select pruebas.error('texto del máximo', 'service_role', $q$select public.contar_envio('c', 0, 3600)$q$, '22023',
  'El máximo del límite de envíos tiene que ser 1 o más.');
select pruebas.error('texto de la ventana', 'service_role', $q$select public.contar_envio('c', 2, 0)$q$, '22023',
  'La ventana del límite de envíos va de 1 segundo a 1 día.');
do $$
begin
  -- Sólo escribieron las llamadas válidas.
  if exists (select 1 from public.limites where clave not in (repeat('x', 200), 'c1', 'c2', 'c3')) then
    raise exception 'una llamada inválida escribió en limites: %',
      (select string_agg(left(clave, 20), ', ') from public.limites where clave not in (repeat('x', 200), 'c1', 'c2', 'c3'));
  end if;
end $$;
rollback;

-- @test límites: grants · contar_envio sólo para service_role
begin;
select pruebas.caso('anon', 'anon', $q$select public.contar_envio('g', 2, 3600)$q$, 'error=42501');
select pruebas.caso('vendedor', 'V1', $q$select public.contar_envio('g', 2, 3600)$q$, 'error=42501');
select pruebas.caso('admin', 'A', $q$select public.contar_envio('g', 2, 3600)$q$, 'error=42501');
select pruebas.caso('desactivado', 'V3', $q$select public.contar_envio('g', 2, 3600)$q$, 'error=42501');
select pruebas.caso('servidor', 'service_role', $q$select public.contar_envio('g', 2, 3600)$q$, 'verdad');
do $$
declare
  v_f constant text := 'public.contar_envio(text, integer, integer)';
begin
  if has_function_privilege('anon', v_f, 'execute') then raise exception 'anon puede ejecutar contar_envio'; end if;
  if has_function_privilege('authenticated', v_f, 'execute') then raise exception 'authenticated puede ejecutar contar_envio'; end if;
  if not has_function_privilege('service_role', v_f, 'execute') then raise exception 'service_role no puede ejecutar contar_envio'; end if;
  if exists (select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x
              where p.oid = v_f::regprocedure and x.grantee = 0) then
    raise exception 'PUBLIC puede ejecutar contar_envio';
  end if;
end $$;
rollback;

-- @test límites: forma · definidor, search_path vacío, volátil, una sobrecarga, una sola sentencia sobre limites
do $$
declare
  p record;
  v_n int;
begin
  select count(*) into v_n from pg_proc where pronamespace = 'public'::regnamespace and proname = 'contar_envio';
  if v_n is distinct from 1 then raise exception 'se esperaba una sola public.contar_envio, hay %', v_n; end if;
  select * into p from pg_proc where pronamespace = 'public'::regnamespace and proname = 'contar_envio';
  if not p.prosecdef then raise exception 'contar_envio no es de definidor (prosecdef)'; end if;
  if not coalesce(p.proconfig @> array['search_path=""'], false) then
    raise exception 'contar_envio no fija search_path vacío: %', p.proconfig;
  end if;
  if p.provolatile is distinct from 'v' then raise exception 'contar_envio no es volátil: %', p.provolatile; end if;
  if p.proisstrict then raise exception 'contar_envio es strict: un argumento nulo tiene que dar 22023'; end if;
  if p.prorettype is distinct from 'boolean'::regtype then raise exception 'contar_envio no devuelve boolean'; end if;
  if p.proargnames is distinct from array['p_clave', 'p_maximo', 'p_ventana_segundos'] then
    raise exception 'los argumentos de contar_envio son %', p.proargnames;
  end if;
  -- Una sola sentencia sobre limites (C6): leer y después escribir es una carrera.
  if regexp_count(p.prosrc, 'insert\s+into\s+public\.limites', 1, 'i') is distinct from 1
     or p.prosrc !~* 'on\s+conflict\s*\(\s*clave\s*\)\s+do\s+update' or p.prosrc !~* 'returning' then
    raise exception 'contar_envio no es un solo insert … on conflict (clave) do update … returning';
  end if;
  if p.prosrc ~* 'update\s+public\.limites|from\s+public\.limites|for\s+update|pg_advisory' then
    raise exception 'contar_envio toca limites con más de una sentencia o con un candado';
  end if;
end $$;
