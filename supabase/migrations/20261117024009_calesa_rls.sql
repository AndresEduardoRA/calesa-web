-- Calesa · grants y policies del panel (semilla §2, §3 › Quién lee y escribe, §4 › Matriz RLS). `anon` no tiene nada en
-- `public` (lo público va por el esquema `publico`); `authenticated` tiene sólo lo de abajo; `service_role` queda con lo suyo.
-- Lo que §3 escribe «sólo por RPC» (estado y asignado_a de solicitudes, reuniones, rol/activo/en_turno de perfiles, las
-- configuraciones, las tablas de sistema) no tiene grant de escritura: lo hacen las RPC de P05. Una policy por operación.
-- Abreviaturas de los comentarios: T(k) = (select public.tiene_permiso('k')); A(col, k) = col = any ((select
-- public.ids_con_alcance('k'))::uuid[]); U = (select auth.uid()). Ambas son InitPlan (una vez por consulta, no por fila).

-- Grants (las tablas nacieron con `revoke all … from anon, authenticated`).
grant select on public.perfiles, public.invitaciones, public.config_agenda, public.horario_base, public.config_calculadora,
  public.bloqueos, public.solicitudes, public.notas, public.enlaces_prospeccion, public.equipo, public.eventos,
  public.metricas_diarias, public.metricas_persona, public.latidos, public.auditoria, public.correos_salientes to authenticated;
grant update (nombre, whatsapp, enlace_meet) on public.perfiles to authenticated;
grant insert (email, invitado_por), update (estado) on public.invitaciones to authenticated;
grant insert (perfil_id, inicio, fin, motivo, creado_por), delete on public.bloqueos to authenticated;
grant update (nombre, email, importadora, pais, whatsapp, ultimo_contacto_en) on public.solicitudes to authenticated;
-- `token_hash` no lo lee nadie del panel.
grant select (id, solicitud_id, anfitrion_id, inicio, fin, zona_visitante, enlace_meet, estado, secuencia_ics, recordatorio_24_en,
  recordatorio_1_en, cancelada_en, creado_en, actualizado_en) on public.reuniones to authenticated;
grant insert (solicitud_id, autor_id, texto), update (texto), delete on public.notas to authenticated;
grant insert (codigo, etiqueta, creado_por), update (etiqueta, activo) on public.enlaces_prospeccion to authenticated;
grant insert (nombre, cargo, frase, foto_ruta, orden, visible), update (nombre, cargo, frase, foto_ruta, orden, visible), delete
  on public.equipo to authenticated;

-- perfiles: cada uno su fila (si está activo); el admin, todas. Rol, activo y en_turno: sólo por RPC (calesa_columnas_protegidas).
create policy perfiles_ver on public.perfiles for select to authenticated
  using ((id = (select auth.uid()) and activo) or (select public.tiene_permiso('usuarios.gestionar')));
create policy perfiles_editar on public.perfiles for update to authenticated
  using ((id = (select auth.uid()) and activo) or (select public.tiene_permiso('usuarios.gestionar')))
  with check ((id = (select auth.uid()) and activo) or (select public.tiene_permiso('usuarios.gestionar')));

-- invitaciones: el admin las ve, las crea a su nombre y sólo puede revocar una pendiente (`aceptada` la pone el servidor).
create policy invitaciones_ver on public.invitaciones for select to authenticated
  using ((select public.tiene_permiso('usuarios.gestionar')));
create policy invitaciones_crear on public.invitaciones for insert to authenticated
  with check ((select public.tiene_permiso('usuarios.gestionar')) and invitado_por = (select auth.uid()));
create policy invitaciones_revocar on public.invitaciones for update to authenticated
  using ((select public.tiene_permiso('usuarios.gestionar')) and estado = 'pendiente')
  with check ((select public.tiene_permiso('usuarios.gestionar')) and estado = 'revocada');

-- La agenda: el admin lee las reglas y el horario (los escriben las RPC de P05).
create policy config_agenda_ver on public.config_agenda for select to authenticated
  using ((select public.tiene_permiso('agenda.configurar')));
create policy horario_base_ver on public.horario_base for select to authenticated
  using ((select public.tiene_permiso('agenda.configurar')));

-- bloqueos: los suyos (vendedor) o de cualquiera (admin), creados a su nombre.
create policy bloqueos_ver on public.bloqueos for select to authenticated
  using ((select public.tiene_permiso('bloqueos.gestionar'))
    or perfil_id = any ((select public.ids_con_alcance('bloqueos.gestionar'))::uuid[]));
create policy bloqueos_crear on public.bloqueos for insert to authenticated
  with check (((select public.tiene_permiso('bloqueos.gestionar'))
      or perfil_id = any ((select public.ids_con_alcance('bloqueos.gestionar'))::uuid[]))
    and creado_por = (select auth.uid()));
create policy bloqueos_borrar on public.bloqueos for delete to authenticated
  using ((select public.tiene_permiso('bloqueos.gestionar'))
    or perfil_id = any ((select public.ids_con_alcance('bloqueos.gestionar'))::uuid[]));

-- solicitudes: el vendedor, las asignadas; el admin, todas. Directo sólo `ultimo_contacto_en` y, con editar_contacto, los datos
-- de contacto (el trigger lo exige por columna).
create policy solicitudes_ver on public.solicitudes for select to authenticated
  using ((select public.tiene_permiso('solicitudes.ver'))
    or asignado_a = any ((select public.ids_con_alcance('solicitudes.ver'))::uuid[]));
create policy solicitudes_editar on public.solicitudes for update to authenticated
  using ((select public.tiene_permiso('solicitudes.estado'))
    or asignado_a = any ((select public.ids_con_alcance('solicitudes.estado'))::uuid[])
    or (select public.tiene_permiso('solicitudes.editar_contacto')))
  with check ((select public.tiene_permiso('solicitudes.estado'))
    or asignado_a = any ((select public.ids_con_alcance('solicitudes.estado'))::uuid[])
    or (select public.tiene_permiso('solicitudes.editar_contacto')));

-- reuniones: sólo se leen (se escriben por las funciones de P05).
create policy reuniones_ver on public.reuniones for select to authenticated
  using ((select public.tiene_permiso('reuniones.ver'))
    or anfitrion_id = any ((select public.ids_con_alcance('reuniones.ver'))::uuid[]));

-- notas: las de las solicitudes que ve; las crea a su nombre en las suyas; editar y borrar, el admin (notas.gestionar).
create policy notas_ver on public.notas for select to authenticated
  using (public.puede_en_solicitud(solicitud_id, 'solicitudes.ver'));
create policy notas_crear on public.notas for insert to authenticated
  with check (autor_id = (select auth.uid()) and public.puede_en_solicitud(solicitud_id, 'notas.crear'));
create policy notas_editar on public.notas for update to authenticated
  using ((select public.tiene_permiso('notas.gestionar')))
  with check ((select public.tiene_permiso('notas.gestionar')));
create policy notas_borrar on public.notas for delete to authenticated
  using ((select public.tiene_permiso('notas.gestionar')));

-- enlaces_prospeccion: los suyos (vendedor) o todos (admin); se crean a su nombre.
create policy enlaces_prospeccion_ver on public.enlaces_prospeccion for select to authenticated
  using ((select public.tiene_permiso('prospeccion.gestionar'))
    or creado_por = any ((select public.ids_con_alcance('prospeccion.gestionar'))::uuid[]));
create policy enlaces_prospeccion_crear on public.enlaces_prospeccion for insert to authenticated
  with check (creado_por = (select auth.uid())
    and creado_por = any ((select public.ids_con_alcance('prospeccion.gestionar'))::uuid[]));
create policy enlaces_prospeccion_editar on public.enlaces_prospeccion for update to authenticated
  using ((select public.tiene_permiso('prospeccion.gestionar'))
    or creado_por = any ((select public.ids_con_alcance('prospeccion.gestionar'))::uuid[]))
  with check ((select public.tiene_permiso('prospeccion.gestionar'))
    or creado_por = any ((select public.ids_con_alcance('prospeccion.gestionar'))::uuid[]));

-- equipo: las filas visibles para todos; todo para el admin. El visitante lee por `publico.equipo_visible()`.
create policy equipo_ver on public.equipo for select to authenticated
  using (visible or (select public.tiene_permiso('equipo.gestionar')));
create policy equipo_crear on public.equipo for insert to authenticated
  with check ((select public.tiene_permiso('equipo.gestionar')));
create policy equipo_editar on public.equipo for update to authenticated
  using ((select public.tiene_permiso('equipo.gestionar')))
  with check ((select public.tiene_permiso('equipo.gestionar')));
create policy equipo_borrar on public.equipo for delete to authenticated
  using ((select public.tiene_permiso('equipo.gestionar')));

-- config_calculadora: la leen todos (se escribe por RPC en P05).
create policy config_calculadora_ver on public.config_calculadora for select to authenticated using (true);

-- Métricas, actividad y auditoría: sólo lectura.
create policy eventos_ver on public.eventos for select to authenticated
  using ((select public.tiene_permiso('metricas.ver')));
create policy metricas_diarias_ver on public.metricas_diarias for select to authenticated
  using ((select public.tiene_permiso('metricas.ver')));
create policy metricas_persona_ver on public.metricas_persona for select to authenticated
  using ((select public.tiene_permiso('metricas.ver'))
    or perfil_id = any ((select public.ids_con_alcance('metricas.ver'))::uuid[]));
create policy latidos_ver on public.latidos for select to authenticated
  using ((select public.tiene_permiso('actividad.ver')));
create policy correos_salientes_ver on public.correos_salientes for select to authenticated
  using ((select public.tiene_permiso('actividad.ver')));
-- R4.4: el vendedor ve el historial de sus solicitudes (y de las reuniones de esas solicitudes).
create policy auditoria_ver on public.auditoria for select to authenticated
  using ((select public.tiene_permiso('auditoria.ver'))
    or (tabla = 'solicitudes' and public.puede_en_solicitud(registro_id, 'auditoria.ver'))
    or (tabla = 'reuniones' and exists (
      select 1 from public.reuniones r
       where r.id = registro_id and public.puede_en_solicitud(r.solicitud_id, 'auditoria.ver'))));

-- limites: RLS encendida, sin grants ni policies (sólo service_role).
