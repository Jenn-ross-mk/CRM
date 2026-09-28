-- =============================================================
-- Parte 7 · Bloque 5 — Reabrir solo un chat cerrado cuando el cliente vuelve a escribir
-- =============================================================
-- Qué hace: cuando llega un mensaje del cliente (lo guarda n8n) en un lead cerrado:
--   · el lead vuelve a abrirse con el mismo vendedor (estado 'derivado'), como no leído;
--   · si ese vendedor está dado de baja, queda sin vendedor para asignación manual;
--   · la base borra los datos del cierre (motivo, detalle, fecha) y lo anota en el historial.
-- Los mensajes anteriores no se tocan: la conversación sigue completa en el mismo lead.
-- Requisito para n8n: el mensaje nuevo tiene que guardarse en el lead que ya existe para ese
-- contacto (aunque esté cerrado), sin crear un lead nuevo.
--
-- Resultado esperado: "Success. No rows returned".
-- Verificación: Database → Triggers → mensajes tiene trg_reabrir_lead_cerrado.

create or replace function public.reabrir_lead_cerrado()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_vendedor_id bigint;
  v_vendedor    text;
  v_activo      boolean;
begin
  if new.autor_tipo <> 'cliente' then
    return new;
  end if;

  select l.vendedor_id, u.nombre, coalesce(u.activo, false)
    into v_vendedor_id, v_vendedor, v_activo
    from public.leads l
    left join public.usuarios u on u.id = l.vendedor_id
   where l.id = new.lead_id and l.estado = 'cerrado'
     for update of l;
  if not found then
    return new;
  end if;

  update public.leads
     set estado      = case when v_activo then 'derivado' else 'asignacion_manual' end,
         vendedor_id = case when v_activo then v_vendedor_id end,
         leido       = false
   where id = new.lead_id;

  insert into public.lead_historial (lead_id, tipo, descripcion)
  values (new.lead_id, 'sistema',
          case when v_activo then 'Reabierto automáticamente: el cliente volvió a escribir. Sigue con ' || v_vendedor
               else 'Reabierto automáticamente: el cliente volvió a escribir. Su vendedor está dado de baja: queda para asignación manual' end);
  return new;
end;
$$;

create trigger trg_reabrir_lead_cerrado
  after insert on public.mensajes
  for each row execute function public.reabrir_lead_cerrado();
