-- Calesa · el límite de envíos (semilla C7, §3 `limites`; paso P32): `contar_envio`, la RPC detrás de `ContarEnvio`
-- (`src/shared/lib/seguridad/limites.ts`). Ventana fija, igual que `crearContadorEnMemoria`: sin fila o con
-- `now() >= ventana_inicio + ventana`, la ventana empieza ahora con conteo 1; si no, el conteo suma 1. Permitido si
-- `conteo <= p_maximo`. La clave ya llega con la IP hasheada (`<accion>:<sha256>`): la base nunca ve la IP. Sólo `service_role`
-- (el servidor, con el cliente admin, P33). La tabla queda como está: RLS sin grants ni policies; la limpia la retención (P30).

create function public.contar_envio(p_clave text, p_maximo integer, p_ventana_segundos integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conteo integer;
begin
  -- Argumentos inválidos: error antes de escribir (quien limita falla cerrado). La ventana va hasta un día: `limites` se guarda
  -- 2 días y la retención nunca corta una ventana viva.
  if p_clave is null or char_length(p_clave) not between 1 and 200 then
    raise exception 'La clave del límite de envíos no es válida.' using errcode = '22023', hint = 'p_clave';
  end if;
  if p_maximo is null or p_maximo < 1 then
    raise exception 'El máximo del límite de envíos tiene que ser 1 o más.' using errcode = '22023', hint = 'p_maximo';
  end if;
  if p_ventana_segundos is null or p_ventana_segundos not between 1 and 86400 then
    raise exception 'La ventana del límite de envíos va de 1 segundo a 1 día.' using errcode = '22023', hint = 'p_ventana_segundos';
  end if;

  -- Una sola sentencia atómica: dos llamadas a la vez con la misma clave se serializan en el bloqueo de la fila y cada una cuenta
  -- la de la otra. En el `set`, `l.` es la fila de antes. `now()` es la hora del pedido (una transacción por llamada).
  insert into public.limites as l (clave, ventana_inicio, conteo)
  values (p_clave, now(), 1)
  on conflict (clave) do update
    set ventana_inicio = case when now() >= l.ventana_inicio + make_interval(secs => p_ventana_segundos)
                              then now() else l.ventana_inicio end,
        conteo = case when now() >= l.ventana_inicio + make_interval(secs => p_ventana_segundos)
                      then 1 else l.conteo + 1 end
  returning l.conteo into v_conteo;

  return v_conteo <= p_maximo;
end;
$$;

revoke all on function public.contar_envio(text, integer, integer) from public, anon, authenticated;
grant execute on function public.contar_envio(text, integer, integer) to service_role;
