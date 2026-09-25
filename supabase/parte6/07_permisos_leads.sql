-- =============================================================
-- Parte 6 · Bloque 7 — Permisos (RLS): leads y conversaciones
-- =============================================================
-- Regla general: el vendedor ve lo suyo, el supervisor lo de sus sucursales y el admin todo.
--   · leads: ver y editar según esa regla. No se borran.
--   · contactos: se ven si se puede ver alguno de sus leads.
--   · mensajes: se ven con el lead; desde el CRM solo se escriben mensajes salientes
--     firmados por el propio usuario (quedan "pendientes" hasta que n8n los envíe).
--   · asignaciones: se ven con el lead; admin y supervisores registran reasignaciones.
--   · etiquetas del lead, notas e historial: siguen al lead.
-- Los leads nuevos los crean n8n (service_role) o el CRM desde el servidor.
--
-- Resultado esperado: "Success. No rows returned".
-- Verificación: Authentication → Policies → leads, contactos, mensajes, asignaciones,
-- lead_etiquetas, notas y lead_historial tienen sus policies.

create policy leads_lectura on public.leads for select to authenticated using (
  public.es_admin()
  or vendedor_id = public.mi_usuario_id()
  or (public.mi_rol() = 'supervisor' and sucursal_id in (select public.mis_sucursales()))
);
create policy leads_edicion on public.leads for update to authenticated using (
  public.es_admin()
  or vendedor_id = public.mi_usuario_id()
  or (public.mi_rol() = 'supervisor' and sucursal_id in (select public.mis_sucursales()))
) with check (
  public.es_admin()
  or (public.mi_rol() = 'vendedor' and vendedor_id = public.mi_usuario_id())
  or (public.mi_rol() = 'supervisor' and sucursal_id in (select public.mis_sucursales()))
);

create policy contactos_lectura on public.contactos for select to authenticated using (
  exists (select 1 from public.leads l where l.contacto_id = contactos.id)
);

create policy mensajes_lectura on public.mensajes for select to authenticated using (public.puede_ver_lead(lead_id));
create policy mensajes_alta on public.mensajes for insert to authenticated with check (
  public.puede_ver_lead(lead_id)
  and direccion = 'saliente'
  and autor_tipo = 'vendedor'
  and autor_usuario_id = public.mi_usuario_id()
);

create policy asignaciones_lectura on public.asignaciones for select to authenticated using (public.puede_ver_lead(lead_id));
create policy asignaciones_alta on public.asignaciones for insert to authenticated with check (
  public.es_gestion() and public.puede_ver_lead(lead_id)
);

create policy lead_etiquetas_lectura on public.lead_etiquetas for select to authenticated using (public.puede_ver_lead(lead_id));
create policy lead_etiquetas_alta    on public.lead_etiquetas for insert to authenticated with check (public.puede_ver_lead(lead_id));
create policy lead_etiquetas_baja    on public.lead_etiquetas for delete to authenticated using (public.puede_ver_lead(lead_id));

create policy notas_lectura on public.notas for select to authenticated using (public.puede_ver_lead(lead_id));
create policy notas_alta on public.notas for insert to authenticated with check (
  public.puede_ver_lead(lead_id) and usuario_id = public.mi_usuario_id()
);

create policy historial_lectura on public.lead_historial for select to authenticated using (public.puede_ver_lead(lead_id));
create policy historial_alta on public.lead_historial for insert to authenticated with check (
  public.puede_ver_lead(lead_id) and usuario_id = public.mi_usuario_id()
);
