-- =============================================================
-- Parte 7 · Bloque 2 — Último mensaje enviado al cliente
-- =============================================================
-- Qué hace:
--   1. Agrega a leads la columna ultimo_saliente_en: cuándo se le escribió al cliente por última
--      vez (mensaje de un vendedor o plantilla). Las respuestas automáticas del bot no cuentan.
--   2. La completa en los leads que ya existen.
--   3. El trigger de mensajes la mantiene al día (sigue haciendo todo lo de antes).
-- La usa el Panel general para saber si un lead agendado fue contactado y si el cliente responde.
--
-- Resultado esperado: "Success. No rows returned".
-- Verificación: Table Editor → leads → aparece ultimo_saliente_en (con fecha en los leads ya contactados).

alter table public.leads add column ultimo_saliente_en timestamptz;

update public.leads l
   set ultimo_saliente_en = (
     select max(m.creado_en) from public.mensajes m
      where m.lead_id = l.id and m.direccion = 'saliente' and (m.autor_tipo = 'vendedor' or m.tipo = 'plantilla'));

create or replace function public.al_guardar_mensaje()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.leads
     set ultimo_mensaje_en  = greatest(ultimo_mensaje_en, new.creado_en),
         leido              = case when new.direccion = 'entrante' then false else leido end,
         modo               = case when new.autor_tipo = 'vendedor' then 'humano' else modo end,
         ultima_interaccion = case when new.autor_tipo = 'cliente' then new.creado_en else ultima_interaccion end,
         ultimo_saliente_en = case when new.direccion = 'saliente' and (new.autor_tipo = 'vendedor' or new.tipo = 'plantilla')
                                   then greatest(coalesce(ultimo_saliente_en, new.creado_en), new.creado_en)
                                   else ultimo_saliente_en end
   where id = new.lead_id;
  return new;
end;
$$;
