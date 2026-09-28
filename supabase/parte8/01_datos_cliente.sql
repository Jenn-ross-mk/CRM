-- =============================================================
-- Parte 8 · Bloque 1 — Datos opcionales del perfil del cliente
-- =============================================================
-- Qué hace: agrega a leads tres datos que se cargan desde el perfil del cliente (ninguno es obligatorio):
--   · email;
--   · preferencias: texto libre (color, versión, equipamiento, horarios para contactarlo, etc.);
--   · usado_descripcion: el usado que entregaría (marca, modelo, año, kilómetros).
-- Los demás datos del perfil (modelo de interés, forma de pago, monto, urgencia, uso, etc.) ya existían.
--
-- Resultado esperado: "Success. No rows returned".
-- Verificación: Table Editor → leads → aparecen email, preferencias y usado_descripcion.

alter table public.leads
  add column email             text,
  add column preferencias      text,
  add column usado_descripcion text;
