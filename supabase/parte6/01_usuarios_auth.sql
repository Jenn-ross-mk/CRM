-- =============================================================
-- Parte 6 · Bloque 1 — Vincular usuarios con las cuentas de login (Supabase Auth)
-- =============================================================
-- Qué hace:
--   1. Agrega a "usuarios" la columna auth_id (el id de su cuenta de login).
--   2. Crea un trigger en auth.users: cuando se crea (o se confirma) una cuenta de login,
--      la vincula con el usuario que tenga el mismo email. Si no existe, lo crea con los
--      datos que manda el CRM (app_metadata, que solo puede escribir el servidor).
--
-- Resultado esperado: "Success. No rows returned".
-- Verificación: Table Editor → usuarios → aparece la columna auth_id (vacía por ahora).

alter table public.usuarios
  add column auth_id uuid unique references auth.users (id) on delete set null;

create or replace function public.vincular_usuario_auth()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_app_meta_data, '{}'::jsonb);
begin
  -- Solo cuentas con el email confirmado (el CRM y el panel de Supabase las crean ya confirmadas).
  if new.email is null or new.email_confirmed_at is null then
    return new;
  end if;
  if exists (select 1 from public.usuarios where auth_id = new.id) then
    return new;
  end if;

  update public.usuarios
     set auth_id = new.id
   where lower(email) = lower(new.email) and auth_id is null;

  if not found and not exists (select 1 from public.usuarios where lower(email) = lower(new.email)) then
    insert into public.usuarios (nombre, email, telefono, rol, sucursal_id, sector, auth_id)
    values (
      coalesce(nullif(meta ->> 'nombre', ''), split_part(new.email, '@', 1)),
      lower(new.email),
      nullif(meta ->> 'telefono', ''),
      coalesce(nullif(meta ->> 'rol', ''), 'vendedor'),
      nullif(meta ->> 'sucursal_id', '')::bigint,
      nullif(meta ->> 'sector', ''),
      new.id
    );
  end if;
  return new;
end;
$$;

create trigger trg_vincular_usuario_auth
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.vincular_usuario_auth();
