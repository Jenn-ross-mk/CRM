-- =============================================================
-- Parte 8 · Bloque 2 — Reagendar con motivo obligatorio
-- =============================================================
-- Qué hace:
--   1. Crea la tabla reagendamientos: cada vez que se mueve un agendamiento queda registrado el
--      motivo, la fecha anterior, la nueva y quién lo hizo. Se ve con el lead (mismos permisos).
--   2. Crea la función reagendar_turno(turno, nueva fecha, motivo). Es la única forma de reagendar:
--      exige uno de los 6 motivos y una fecha futura. Un test drive reagendado vuelve a quedar
--      pendiente de aprobación. Lo anota en el historial del lead.
--   3. Crea la función marcar_turno_realizado(turno): el vendedor puede marcar como realizados sus
--      agendamientos (incluido un test drive ya aprobado); admin y supervisor, los de sus sucursales.
--   4. Cuando un agendamiento cambia de fecha, su alerta vuelve a quedar sin resolver.
--
-- Resultado esperado: "Success. No rows returned".
-- Verificación: Table Editor → reagendamientos (vacía); Database → Functions → reagendar_turno.

create table public.reagendamientos (
  id              bigint generated always as identity primary key,
  turno_id        bigint not null references public.turnos (id) on delete cascade,
  lead_id         bigint references public.leads (id) on delete cascade,
  motivo          text not null check (motivo in ('venta_usado', 'falta_dinero_entrega', 'financiacion_no_conveniente',
                                                  'analisis_operacion', 'cambio_anio', 'siniestro')),
  fecha_anterior  timestamptz not null,
  fecha_nueva     timestamptz not null,
  usuario_id      bigint references public.usuarios (id),
  creado_en       timestamptz not null default now()
);
create index idx_reagendamientos_lead on public.reagendamientos (lead_id, creado_en);
alter table public.reagendamientos enable row level security;

create policy reagendamientos_lectura on public.reagendamientos for select to authenticated using (
  (lead_id is not null and public.puede_ver_lead(lead_id))
  or exists (select 1 from public.turnos t where t.id = turno_id and t.vendedor_id = public.mi_usuario_id())
);

-- ¿Puede el usuario logueado mover este agendamiento? Su vendedor, el admin o el supervisor de la sucursal.
create or replace function public.puede_gestionar_turno(t public.turnos)
returns boolean language sql stable security definer set search_path = public as $$
  select t.vendedor_id = public.mi_usuario_id()
      or public.es_admin()
      or (public.mi_rol() = 'supervisor' and (t.sucursal_id in (select public.mis_sucursales())
          or (t.lead_id is not null and public.puede_ver_lead(t.lead_id))))
$$;

create or replace function public.reagendar_turno(p_turno_id bigint, p_fecha_hora timestamptz, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare
  t public.turnos;
  v_motivo text;
begin
  select * into t from public.turnos where id = p_turno_id for update;
  if not found then raise exception 'No se encontró el agendamiento.'; end if;
  if not public.puede_gestionar_turno(t) then raise exception 'No podés reagendar este agendamiento.'; end if;
  if t.estado not in ('pendiente', 'aprobado') then raise exception 'Este agendamiento ya se realizó o se canceló.'; end if;
  v_motivo := case p_motivo
    when 'venta_usado' then 'Venta de su usado'
    when 'falta_dinero_entrega' then 'Falta de dinero para la entrega'
    when 'financiacion_no_conveniente' then 'Financiación no conveniente'
    when 'analisis_operacion' then 'Análisis de la operación'
    when 'cambio_anio' then 'Cambio de año'
    when 'siniestro' then 'Siniestro'
  end;
  if v_motivo is null then raise exception 'Elegí el motivo del reagendamiento.'; end if;
  if p_fecha_hora is null or p_fecha_hora <= now() then raise exception 'Elegí una fecha y hora futuras.'; end if;
  if t.tipo = 'test_drive' and exists (
       select 1 from public.turnos o
        where o.id <> t.id and o.tipo = 'test_drive' and o.sucursal_id = t.sucursal_id and o.vehiculo = t.vehiculo
          and o.fecha_hora = p_fecha_hora and o.estado in ('pendiente', 'aprobado')) then
    raise exception 'Ese vehículo ya tiene un test drive en ese horario. Elegí otro.';
  end if;

  insert into public.reagendamientos (turno_id, lead_id, motivo, fecha_anterior, fecha_nueva, usuario_id)
  values (t.id, t.lead_id, p_motivo, t.fecha_hora, p_fecha_hora, public.mi_usuario_id());

  update public.turnos
     set fecha_hora   = p_fecha_hora,
         estado       = case when tipo = 'test_drive' then 'pendiente' else estado end,
         aprobado_por = case when tipo = 'test_drive' then null else aprobado_por end
   where id = t.id;

  if t.lead_id is not null then
    insert into public.lead_historial (lead_id, tipo, descripcion, usuario_id)
    values (t.lead_id, 'seguimiento',
            case t.tipo when 'test_drive' then 'Test drive reagendado' when 'llamada' then 'Llamada reagendada' else 'Visita reagendada' end
              || ' para el '
              || to_char(p_fecha_hora at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI')
              || '. Motivo: ' || v_motivo,
            public.mi_usuario_id());
  end if;
end;
$$;

create or replace function public.marcar_turno_realizado(p_turno_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare t public.turnos;
begin
  select * into t from public.turnos where id = p_turno_id for update;
  if not found then raise exception 'No se encontró el agendamiento.'; end if;
  if not public.puede_gestionar_turno(t) then raise exception 'No podés modificar este agendamiento.'; end if;
  if t.tipo = 'test_drive' and t.estado <> 'aprobado' then raise exception 'El test drive todavía no está aprobado.'; end if;
  if t.tipo <> 'test_drive' and t.estado <> 'pendiente' then raise exception 'Este agendamiento ya se realizó o se canceló.'; end if;
  update public.turnos set estado = 'hecho' where id = t.id;
end;
$$;

revoke execute on function public.reagendar_turno(bigint, timestamptz, text) from public, anon;
revoke execute on function public.marcar_turno_realizado(bigint) from public, anon;
grant execute on function public.reagendar_turno(bigint, timestamptz, text) to authenticated;
grant execute on function public.marcar_turno_realizado(bigint) to authenticated;

-- La alerta de un agendamiento que cambia de fecha vuelve a quedar sin resolver.
create or replace function public.sincronizar_alerta_turno()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.tipo = 'test_drive' and new.estado = 'aprobado') or (new.tipo <> 'test_drive' and new.estado = 'pendiente') then
    insert into public.alertas as a (usuario_id, lead_id, fecha_hora, mensaje, turno_id)
    values (new.vendedor_id, new.lead_id, new.fecha_hora, public.texto_alerta_turno(new), new.id)
    on conflict (turno_id) where turno_id is not null do update
      set usuario_id = excluded.usuario_id, lead_id = excluded.lead_id,
          fecha_hora = excluded.fecha_hora, mensaje = excluded.mensaje,
          leida      = case when a.fecha_hora is distinct from excluded.fecha_hora then false else a.leida end;
  elsif new.estado = 'hecho' then
    update public.alertas set leida = true where turno_id = new.id;
  else
    delete from public.alertas where turno_id = new.id;
  end if;
  return new;
end;
$$;
