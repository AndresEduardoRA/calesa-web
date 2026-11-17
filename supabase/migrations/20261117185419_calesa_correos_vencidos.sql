-- Calesa · los correos vencidos y su índice (semilla X6, §3 l. 264 y 296; paso P27, C3, C7). Sin cron por minuto (X6): lo que no se
-- pudo programar en Resend (programado sin resend_id) lo manda el despacho de P07 cuando su hora pasó. La hora la pone quien llama
-- (el reloj de la app): esta RPC no lee now(). Sólo `service_role`.

-- C7: el filtro y el orden del despacho, sin sort. Es chico: con Resend casi todo programado lleva resend_id, y la retención no borra
-- los programados.
create index correos_salientes_vencidos on public.correos_salientes (programado_para, id)
  where estado = 'programado' and resend_id is null;

create function public.correos_vencidos(p_ahora timestamptz, p_tope int default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tope constant int := public._acotar_pagina(p_tope, 50, 100);
begin
  if p_ahora is null then
    perform public._correo_invalido('p_ahora');
  end if;
  -- correos_salientes_vencidos (programado_para, id) where estado = 'programado' and resend_id is null
  return (select coalesce(jsonb_agg(public._correo_json(x) order by x.programado_para, x.id), '[]'::jsonb)
            from (select c.* from public.correos_salientes c
                   where c.estado = 'programado' and c.resend_id is null and c.programado_para <= p_ahora
                   order by c.programado_para, c.id limit v_tope) x);
end;
$$;

revoke all on function public.correos_vencidos(timestamptz, int) from public, anon, authenticated;
grant execute on function public.correos_vencidos(timestamptz, int) to service_role;
