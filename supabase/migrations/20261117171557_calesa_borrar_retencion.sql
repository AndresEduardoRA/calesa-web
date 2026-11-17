-- Calesa · borrar datos personales a pedido o por retención (semilla §3 l. 300-302, C2, C3, R3.4, R4.17; paso P30, C12, C13, C15,
-- C16). `borrar_solicitud` es del admin desde el panel (sólo `authenticated`, con `solicitudes.borrar`); `retencion_diaria` la llama
-- la tarea diaria (P13, sólo `service_role`). En los dos queda sólo una fila `borrado` con el id (P7a). La base no llama a Resend
-- (X6): el borrado devuelve los `resend_id` que el servidor cancela (P15).

-- C16: los correos de una persona, de una solicitud o de una reunión, en cualquier estado (los parciales de §3 sólo cubren
-- `programado`).
create index correos_salientes_para on public.correos_salientes (para); -- borrado a pedido por correo (R4.17)
create index correos_salientes_de_solicitud on public.correos_salientes (solicitud_id); -- borrado a pedido
create index correos_salientes_de_reunion on public.correos_salientes (reunion_id); -- borrado a pedido

-- C12 (R4.17, P6a, P7a): borra los correos que esperan (programado y fallido, que la tarea diaria reintenta) y vacía los datos de
-- los ya enviados o cancelados; deja sólo la fila `borrado` de quien borra; reuniones y notas caen en cascada.
create function public.borrar_solicitud(p_solicitud_id uuid, p_actualizado_en_esperado timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.solicitudes;
  v_reuniones uuid[];
  v_resend text[];
begin
  if p_solicitud_id is null then
    raise exception 'Falta la solicitud.' using errcode = '22023', hint = 'p_solicitud_id';
  end if;
  if p_actualizado_en_esperado is null then
    raise exception 'Falta la versión de la solicitud.' using errcode = '22023', hint = 'p_actualizado_en_esperado';
  end if;
  if not (select public.tiene_permiso('solicitudes.borrar')) then
    perform public._fallar('E11');
  end if;
  select * into v_s from public.solicitudes s where s.id = p_solicitud_id for update;
  if v_s.id is null or v_s.actualizado_en <> p_actualizado_en_esperado then
    perform public._fallar('E7');
  end if;
  -- reuniones_solicitud (solicitud_id)
  v_reuniones := array(select r.id from public.reuniones r where r.solicitud_id = v_s.id);
  -- correos_salientes_para, correos_salientes_de_solicitud, correos_salientes_de_reunion. El correo, con el operador de citext
  -- calificado: con `search_path` vacío, `=` caería en `text = text` y distinguiría mayúsculas.
  with borrados as (
    delete from public.correos_salientes c
     where (c.para operator(extensions.=) v_s.email or c.solicitud_id = v_s.id or c.reunion_id = any (v_reuniones))
       and c.estado in ('programado', 'fallido')
    returning c.resend_id
  )
  select coalesce(array_agg(b.resend_id order by b.resend_id) filter (where b.resend_id is not null), '{}') into v_resend
    from borrados b;
  update public.correos_salientes c
     set datos = '{}'::jsonb, adjunto_ics = null
   where (c.para operator(extensions.=) v_s.email or c.solicitud_id = v_s.id or c.reunion_id = any (v_reuniones))
     and c.estado in ('enviado', 'cancelado');
  -- auditoria_registro (registro_id)
  delete from public.auditoria a where a.registro_id = v_s.id or a.registro_id = any (v_reuniones);
  insert into public.auditoria (actor_id, accion, tabla, registro_id) values ((select auth.uid()), 'borrado', 'solicitudes', v_s.id);
  delete from public.solicitudes s where s.id = v_s.id;
  return jsonb_build_object('id', v_s.id, 'resendIds', to_jsonb(v_resend));
end;
$$;

-- C13 (C2, R3.4, P8a): la limpieza diaria por lotes, con tope por tabla y por corrida (1000 solicitudes y 10 000 de cada otra). Cada
-- lote pide uno de más: si llegó, `quedanMas` y P13 la vuelve a llamar. Lo borrado se cuenta con `row_count`, nunca con un conteo.
create function public.retencion_diaria()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tope_solicitudes constant int := 1000;
  v_tope constant int := 10000;
  v_mas boolean := false;
  v_ids uuid[];
  v_reuniones uuid[];
  v_eventos bigint[];
  v_correos uuid[];
  v_claves text[];
  v_n_solicitudes int;
  v_n_eventos int;
  v_n_correos int;
  v_n_limites int;
begin
  -- solicitudes_retencion (ultimo_contacto_en): 24 meses sin contacto.
  v_ids := array(select s.id from public.solicitudes s where s.ultimo_contacto_en < now() - interval '24 months'
                  order by s.ultimo_contacto_en limit v_tope_solicitudes + 1 for update skip locked);
  v_mas := v_mas or cardinality(v_ids) > v_tope_solicitudes;
  v_ids := v_ids[1:v_tope_solicitudes];
  -- reuniones_solicitud (solicitud_id), auditoria_registro (registro_id)
  v_reuniones := array(select r.id from public.reuniones r where r.solicitud_id = any (v_ids));
  delete from public.auditoria a where a.registro_id = any (v_ids) or a.registro_id = any (v_reuniones);
  insert into public.auditoria (actor_id, accion, tabla, registro_id)
  select null, 'borrado', 'solicitudes', i from unnest(v_ids) i;
  delete from public.solicitudes s where s.id = any (v_ids);
  get diagnostics v_n_solicitudes = row_count;

  -- eventos_listado (creado_en desc, id desc): 24 meses (§3 l. 302).
  v_eventos := array(select e.id from public.eventos e where e.creado_en < now() - interval '24 months'
                      order by e.creado_en limit v_tope + 1 for update skip locked);
  v_mas := v_mas or cardinality(v_eventos) > v_tope;
  delete from public.eventos e where e.id = any (v_eventos[1:v_tope]);
  get diagnostics v_n_eventos = row_count;

  -- correos_salientes_listado (creado_en desc, id desc): 90 días, salvo los que esperan su envío.
  v_correos := array(select c.id from public.correos_salientes c
                      where c.creado_en < now() - interval '90 days' and c.estado <> 'programado'
                      order by c.creado_en limit v_tope + 1 for update skip locked);
  v_mas := v_mas or cardinality(v_correos) > v_tope;
  delete from public.correos_salientes c where c.id = any (v_correos[1:v_tope]);
  get diagnostics v_n_correos = row_count;

  -- limites: sin índice (la acota esta misma limpieza; uno sumaría escritura a cada `contar_envio`). Con ventanas de hasta un día,
  -- 2 días nunca cortan una viva (P32).
  v_claves := array(select l.clave from public.limites l where l.ventana_inicio < now() - interval '2 days'
                     limit v_tope + 1 for update skip locked);
  v_mas := v_mas or cardinality(v_claves) > v_tope;
  delete from public.limites l where l.clave = any (v_claves[1:v_tope]);
  get diagnostics v_n_limites = row_count;

  return jsonb_build_object('solicitudes', v_n_solicitudes, 'eventos', v_n_eventos, 'correos', v_n_correos, 'limites', v_n_limites,
    'quedanMas', v_mas);
end;
$$;

-- C15: borrar, sólo `authenticated` (quien borra queda en la auditoría); la retención, sólo el servidor.
revoke all on function public.borrar_solicitud(uuid, timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.borrar_solicitud(uuid, timestamptz) to authenticated;
revoke all on function public.retencion_diaria() from public, anon, authenticated;
grant execute on function public.retencion_diaria() to service_role;

-- La clave nace con su punto de aplicación (§2: sólo el admin).
insert into public.permisos (clave, descripcion) values ('solicitudes.borrar', 'Borrar una solicitud a pedido de la persona.')
on conflict (clave) do update set descripcion = excluded.descripcion;
insert into public.permisos_rol (rol, clave, alcance) values ('admin', 'solicitudes.borrar', 'todos')
on conflict (rol, clave) do update set alcance = excluded.alcance;
