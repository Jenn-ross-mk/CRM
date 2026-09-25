-- =============================================================
-- Parte 6 · Bloque 8 — Permisos (RLS): gestión comercial
-- =============================================================
--   · alertas: cada uno ve, crea, marca y borra las suyas; también se ven las de un lead visible.
--   · turnos (test drive): todos ven la agenda; el vendedor solicita (queda pendiente);
--     admin y supervisor de la sucursal aprueban, rechazan o marcan realizado.
--   · ventas: todos las leen (ranking); admin y supervisor de la sucursal registran y editan.
--     El vendedor solo registra la venta de un lead propio que llegó a la última etapa.
--   · comunicados, giras y entregas: todos leen; admin y supervisores modifican.
--
-- Resultado esperado: "Success. No rows returned".
-- Verificación: Authentication → Policies → ninguna de las 22 tablas dice "No policies".

create policy alertas_lectura on public.alertas for select to authenticated using (
  usuario_id = public.mi_usuario_id() or (lead_id is not null and public.puede_ver_lead(lead_id))
);
create policy alertas_alta on public.alertas for insert to authenticated with check (
  usuario_id = public.mi_usuario_id() and (lead_id is null or public.puede_ver_lead(lead_id))
);
create policy alertas_edicion on public.alertas for update to authenticated
  using (usuario_id = public.mi_usuario_id()) with check (usuario_id = public.mi_usuario_id());
create policy alertas_baja on public.alertas for delete to authenticated using (usuario_id = public.mi_usuario_id());

create policy turnos_lectura on public.turnos for select to authenticated using (true);
create policy turnos_alta on public.turnos for insert to authenticated with check (
  estado = 'pendiente' and (vendedor_id = public.mi_usuario_id() or public.es_gestion())
);
create policy turnos_gestion on public.turnos for update to authenticated using (
  public.es_admin() or (public.mi_rol() = 'supervisor' and sucursal_id in (select public.mis_sucursales()))
);

create policy ventas_lectura on public.ventas for select to authenticated using (true);
create policy ventas_alta on public.ventas for insert to authenticated with check (
  public.es_admin()
  or (public.mi_rol() = 'supervisor' and sucursal_id in (select public.mis_sucursales()))
  or (
    vendedor_id = public.mi_usuario_id()
    and lead_id is not null
    and exists (
      select 1 from public.leads l
      join public.etapas_pipeline e on e.id = l.etapa_id
      where l.id = lead_id
        and l.vendedor_id = public.mi_usuario_id()
        and e.orden = (select max(orden) from public.etapas_pipeline where sector = e.sector)
    )
  )
);
create policy ventas_edicion on public.ventas for update to authenticated using (
  public.es_admin() or (public.mi_rol() = 'supervisor' and sucursal_id in (select public.mis_sucursales()))
);
create policy ventas_baja on public.ventas for delete to authenticated using (
  public.es_admin() or (vendedor_id = public.mi_usuario_id() and lead_id is not null)
);

create policy comunicados_lectura on public.comunicados for select to authenticated using (true);
create policy comunicados_gestion on public.comunicados for all to authenticated using (public.es_gestion()) with check (public.es_gestion());

create policy giras_lectura on public.giras_plan_ahorro for select to authenticated using (true);
create policy giras_gestion on public.giras_plan_ahorro for all to authenticated using (public.es_gestion()) with check (public.es_gestion());

create policy entregas_lectura on public.entregas for select to authenticated using (true);
create policy entregas_gestion on public.entregas for all to authenticated using (public.es_gestion()) with check (public.es_gestion());
