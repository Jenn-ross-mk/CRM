-- Un vendedor solo puede registrar/eliminar ventas generadas desde un lead propio (al marcarlo como Ganado/Adjudicado).
-- Evita que se carguen ventas sueltas por API para inflar el ranking.
drop policy "ventas_alta" on public.ventas;
create policy "ventas_alta" on public.ventas for insert to authenticated with check (
  public.es_admin()
  or (public.mi_rol() = 'supervisor' and sucursal_id = public.mi_sucursal())
  or (
    vendedor_id = auth.uid()
    and lead_id is not null
    and exists (select 1 from public.leads l where l.id = lead_id and l.vendedor_id = auth.uid() and l.etapa = 5)
  )
);

drop policy "ventas_baja" on public.ventas;
create policy "ventas_baja" on public.ventas for delete to authenticated using (
  public.es_admin() or (vendedor_id = auth.uid() and lead_id is not null)
);
