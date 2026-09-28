-- Parte 7 del proyecto (CRM): Panel general y cierre de leads. Mismo contenido que supabase/parte7/01..05, en un solo archivo.
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
-- =============================================================
-- Parte 7 · Bloque 3 — Agendar llamadas y visitas
-- =============================================================
-- Qué hace:
--   1. Agrega 'visita' a los tipos de turno (ya existían 'test_drive' y 'llamada').
--   2. Permite que el vendedor marque como realizada o cancele sus propias llamadas y visitas
--      (los test drive los siguen aprobando/cerrando el admin y el supervisor).
--
-- Resultado esperado: "Success. No rows returned".
-- Verificación: Authentication → Policies → turnos tiene la policy turnos_propios.

alter table public.turnos drop constraint turnos_tipo_check;
alter table public.turnos add constraint turnos_tipo_check check (tipo in ('test_drive', 'llamada', 'visita'));

create policy turnos_propios on public.turnos for update to authenticated
  using (tipo <> 'test_drive' and vendedor_id = public.mi_usuario_id())
  with check (tipo <> 'test_drive' and vendedor_id = public.mi_usuario_id());
-- =============================================================
-- Parte 7 · Bloque 4 — Vista "bandeja" con las columnas nuevas
-- =============================================================
-- Qué hace: vuelve a crear la vista bandeja (misma consulta que en la Parte 6) para que incluya
-- las columnas agregadas en los bloques 1 y 2. Una vista guarda la lista de columnas del momento
-- en que se creó, por eso hay que recrearla.
--
-- Resultado esperado: "Success. No rows returned".
-- Verificación: Table Editor → bandeja → aparecen motivo_cierre y ultimo_saliente_en.

drop view public.bandeja;

create view public.bandeja with (security_invoker = true) as
select l.*,
       coalesce(nullif(l.nombre_cliente, ''), nullif(c.nombre_perfil, ''), c.telefono, c.canal_id) as nombre,
       c.canal,
       c.canal_id,
       c.nombre_perfil,
       coalesce(c.telefono, case when c.canal = 'whatsapp' then c.canal_id end) as telefono,
       e.orden   as etapa_orden,
       m.contenido  as ultimo_texto,
       m.tipo       as ultimo_tipo,
       m.direccion  as ultima_direccion,
       m.autor_tipo as ultimo_autor_tipo
from public.leads l
join public.contactos c on c.id = l.contacto_id
left join public.etapas_pipeline e on e.id = l.etapa_id
left join lateral (
  select contenido, tipo, direccion, autor_tipo
  from public.mensajes
  where lead_id = l.id
  order by creado_en desc, id desc
  limit 1
) m on true;
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
