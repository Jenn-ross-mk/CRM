-- =============================================================
-- Parte 6 · Bloque 3 — Columnas nuevas de leads y triggers que las mantienen
-- =============================================================
-- Qué hace:
--   1. Agrega a leads: prioridad, leido, ultimo_mensaje_en y etapa_actualizada_en.
--   2. Completa ultimo_mensaje_en en los leads que ya existen.
--   3. El trigger de mensajes ahora también: actualiza ultimo_mensaje_en con cualquier
--      mensaje y marca el lead como no leído (leido = false) cuando el mensaje es entrante.
--      Sigue haciendo lo de antes: vendedor escribe → modo 'humano'; cliente escribe →
--      ultima_interaccion.
--   4. El trigger de leads ahora también guarda cuándo cambió la etapa.
--   5. El registro de cambio de etapa pasa a guardar quién lo hizo.
--
-- Resultado esperado: "Success. No rows returned".
-- Verificación: Table Editor → leads → aparecen las 4 columnas nuevas; ultimo_mensaje_en tiene fecha.

alter table public.leads
  add column prioridad            text        not null default 'media' check (prioridad in ('alta', 'media', 'baja')),
  add column leido                boolean     not null default false,
  add column ultimo_mensaje_en    timestamptz not null default now(),
  add column etapa_actualizada_en timestamptz not null default now();

update public.leads l
   set ultimo_mensaje_en = coalesce((select max(m.creado_en) from public.mensajes m where m.lead_id = l.id), l.creado_en),
       etapa_actualizada_en = l.creado_en;

create index idx_leads_ultimo_mensaje on public.leads (ultimo_mensaje_en desc);

create or replace function public.al_guardar_mensaje()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.leads
     set ultimo_mensaje_en  = greatest(ultimo_mensaje_en, new.creado_en),
         leido              = case when new.direccion = 'entrante' then false else leido end,
         modo               = case when new.autor_tipo = 'vendedor' then 'humano' else modo end,
         ultima_interaccion = case when new.autor_tipo = 'cliente' then new.creado_en else ultima_interaccion end
   where id = new.lead_id;
  return new;
end;
$$;

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
  return new;
end;
$$;

create or replace function public.registrar_cambio_etapa()
returns trigger language plpgsql security definer set search_path = public as $$
declare nombre_etapa text;
begin
  if new.etapa_id is distinct from old.etapa_id and new.etapa_id is not null then
    select nombre into nombre_etapa from public.etapas_pipeline where id = new.etapa_id;
    insert into public.lead_historial (lead_id, tipo, descripcion, usuario_id)
    values (new.id, 'etapa', 'Pasó a la etapa: ' || nombre_etapa, public.mi_usuario_id());
  end if;
  return new;
end;
$$;
