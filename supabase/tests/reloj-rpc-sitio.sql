-- Las RPC del sitio público leen la hora de `public._ahora()` (paso P38): con el reloj fijado en F = lun 2 nov 2026 08:00 La Paz
-- (12:00Z), lo que pasa entre F y hoy es futuro para la base. Cada caso da otro resultado con `now()`, sea cual sea el día en que
-- corre (después de F). Cada bloque fija el reloj y lo suelta con su rollback. V1 = …02, V2 = …03.

-- @test reloj · sitio: _hora_ofrecible mide la anticipación y el horizonte desde la hora fijada
begin;
insert into pruebas.reloj (ahora) values ('2026-11-02 12:00Z');
do $$
declare
  f constant timestamptz := '2026-11-02 12:00Z';
begin
  perform pruebas.abrir_agenda();
  update public.config_agenda set anticipacion_min_horas = 2 where id = 1;
  if not public._hora_ofrecible(f + interval '2 hours') then
    raise exception 'a 2 h justas de la hora fijada (10:00) no se ofrece';
  end if;
  if public._hora_ofrecible(f + interval '90 minutes') then
    raise exception 'a 1 h 30 de la hora fijada (09:30) se ofrece';
  end if;
  if not public._hora_ofrecible(f + interval '21 days') then
    raise exception 'el borde del horizonte (lun 23 nov, 08:00) no se ofrece';
  end if;
  if public._hora_ofrecible(f + interval '21 days 30 minutes') then
    raise exception 'pasado el horizonte (lun 23 nov, 08:30) se ofrece';
  end if;
end $$;
rollback;

-- @test reloj · sitio: datos_para_horas devuelve la hora fijada y el plazo de 30 días para volver a reservar sale de ella
begin;
insert into pruebas.reloj (ahora) values ('2026-11-02 12:00Z');
do $$
declare
  f constant timestamptz := '2026-11-02 12:00Z';
  v2 constant uuid := '00000000-0000-4000-8000-000000000003';
  v_s uuid := pruebas.solicitud('00000000-0000-4000-8000-000000000003');
  v_r uuid;
  r jsonb;
begin
  r := public.datos_para_horas('00000000-0000-4000-8000-000000000012', null);
  if (r ->> 'ahora')::timestamptz is distinct from f then
    raise exception 'datos_para_horas no devolvió la hora fijada: %', r ->> 'ahora';
  end if;
  update public.solicitudes set creado_en = f - interval '29 days' where id = v_s;
  v_r := pruebas.reunion(v_s, v2, f + interval '3 days');
  update public.reuniones set estado = 'cancelada', cancelada_en = f, token_hash = pruebas.token('reloj-a2') where id = v_r;
  r := public.datos_para_horas(null, pruebas.token('reloj-a2'));
  if (r #>> '{reunion,puedeVolverAReservar}')::boolean is distinct from true then
    raise exception 'a 29 días de la hora fijada no puede volver a reservar: %', r -> 'reunion';
  end if;
end $$;
rollback;

-- @test reloj · sitio: el plazo de 2 h para cancelar por enlace se mide desde la hora fijada (el borde incluido)
begin;
insert into pruebas.reloj (ahora) values ('2026-11-02 12:00Z');
do $$
declare
  f constant timestamptz := '2026-11-02 12:00Z';
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  v2 constant uuid := '00000000-0000-4000-8000-000000000003';
  v_justa uuid := pruebas.reunion(pruebas.solicitud('00000000-0000-4000-8000-000000000002', 'agendada'), v1, f + interval '2 hours');
  v_tarde uuid := pruebas.reunion(pruebas.solicitud('00000000-0000-4000-8000-000000000003', 'agendada'), v2,
    f + interval '1 hour 59 minutes');
  v_act timestamptz;
begin
  update public.reuniones set token_hash = pruebas.token('reloj-a3') where id = v_justa returning actualizado_en into v_act;
  perform public.cancelar_reunion(pruebas.token('reloj-a3'), v_act);
  if (select estado from public.reuniones where id = v_justa) is distinct from 'cancelada' then
    raise exception 'a 2 h justas de la hora fijada no se canceló';
  end if;
  update public.reuniones set token_hash = pruebas.token('reloj-a3-tarde') where id = v_tarde returning actualizado_en into v_act;
  perform pruebas.error('a 1 h 59 de la hora fijada', 'service_role', format('select public.cancelar_reunion(%L, %L)',
    pruebas.token('reloj-a3-tarde'), v_act), 'P0001', 'Ya no se puede cambiar en línea. Escríbenos por WhatsApp.');
end $$;
rollback;

-- @test reloj · sitio: contar_envio abre la ventana en la hora fijada y una ventana viva a esa hora sigue contando
begin;
insert into pruebas.reloj (ahora) values ('2026-11-02 12:00Z');
do $$
declare
  f constant timestamptz := '2026-11-02 12:00Z';
  v_permitido boolean;
begin
  -- En dos sentencias: la que llama a contar_envio no ve la fila que escribe.
  v_permitido := public.contar_envio('reloj:nueva', 1, 3600);
  if not v_permitido or (select l.ventana_inicio from public.limites l where l.clave = 'reloj:nueva') is distinct from f then
    raise exception 'la ventana nueva no empezó en la hora fijada';
  end if;
  insert into public.limites (clave, ventana_inicio, conteo) values ('reloj:viva', f - interval '30 minutes', 1);
  v_permitido := public.contar_envio('reloj:viva', 1, 3600);
  if v_permitido or (select l.conteo from public.limites l where l.clave = 'reloj:viva') <> 2 then
    raise exception 'una ventana viva a la hora fijada empezó de nuevo';
  end if;
end $$;
rollback;

-- @test reloj · sitio: crear_o_juntar_solicitud junta la abierta de hace 29 días y pone el último contacto en la hora fijada
begin;
insert into pruebas.reloj (ahora) values ('2026-11-02 12:00Z');
do $$
declare
  f constant timestamptz := '2026-11-02 12:00Z';
  v_s uuid := pruebas.solicitud('00000000-0000-4000-8000-000000000002');
  v_email text;
  r jsonb;
begin
  update public.solicitudes set creado_en = f - interval '29 days', ultimo_contacto_en = f - interval '29 days' where id = v_s
  returning email::text into v_email;
  r := public.crear_o_juntar_solicitud('formulario', 'Cliente Repetido', v_email, f, 'Importadora Prueba', 'BO', '+59171000099', 10,
    p_vendedores => 3);
  if (r ->> 'juntada')::boolean is distinct from true or (r ->> 'id')::uuid is distinct from v_s then
    raise exception 'la abierta de hace 29 días (desde la hora fijada) no se juntó: %', r;
  end if;
  if (select s.ultimo_contacto_en from public.solicitudes s where s.id = v_s) is distinct from f then
    raise exception 'juntar no puso el último contacto en la hora fijada';
  end if;
  r := public.crear_o_juntar_solicitud('formulario', 'Cliente Nuevo', 'reloj-nuevo@ejemplo.test', f, 'Importadora Nueva', 'BO',
    '+59171000098', 12);
  if (r ->> 'juntada')::boolean is distinct from false
     or (select s.ultimo_contacto_en from public.solicitudes s where s.id = (r ->> 'id')::uuid) is distinct from f then
    raise exception 'la solicitud nueva no tiene el último contacto en la hora fijada: %', r;
  end if;
end $$;
rollback;

-- @test reloj · sitio: _elegir_asignado cuenta las solicitudes de la semana de la hora fijada
begin;
insert into pruebas.reloj (ahora) values ('2026-11-02 12:00Z');
do $$
declare
  f constant timestamptz := '2026-11-02 12:00Z';
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  v2 constant uuid := '00000000-0000-4000-8000-000000000003';
  v_de_la_semana uuid := pruebas.solicitud('00000000-0000-4000-8000-000000000002');
  v_hoy_1 uuid := pruebas.solicitud('00000000-0000-4000-8000-000000000003');
  v_hoy_2 uuid := pruebas.solicitud('00000000-0000-4000-8000-000000000003');
begin
  -- V1: una en la semana de F; V2: dos de hoy (y las de la semilla, de hoy). Con F elige a V2; con now(), a V1.
  update public.solicitudes set creado_en = f + interval '1 day' where id = v_de_la_semana;
  update public.solicitudes set creado_en = now() where id = v_hoy_1 or id = v_hoy_2;
  if public._elegir_asignado() is distinct from v2 then
    raise exception 'el reparto no contó la semana de la hora fijada: eligió %', public._elegir_asignado();
  end if;
end $$;
rollback;

-- @test reloj · sitio: elegir_whatsapp cuenta los clics de la semana de la hora fijada
begin;
insert into pruebas.reloj (ahora) values ('2026-11-02 12:00Z');
do $$
declare
  f constant timestamptz := '2026-11-02 12:00Z';
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  v2 constant uuid := '00000000-0000-4000-8000-000000000003';
  r jsonb;
begin
  insert into public.eventos (tipo, pagina, perfil_id, creado_en) values
    ('clic_whatsapp', '/', v1, f + interval '1 day'), ('clic_whatsapp', '/', v2, now()), ('clic_whatsapp', '/', v2, now());
  r := public.elegir_whatsapp('/');
  if (r ->> 'perfilId')::uuid is distinct from v2 then
    raise exception 'el WhatsApp no contó la semana de la hora fijada: %', r;
  end if;
end $$;
rollback;
