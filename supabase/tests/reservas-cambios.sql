-- Cambiar y cancelar una demo (semilla §5.8, B13, B15, R2.3, R4.1, R4.16; paso P05, C13–C15, C20, C21): por el enlace del visitante
-- (sólo service_role, corren como postgres) y desde el panel (sólo authenticated, con `pruebas.caso` y `pruebas.error`). V1 = …02,
-- V2 = …03, A = …01. Cada bloque deja la base como estaba.

-- @test cambios: por enlace se mantiene el anfitrión libre, sube la secuencia del .ics y queda la reagenda
begin;
do $$
declare
  r jsonb;
begin
  perform pruebas.abrir_agenda();
  r := public.reservar_reunion(pruebas.solicitud('00000000-0000-4000-8000-000000000003'), null, pruebas.hora(3, '09:00'),
    'America/La_Paz', pruebas.token('c1'));
  r := public.cambiar_reunion(pruebas.token('c1'), pruebas.hora(3, '11:00'), (r #>> '{reunion,actualizadoEn}')::timestamptz);
  if (r #>> '{anfitrion,id}')::uuid is distinct from '00000000-0000-4000-8000-000000000003' or r #>> '{reunion,secuenciaIcs}' is distinct from '1'
     or (r #>> '{reunion,inicio}')::timestamptz is distinct from pruebas.hora(3, '11:00') or r -> 'anfitrionAnterior' is distinct from 'null' then
    raise exception 'el cambio no mantuvo al anfitrión: %', r;
  end if;
  if not exists (select 1 from public.auditoria where accion = 'reagenda' and registro_id = (r #>> '{reunion,id}')::uuid) then
    raise exception 'el cambio no quedó auditado';
  end if;
end $$;
rollback;

-- @test cambios: por enlace, si el anfitrión no está libre, pasa a otro con su Meet y la solicitud pasa a él (R2.3, B13)
begin;
do $$
declare
  v_s uuid := pruebas.solicitud('00000000-0000-4000-8000-000000000003');
  r jsonb;
begin
  perform pruebas.abrir_agenda();
  r := public.reservar_reunion(v_s, null, pruebas.hora(3, '09:00'), 'America/La_Paz', pruebas.token('c2'));
  insert into public.bloqueos (perfil_id, inicio, fin, creado_por) values ('00000000-0000-4000-8000-000000000003',
    pruebas.hora(3, '11:00'), pruebas.hora(3, '12:00'), '00000000-0000-4000-8000-000000000003');
  r := public.cambiar_reunion(pruebas.token('c2'), pruebas.hora(3, '11:00'), (r #>> '{reunion,actualizadoEn}')::timestamptz);
  if (r #>> '{anfitrion,id}')::uuid is distinct from '00000000-0000-4000-8000-000000000002'
     or r #>> '{anfitrionAnterior,id}' is distinct from '00000000-0000-4000-8000-000000000003'
     or not pruebas.claves(r -> 'anfitrionAnterior', array['id', 'nombre', 'email'])
     or r #>> '{reunion,enlaceMeet}' is distinct from 'https://meet.google.com/abc-defg-hij'
     or (select asignado_a from public.solicitudes where id = v_s) is distinct from '00000000-0000-4000-8000-000000000002' then
    raise exception 'el cambio no pasó la reunión a V1: %', r;
  end if;
end $$;
rollback;

-- @test cambios: plazo de B15 · a menos de 2 h el enlace ya no cambia ni cancela (el panel sí); a 2 h justas, cancela
begin;
do $$
declare
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  v_r uuid := pruebas.reunion(pruebas.solicitud(v1, 'agendada'), v1, now() + interval '90 minutes');
  v_act timestamptz;
begin
  update public.reuniones set token_hash = pruebas.token('plazo') where id = v_r returning actualizado_en into v_act;
  perform pruebas.error('cambiar tarde', 'service_role', format('select public.cambiar_reunion(%L, %L, %L)', pruebas.token('plazo'),
    pruebas.hora(3, '09:00'), v_act), 'P0001', 'Ya no se puede cambiar en línea. Escríbenos por WhatsApp.');
  perform pruebas.error('cancelar tarde', 'service_role', format('select public.cancelar_reunion(%L, %L)', pruebas.token('plazo'),
    v_act), 'P0001', 'Ya no se puede cambiar en línea. Escríbenos por WhatsApp.');
  perform pruebas.caso('el panel cancela', 'V1', format($f$select public.cancelar_reunion_panel(%L, %L) #>> '{reunion,estado}'
    = 'cancelada'$f$, v_r, v_act), 'verdad');
  v_r := pruebas.reunion(pruebas.solicitud(v1, 'agendada'), v1, now() + interval '2 hours');
  update public.reuniones set token_hash = pruebas.token('borde') where id = v_r returning actualizado_en into v_act;
  if public.cancelar_reunion(pruebas.token('borde'), v_act) #>> '{reunion,estado}' is distinct from 'cancelada' then
    raise exception 'a 2 h justas no se pudo cancelar';
  end if;
end $$;
rollback;

-- @test cambios: el admin de respaldo cede al cambiar por enlace si hay un vendedor libre (P3); si no, sigue
begin;
do $$
declare
  a constant uuid := '00000000-0000-4000-8000-000000000001';
  v_r uuid;
  r jsonb;
begin
  perform pruebas.abrir_agenda();
  update public.perfiles set whatsapp = '+59170000001', enlace_meet = 'https://meet.google.com/adm-inis-tra', en_turno = true
   where id = a;
  insert into public.bloqueos (perfil_id, inicio, fin, creado_por) values
    ('00000000-0000-4000-8000-000000000003', pruebas.hora(4, '11:00'), pruebas.hora(4, '12:00'), a),
    ('00000000-0000-4000-8000-000000000002', pruebas.hora(5, '11:00'), pruebas.hora(5, '12:00'), a),
    ('00000000-0000-4000-8000-000000000003', pruebas.hora(5, '11:00'), pruebas.hora(5, '12:00'), a);
  v_r := pruebas.reunion(pruebas.solicitud(a, 'agendada'), a, pruebas.hora(4, '09:00'));
  update public.reuniones set token_hash = pruebas.token('adm-1') where id = v_r;
  r := public.cambiar_reunion(pruebas.token('adm-1'), pruebas.hora(4, '11:00'), (select actualizado_en from public.reuniones
    where id = v_r));
  if (r #>> '{anfitrion,id}')::uuid is distinct from '00000000-0000-4000-8000-000000000002' then
    raise exception 'el admin no cedió la reunión al vendedor libre: %', r;
  end if;
  v_r := pruebas.reunion(pruebas.solicitud(a, 'agendada'), a, pruebas.hora(5, '09:00'));
  update public.reuniones set token_hash = pruebas.token('adm-2') where id = v_r;
  r := public.cambiar_reunion(pruebas.token('adm-2'), pruebas.hora(5, '11:00'), (select actualizado_en from public.reuniones
    where id = v_r));
  if (r #>> '{anfitrion,id}')::uuid is distinct from a then
    raise exception 'sin vendedores libres la reunión no siguió con el admin: %', r;
  end if;
end $$;
rollback;

-- @test cambios: conflicto · con actualizado_en viejo, cambiar y cancelar dan PT409
begin;
do $$
begin
  perform pruebas.abrir_agenda();
  perform public.reservar_reunion(pruebas.solicitud('00000000-0000-4000-8000-000000000003'), null, pruebas.hora(3, '09:00'),
    'America/La_Paz', pruebas.token('conf'));
  perform pruebas.error('cambiar viejo', 'service_role', format('select public.cambiar_reunion(%L, %L, %L)', pruebas.token('conf'),
    pruebas.hora(3, '11:00'), '2000-01-01Z'), 'PT409',
    'Esta demo o solicitud cambió mientras la mirabas. Recarga para ver lo último.');
  perform pruebas.error('cancelar viejo', 'service_role', format('select public.cancelar_reunion(%L, %L)', pruebas.token('conf'),
    '2000-01-01Z'), 'PT409', 'Esta demo o solicitud cambió mientras la mirabas. Recarga para ver lo último.');
  perform pruebas.caso('sin versión', 'service_role', format('select public.cancelar_reunion(%L, null)', pruebas.token('conf')),
    'error=22023:p_actualizado_en_esperado');
end $$;
rollback;

-- @test cambios: cancelar por enlace deja la reunión cancelada, la solicitud nueva y la cancelación sin actor; otra vez da E8
begin;
do $$
declare
  v_s uuid := pruebas.solicitud('00000000-0000-4000-8000-000000000003');
  r jsonb;
begin
  perform pruebas.abrir_agenda();
  r := public.reservar_reunion(v_s, null, pruebas.hora(3, '09:00'), 'America/La_Paz', pruebas.token('canc'));
  r := public.cancelar_reunion(pruebas.token('canc'), (r #>> '{reunion,actualizadoEn}')::timestamptz);
  if r #>> '{reunion,estado}' is distinct from 'cancelada' or (select estado from public.solicitudes where id = v_s) is distinct from 'nueva'
     or not exists (select 1 from public.auditoria where accion = 'cancelacion' and actor_id is null
                     and registro_id = (r #>> '{reunion,id}')::uuid) then
    raise exception 'la cancelación no dejó lo esperado: %', r;
  end if;
  perform pruebas.error('otra vez', 'service_role', format('select public.cancelar_reunion(%L, %L)', pruebas.token('canc'), now()),
    'P0001', 'Esta demo ya no está confirmada.');
  perform pruebas.error('token inexistente', 'service_role', format('select public.cancelar_reunion(%L, %L)',
    pruebas.token('no-existe'), now()), 'P0001', 'Este enlace no es válido.');
end $$;
rollback;

-- @test cambios: volver a reservar con el token cancelado (R4.16, P2) · reunión nueva con su token; el viejo la gestiona; 30 días
begin;
do $$
declare
  v_s uuid := pruebas.solicitud('00000000-0000-4000-8000-000000000003');
  r jsonb;
begin
  perform pruebas.abrir_agenda();
  r := public.reservar_reunion(v_s, null, pruebas.hora(3, '09:00'), 'America/La_Paz', pruebas.token('viejo'));
  perform public.cancelar_reunion(pruebas.token('viejo'), (r #>> '{reunion,actualizadoEn}')::timestamptz);
  r := public.reservar_reunion(null, pruebas.token('viejo'), pruebas.hora(4, '09:00'), 'America/La_Paz', pruebas.token('nuevo'));
  if (select token_hash from public.reuniones where id = (r #>> '{reunion,id}')::uuid) is distinct from pruebas.token('nuevo')
     or r #>> '{reunion,estado}' is distinct from 'confirmada' then
    raise exception 'volver a reservar no creó la reunión nueva con su token: %', r;
  end if;
  r := public.cambiar_reunion(pruebas.token('viejo'), pruebas.hora(4, '11:00'), (r #>> '{reunion,actualizadoEn}')::timestamptz);
  if (select inicio from public.reuniones where token_hash = pruebas.token('nuevo')) is distinct from pruebas.hora(4, '11:00') then
    raise exception 'el token viejo no movió la reunión vigente';
  end if;
  perform public.cancelar_reunion(pruebas.token('nuevo'), (r #>> '{reunion,actualizadoEn}')::timestamptz);
  update public.solicitudes set creado_en = now() - interval '31 days' where id = v_s;
  perform pruebas.error('vencido', 'service_role', format('select public.reservar_reunion(null, %L, %L, %L, %L)',
    pruebas.token('viejo'), pruebas.hora(5, '09:00'), 'America/La_Paz', pruebas.token('otro')), 'P0001',
    'El enlace venció. Vuelve a llenar el formulario.');
  perform pruebas.error('inexistente', 'service_role', format('select public.reservar_reunion(null, %L, %L, %L, %L)',
    pruebas.token('no-existe'), pruebas.hora(5, '09:00'), 'America/La_Paz', pruebas.token('otro')), 'P0001',
    'Este enlace no es válido.');
end $$;
rollback;

-- @test cambios: desde el panel (R4.1, P1, P5) · sólo en las horas del anfitrión, con reuniones.cambiar sobre esa reunión
begin;
do $$
declare
  v1 constant uuid := '00000000-0000-4000-8000-000000000002';
  r jsonb;
  v_id uuid;
  v_act timestamptz;
begin
  perform pruebas.abrir_agenda();
  r := public.reservar_reunion(pruebas.solicitud(v1), null, pruebas.hora(3, '09:00'), 'America/La_Paz', pruebas.token('panel'));
  v_id := (r #>> '{reunion,id}')::uuid;
  v_act := (r #>> '{reunion,actualizadoEn}')::timestamptz;
  insert into public.bloqueos (perfil_id, inicio, fin, creado_por) values (v1, pruebas.hora(3, '11:00'), pruebas.hora(3, '12:00'), v1);
  perform pruebas.error('V1 bloqueado', 'V1', format('select public.cambiar_reunion_panel(%L, %L, %L)', v_id,
    pruebas.hora(3, '11:00'), v_act), 'P0001', 'Esa hora se acaba de ocupar. Elige otra.');
  perform pruebas.error('V2 ajena', 'V2', format('select public.cambiar_reunion_panel(%L, %L, %L)', v_id, pruebas.hora(3, '14:00'),
    v_act), '42501', 'No puedes cambiar esta reunión.');
  perform pruebas.error('V3 inactivo', 'V3', format('select public.cancelar_reunion_panel(%L, %L)', v_id, v_act), '42501',
    'No puedes cambiar esta reunión.');
  perform pruebas.error('fuera de turno', 'V1', format('select public.cambiar_reunion_panel(%L, %L, %L)', v_id,
    pruebas.hora(3, '14:00'), v_act), 'P0001', 'Esa hora se acaba de ocupar. Elige otra.',
    format('update public.perfiles set en_turno = false where id = %L', v1));
  update public.perfiles set en_turno = true where id = v1;
  perform pruebas.caso('V1 reagenda', 'V1', format($f$select public.cambiar_reunion_panel(%L, %L, %L) #>> '{anfitrion,id}' = %L$f$,
    v_id, pruebas.hora(3, '14:00'), v_act, v1), 'verdad');
  select actualizado_en into v_act from public.reuniones where id = v_id;
  perform pruebas.caso('A reagenda', 'A', format($f$select (public.cambiar_reunion_panel(%L, %L, %L) #>> '{reunion,inicio}')::timestamptz
    = %L$f$, v_id, pruebas.hora(3, '15:00'), v_act, pruebas.hora(3, '15:00')), 'verdad');
end $$;
rollback;

-- @test cambios: grants · las de enlace sólo service_role; las del panel sólo authenticated
do $$
declare
  f text;
begin
  foreach f in array array['public.cambiar_reunion(bytea, timestamptz, timestamptz)', 'public.cancelar_reunion(bytea, timestamptz)']
  loop
    if not has_function_privilege('service_role', f, 'execute') or has_function_privilege('authenticated', f, 'execute')
       or has_function_privilege('anon', f, 'execute') then
      raise exception '% no es sólo de service_role', f;
    end if;
  end loop;
  foreach f in array array['public.cambiar_reunion_panel(uuid, timestamptz, timestamptz)',
      'public.cancelar_reunion_panel(uuid, timestamptz)'] loop
    if not has_function_privilege('authenticated', f, 'execute') or has_function_privilege('service_role', f, 'execute')
       or has_function_privilege('anon', f, 'execute') then
      raise exception '% no es sólo de authenticated', f;
    end if;
  end loop;
end $$;
