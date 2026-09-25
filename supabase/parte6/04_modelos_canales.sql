-- =============================================================
-- Parte 6 · Bloque 4 — Tabla de modelos y canales "teléfono" y "presencial"
-- =============================================================
-- Qué hace:
--   1. Crea la tabla modelos (los 0km que se ofrecen en el CRM: test drive, ventas, lead).
--   2. Agrega 'telefono' y 'presencial' a los canales permitidos en contactos
--      (para los leads que el vendedor carga a mano). Se mantienen los 5 canales que ya existían.
--
-- Resultado esperado: "Success. No rows returned".
-- Verificación: Table Editor → modelos → 11 filas.

create table public.modelos (
  id         bigint generated always as identity primary key,
  nombre     text not null unique,
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);
alter table public.modelos enable row level security;

insert into public.modelos (nombre) values
  ('Onix'), ('Spark'), ('Captiva'), ('Captiva PHEV'), ('Montana'), ('S10'),
  ('Silverado'), ('Sonic'), ('Spin'), ('Tracker'), ('Trailblazer');

alter table public.contactos drop constraint contactos_canal_check;
alter table public.contactos add constraint contactos_canal_check
  check (canal in ('whatsapp', 'messenger', 'instagram', 'web', 'marketplace', 'telefono', 'presencial'));
