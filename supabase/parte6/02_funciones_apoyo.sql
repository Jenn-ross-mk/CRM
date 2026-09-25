-- =============================================================
-- Parte 6 · Bloque 2 — Funciones de apoyo para los permisos
-- =============================================================
-- Qué hace: crea funciones que responden "¿quién es el usuario logueado?", "¿qué rol tiene?"
-- y "¿qué sucursales puede ver?". Las usan los permisos (RLS) del Bloque 6.
-- Un usuario con activo = false no tiene rol: no ve nada aunque pueda iniciar sesión.
--
-- Resultado esperado: "Success. No rows returned".
-- Verificación: Database → Functions → aparecen mi_usuario_id, mi_rol, es_admin, es_gestion,
-- mis_sucursales, puede_ver_lead y cambiar_mi_estado.

create or replace function public.mi_usuario_id()
returns bigint language sql stable security definer set search_path = public as $$
  select id from public.usuarios where auth_id = auth.uid() and activo
$$;

create or replace function public.mi_rol()
returns text language sql stable security definer set search_path = public as $$
  select rol from public.usuarios where auth_id = auth.uid() and activo
$$;

create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.mi_rol() = 'admin', false)
$$;

create or replace function public.es_gestion()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.mi_rol() in ('admin', 'supervisor'), false)
$$;

-- Sucursales del usuario logueado: la propia y, si es supervisor, las de supervisor_sucursales.
create or replace function public.mis_sucursales()
returns setof bigint language sql stable security definer set search_path = public as $$
  select sucursal_id from public.usuarios where id = public.mi_usuario_id() and sucursal_id is not null
  union
  select sucursal_id from public.supervisor_sucursales where usuario_id = public.mi_usuario_id()
$$;

-- ¿Puede el usuario logueado ver un lead? Admin: todos. Supervisor: los de sus sucursales. Vendedor: los suyos.
create or replace function public.puede_ver_lead(p_lead_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.leads l
    where l.id = p_lead_id and (
      public.es_admin()
      or l.vendedor_id = public.mi_usuario_id()
      or (public.mi_rol() = 'supervisor' and l.sucursal_id in (select public.mis_sucursales()))
    )
  )
$$;

-- El vendedor cambia su propio estado (activo / ocupado / desconectado) sin poder tocar el resto de su ficha.
create or replace function public.cambiar_mi_estado(p_estado text)
returns void language sql security definer set search_path = public as $$
  update public.usuarios set estado = p_estado where id = public.mi_usuario_id()
$$;

revoke execute on function public.cambiar_mi_estado(text) from public, anon;
