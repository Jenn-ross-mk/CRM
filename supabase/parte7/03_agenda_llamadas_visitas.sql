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
