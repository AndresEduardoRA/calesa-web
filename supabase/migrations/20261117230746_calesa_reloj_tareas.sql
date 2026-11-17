-- Calesa · el reloj de la retención, las métricas y los defaults (paso P38, C3–C5, P2.1): las dos funciones que leían `now()` lo leen
-- de `public._ahora()` (su definición vigente, sin otro cambio; lo vigila `supabase/tests/reloj-copias.test.ts`), y los defaults de hora
-- de `public` pasan a `public._ahora()` (un default no admite subconsultas). Así, con el reloj fijado, lo que se crea nace en esa hora y
-- el reparto por semana, las métricas del día y la retención ven lo mismo que las funciones. Quedan con el reloj real las versiones de
-- edición (`actualizado_en` y `horario_base.creado_en`, la versión de `guardar_horario_base`): tienen que avanzar aunque el reloj esté
-- quieto. Sin la tabla del reloj, `_ahora()` es `now()`: en la nube nada cambia.

-- retencion_diaria: la de calesa_borrar_retencion.sql, con la hora de _ahora() (4 líneas).
create or replace function public.retencion_diaria()
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
  v_ids := array(select s.id from public.solicitudes s where s.ultimo_contacto_en < (select public._ahora()) - interval '24 months'
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
  v_eventos := array(select e.id from public.eventos e where e.creado_en < (select public._ahora()) - interval '24 months'
                      order by e.creado_en limit v_tope + 1 for update skip locked);
  v_mas := v_mas or cardinality(v_eventos) > v_tope;
  delete from public.eventos e where e.id = any (v_eventos[1:v_tope]);
  get diagnostics v_n_eventos = row_count;

  -- correos_salientes_listado (creado_en desc, id desc): 90 días, salvo los que esperan su envío.
  v_correos := array(select c.id from public.correos_salientes c
                      where c.creado_en < (select public._ahora()) - interval '90 days' and c.estado <> 'programado'
                      order by c.creado_en limit v_tope + 1 for update skip locked);
  v_mas := v_mas or cardinality(v_correos) > v_tope;
  delete from public.correos_salientes c where c.id = any (v_correos[1:v_tope]);
  get diagnostics v_n_correos = row_count;

  -- limites: sin índice (la acota esta misma limpieza; uno sumaría escritura a cada `contar_envio`). Con ventanas de hasta un día,
  -- 2 días nunca cortan una viva (P32).
  v_claves := array(select l.clave from public.limites l where l.ventana_inicio < (select public._ahora()) - interval '2 days'
                     limit v_tope + 1 for update skip locked);
  v_mas := v_mas or cardinality(v_claves) > v_tope;
  delete from public.limites l where l.clave = any (v_claves[1:v_tope]);
  get diagnostics v_n_limites = row_count;

  return jsonb_build_object('solicitudes', v_n_solicitudes, 'eventos', v_n_eventos, 'correos', v_n_correos, 'limites', v_n_limites,
    'quedanMas', v_mas);
end;
$$;

-- _metricas_solicitud: la de calesa_metricas.sql, con la hora de _ahora() (1 línea).
create or replace function public._metricas_solicitud()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dia date;
  v_hoy date;
  v_ganada boolean;
  v_x record;
begin
  if tg_op = 'INSERT' then
    v_dia := public._dia_local(new.creado_en);
    perform public._sumar_diaria(v_dia, 'solicitudes', 1);
    if new.asignado_a is not null then
      perform public._sumar_persona(v_dia, new.asignado_a, 'solicitudes_asignadas', 1);
    end if;
    return null;
  end if;
  v_ganada := new.estado = 'ganada' and old.estado is distinct from 'ganada';
  if v_ganada then
    v_hoy := public._dia_local((select public._ahora()));
    perform public._sumar_diaria(v_hoy, 'ganadas', 1);
  end if;
  if new.asignado_a is distinct from old.asignado_a then
    v_dia := public._dia_local(new.creado_en);
    for v_x in select t.perfil, t.n from (values (old.asignado_a, -1), (new.asignado_a, 1)) t (perfil, n)
                where t.perfil is not null order by t.perfil loop
      perform public._sumar_persona(v_dia, v_x.perfil, 'solicitudes_asignadas', v_x.n);
    end loop;
  end if;
  if v_ganada and new.asignado_a is not null then
    perform public._sumar_persona(v_hoy, new.asignado_a, 'ganadas', 1);
  end if;
  return null;
end;
$$;

-- C5: los defaults de hora de public (22), salvo las versiones.
alter table public.perfiles alter column creado_en set default public._ahora();
alter table public.invitaciones alter column creado_en set default public._ahora();
alter table public.invitaciones alter column expira_en set default public._ahora() + interval '7 days';
alter table public.config_agenda alter column creado_en set default public._ahora();
alter table public.bloqueos alter column creado_en set default public._ahora();
alter table public.solicitudes alter column creado_en set default public._ahora();
alter table public.solicitudes alter column ultimo_contacto_en set default public._ahora();
alter table public.reuniones alter column creado_en set default public._ahora();
alter table public.notas alter column creado_en set default public._ahora();
alter table public.enlaces_prospeccion alter column creado_en set default public._ahora();
alter table public.equipo alter column creado_en set default public._ahora();
alter table public.config_calculadora alter column creado_en set default public._ahora();
alter table public.eventos alter column creado_en set default public._ahora();
alter table public.metricas_diarias alter column creado_en set default public._ahora();
alter table public.metricas_persona alter column creado_en set default public._ahora();
alter table public.latidos alter column creado_en set default public._ahora();
alter table public.auditoria alter column creado_en set default public._ahora();
alter table public.correos_salientes alter column creado_en set default public._ahora();
alter table public.limites alter column creado_en set default public._ahora();
alter table public.limites alter column ventana_inicio set default public._ahora();
alter table public.permisos alter column creado_en set default public._ahora();
alter table public.permisos_rol alter column creado_en set default public._ahora();
