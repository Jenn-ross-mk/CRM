-- =============================================================
-- Parte 7 · Bloque 6 — Cada agendamiento crea su alerta
-- =============================================================
-- Qué hace:
--   1. Agrega a alertas la columna turno_id: la alerta que nació de un agendamiento.
--   2. Un trigger en turnos mantiene esa alerta al día, para el vendedor del agendamiento
--      y para el día y la hora del agendamiento:
--      · llamada o visita: la alerta se crea al agendarla;
--      · test drive: la alerta se crea recién cuando se aprueba;
--      · si se cancela o se rechaza, la alerta se borra; si se marca realizado, queda como leída.
--   3. Crea las alertas de los agendamientos vigentes de hoy en adelante que ya existen.
--
-- Resultado esperado: "Success. No rows returned".
-- Verificación: Table Editor → alertas → aparece turno_id; los test drive aprobados futuros tienen su alerta.

alter table public.alertas add column turno_id bigint references public.turnos (id) on delete cascade;
create unique index idx_alertas_turno on public.alertas (turno_id) where turno_id is not null;

create or replace function public.texto_alerta_turno(t public.turnos)
returns text language sql immutable as $$
  select case t.tipo
           when 'test_drive' then 'Test drive' || coalesce(' · ' || t.vehiculo, '') || ' con ' || t.cliente_nombre
           when 'llamada'    then 'Llamada a ' || t.cliente_nombre
           else 'Visita de ' || t.cliente_nombre
         end
$$;

create or replace function public.sincronizar_alerta_turno()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.tipo = 'test_drive' and new.estado = 'aprobado') or (new.tipo <> 'test_drive' and new.estado = 'pendiente') then
    insert into public.alertas (usuario_id, lead_id, fecha_hora, mensaje, turno_id)
    values (new.vendedor_id, new.lead_id, new.fecha_hora, public.texto_alerta_turno(new), new.id)
    on conflict (turno_id) where turno_id is not null do update
      set usuario_id = excluded.usuario_id, lead_id = excluded.lead_id,
          fecha_hora = excluded.fecha_hora, mensaje = excluded.mensaje;
  elsif new.estado = 'hecho' then
    update public.alertas set leida = true where turno_id = new.id;
  else
    delete from public.alertas where turno_id = new.id;
  end if;
  return new;
end;
$$;

create trigger trg_sincronizar_alerta_turno
  after insert or update of estado, fecha_hora, vendedor_id, lead_id on public.turnos
  for each row execute function public.sincronizar_alerta_turno();

insert into public.alertas (usuario_id, lead_id, fecha_hora, mensaje, turno_id)
select t.vendedor_id, t.lead_id, t.fecha_hora, public.texto_alerta_turno(t), t.id
  from public.turnos t
 where t.fecha_hora >= date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires') at time zone 'America/Argentina/Buenos_Aires'
   and ((t.tipo = 'test_drive' and t.estado = 'aprobado') or (t.tipo <> 'test_drive' and t.estado = 'pendiente'))
on conflict do nothing;
