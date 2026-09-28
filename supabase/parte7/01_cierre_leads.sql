-- =============================================================
-- Parte 7 · Bloque 1 — Cierre de leads con motivo
-- =============================================================
-- Qué hace:
--   1. Agrega a leads: motivo_cierre, detalle_cierre, cerrado_en y cerrado_por.
--      Motivos: falta_dinero, credito_rechazado, usado_no_admitido, compro_competencia y otros.
--      "otros" exige un texto (detalle_cierre).
--   2. A los leads que ya estaban en estado 'cerrado' les pone cerrado_en = última actualización
--      (quedan sin motivo: los cerró el bot o se cerraron antes de este cambio).
--   3. El trigger de leads ahora también:
--      · exige un motivo cuando un usuario del CRM cierra un lead (n8n no tiene esta exigencia);
--      · solo deja usar el motivo "otros" a un administrador;
--      · completa cerrado_en al cerrar y limpia los datos del cierre si el lead se reabre.
--
-- Resultado esperado: "Success. No rows returned".
-- Verificación: Table Editor → leads → aparecen las 4 columnas nuevas.

alter table public.leads
  add column motivo_cierre  text check (motivo_cierre in ('falta_dinero', 'credito_rechazado', 'usado_no_admitido', 'compro_competencia', 'otros')),
  add column detalle_cierre text,
  add column cerrado_en     timestamptz,
  add column cerrado_por    bigint references public.usuarios (id),
  add constraint leads_detalle_cierre_otros check (motivo_cierre is distinct from 'otros' or nullif(trim(detalle_cierre), '') is not null);

update public.leads set cerrado_en = actualizado_en where estado = 'cerrado' and cerrado_en is null;

create index idx_leads_cerrado_en on public.leads (cerrado_en desc) where estado = 'cerrado';

create or replace function public.antes_de_guardar_lead()
returns trigger language plpgsql as $$
begin
  new.actualizado_en = now();
  if new.vendedor_id is not null then
    new.modo = 'humano';
  end if;
  if tg_op = 'UPDATE' and new.etapa_id is distinct from old.etapa_id then
    new.etapa_actualizada_en = now();
  end if;

  if new.estado = 'cerrado' then
    -- auth.uid() es null para n8n (service_role): el bot puede cerrar sin motivo.
    if auth.uid() is not null and new.motivo_cierre is null
       and (tg_op = 'INSERT' or old.estado is distinct from 'cerrado') then
      raise exception 'Elegí un motivo de cierre.';
    end if;
    if auth.uid() is not null and new.motivo_cierre = 'otros' and not public.es_admin()
       and (tg_op = 'INSERT' or old.motivo_cierre is distinct from 'otros') then
      raise exception 'Solo un administrador puede cerrar con el motivo "Otros".';
    end if;
    new.cerrado_en = coalesce(new.cerrado_en, now());
  elsif tg_op = 'UPDATE' and old.estado = 'cerrado' then
    new.motivo_cierre = null;
    new.detalle_cierre = null;
    new.cerrado_en = null;
    new.cerrado_por = null;
  end if;
  return new;
end;
$$;
