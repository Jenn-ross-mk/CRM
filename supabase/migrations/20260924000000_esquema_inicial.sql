-- =============================================================
-- Akar CRM — esquema inicial
-- Roles: vendedor, supervisor (acotado a su sucursal), administrador
-- =============================================================

create type public.rol as enum ('vendedor', 'supervisor', 'administrador');
create type public.sector as enum ('Convencional', 'Plan de ahorro');
create type public.canal as enum ('WhatsApp', 'Instagram', 'Web', 'Marketplace', 'Teléfono', 'Presencial');
create type public.estado_test_drive as enum ('pendiente', 'aprobado', 'rechazado', 'hecho');
create type public.estado_usuario as enum ('Activo', 'Ocupado', 'Desconectado');

-- ---------- Sucursales ----------
create table public.sucursales (
  id bigint generated always as identity primary key,
  nombre text not null unique,
  direccion text not null default '',
  telefono text not null default '',
  created_at timestamptz not null default now()
);

-- ---------- Perfiles (1:1 con auth.users) ----------
create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null,
  email text not null unique,
  telefono text not null default '',
  rol public.rol not null default 'vendedor',
  sucursal_id bigint references public.sucursales (id) on delete set null,
  sector public.sector,
  estado public.estado_usuario not null default 'Activo',
  created_at timestamptz not null default now()
);
create index perfiles_sucursal_idx on public.perfiles (sucursal_id);

-- ---------- Modelos (catálogo simple de vehículos) ----------
create table public.modelos (
  id bigint generated always as identity primary key,
  nombre text not null unique,
  activo boolean not null default true
);

-- ---------- Leads / conversaciones ----------
create table public.leads (
  id bigint generated always as identity primary key,
  nombre text not null,
  telefono text not null default '',
  canal public.canal not null default 'WhatsApp',
  sucursal_id bigint references public.sucursales (id) on delete set null,
  sector public.sector not null default 'Convencional',
  vendedor_id uuid references public.perfiles (id) on delete set null,
  modelo text not null default '—',
  forma_pago text not null default 'A definir',
  presupuesto text not null default '—',
  etapa smallint not null default 0 check (etapa between 0 and 5),
  etapa_actualizada_at timestamptz not null default now(),
  tags text[] not null default '{}',
  prioridad text not null default 'media' check (prioridad in ('alta', 'media', 'baja')),
  leido boolean not null default false,
  ultimo_mensaje_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index leads_vendedor_idx on public.leads (vendedor_id);
create index leads_sucursal_idx on public.leads (sucursal_id);
create index leads_ultimo_idx on public.leads (ultimo_mensaje_at desc);

create table public.mensajes (
  id bigint generated always as identity primary key,
  lead_id bigint not null references public.leads (id) on delete cascade,
  direccion text not null check (direccion in ('in', 'out')),
  texto text not null,
  autor_id uuid references public.perfiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index mensajes_lead_idx on public.mensajes (lead_id, created_at);

create table public.notas (
  id bigint generated always as identity primary key,
  lead_id bigint not null references public.leads (id) on delete cascade,
  autor_id uuid references public.perfiles (id) on delete set null,
  texto text not null,
  created_at timestamptz not null default now()
);
create index notas_lead_idx on public.notas (lead_id, created_at);

-- ---------- Alertas / recordatorios ----------
create table public.alertas (
  id bigint generated always as identity primary key,
  owner_id uuid not null references public.perfiles (id) on delete cascade,
  lead_id bigint references public.leads (id) on delete cascade,
  mensaje text not null,
  fecha timestamptz not null,
  created_at timestamptz not null default now()
);
create index alertas_owner_idx on public.alertas (owner_id, fecha);
create index alertas_lead_idx on public.alertas (lead_id);

-- ---------- Test drives ----------
create table public.test_drives (
  id bigint generated always as identity primary key,
  vehiculo text not null,
  sucursal_id bigint references public.sucursales (id) on delete set null,
  cliente text not null,
  telefono text not null default '',
  lead_id bigint references public.leads (id) on delete set null,
  vendedor_id uuid references public.perfiles (id) on delete set null,
  fecha date not null,
  hora time not null,
  estado public.estado_test_drive not null default 'pendiente',
  created_at timestamptz not null default now()
);
create index test_drives_fecha_idx on public.test_drives (fecha);

-- ---------- Ventas ----------
create table public.ventas (
  id bigint generated always as identity primary key,
  cliente text not null,
  vehiculo text not null,
  vendedor_id uuid references public.perfiles (id) on delete set null,
  sucursal_id bigint references public.sucursales (id) on delete set null,
  sector public.sector not null,
  fecha date not null default current_date,
  monto text not null default '—',
  extra jsonb not null default '[]'::jsonb,
  lead_id bigint unique references public.leads (id) on delete set null,
  created_at timestamptz not null default now()
);
create index ventas_fecha_idx on public.ventas (fecha desc);

-- ---------- Panel general ----------
create table public.comunicados (
  id bigint generated always as identity primary key,
  tag text not null default 'INFO',
  texto text not null,
  detalle text not null default '',
  created_at timestamptz not null default now()
);

create table public.giras (
  id bigint generated always as identity primary key,
  destino text not null,
  fecha text not null default 'A confirmar',
  unidades text not null default 'Por confirmar',
  created_at timestamptz not null default now()
);

create table public.entregas (
  id bigint generated always as identity primary key,
  vehiculo text not null,
  cliente text not null default '—',
  dia text not null default 'Por definir',
  hecha boolean not null default false,
  created_at timestamptz not null default now()
);

-- =============================================================
-- Funciones auxiliares para RLS (security definer para evitar recursión)
-- =============================================================
create or replace function public.mi_rol()
returns public.rol language sql stable security definer set search_path = public as $$
  select rol from public.perfiles where id = auth.uid()
$$;

create or replace function public.mi_sucursal()
returns bigint language sql stable security definer set search_path = public as $$
  select sucursal_id from public.perfiles where id = auth.uid()
$$;

create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select rol = 'administrador' from public.perfiles where id = auth.uid()), false)
$$;

create or replace function public.es_gestion()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select rol in ('administrador', 'supervisor') from public.perfiles where id = auth.uid()), false)
$$;

-- ¿Puede el usuario actual ver/gestionar un lead?
create or replace function public.puede_ver_lead(p_lead_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.leads l
    where l.id = p_lead_id and (
      public.es_admin()
      or l.vendedor_id = auth.uid()
      or (public.mi_rol() = 'supervisor' and l.sucursal_id = public.mi_sucursal())
    )
  )
$$;

-- Al crearse un usuario en auth, crear su perfil con los metadatos enviados.
create or replace function public.crear_perfil_desde_auth()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, nombre, email, telefono, rol, sucursal_id, sector)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'telefono', ''),
    coalesce((new.raw_user_meta_data ->> 'rol')::public.rol, 'vendedor'),
    nullif(new.raw_user_meta_data ->> 'sucursal_id', '')::bigint,
    nullif(new.raw_user_meta_data ->> 'sector', '')::public.sector
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.crear_perfil_desde_auth();

-- Cada mensaje actualiza la actividad del lead; los entrantes lo marcan como no leído.
create or replace function public.actualizar_lead_por_mensaje()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.leads
     set ultimo_mensaje_at = new.created_at,
         leido = case when new.direccion = 'in' then false else leido end
   where id = new.lead_id;
  return new;
end;
$$;

create trigger mensajes_actualizan_lead
  after insert on public.mensajes
  for each row execute function public.actualizar_lead_por_mensaje();

-- Registrar cuándo cambió la etapa (para detectar leads estancados).
create or replace function public.marcar_cambio_etapa()
returns trigger language plpgsql as $$
begin
  if new.etapa is distinct from old.etapa then
    new.etapa_actualizada_at := now();
  end if;
  return new;
end;
$$;

create trigger leads_cambio_etapa
  before update on public.leads
  for each row execute function public.marcar_cambio_etapa();

-- =============================================================
-- Row Level Security
-- =============================================================
alter table public.sucursales enable row level security;
alter table public.perfiles enable row level security;
alter table public.modelos enable row level security;
alter table public.leads enable row level security;
alter table public.mensajes enable row level security;
alter table public.notas enable row level security;
alter table public.alertas enable row level security;
alter table public.test_drives enable row level security;
alter table public.ventas enable row level security;
alter table public.comunicados enable row level security;
alter table public.giras enable row level security;
alter table public.entregas enable row level security;

-- Sucursales y modelos: lectura para todo usuario autenticado, escritura solo admin.
create policy "sucursales_lectura" on public.sucursales for select to authenticated using (true);
create policy "sucursales_admin" on public.sucursales for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy "modelos_lectura" on public.modelos for select to authenticated using (true);
create policy "modelos_admin" on public.modelos for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- Perfiles: todos ven el equipo (ranking, asignaciones). Cada uno edita su estado; el admin edita todo.
create policy "perfiles_lectura" on public.perfiles for select to authenticated using (true);
create policy "perfiles_propio" on public.perfiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and rol = public.mi_rol() and sucursal_id is not distinct from public.mi_sucursal());
create policy "perfiles_admin" on public.perfiles for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- Leads
create policy "leads_lectura" on public.leads for select to authenticated using (
  public.es_admin()
  or vendedor_id = auth.uid()
  or (public.mi_rol() = 'supervisor' and sucursal_id = public.mi_sucursal())
);
create policy "leads_alta" on public.leads for insert to authenticated with check (
  public.es_admin()
  or (public.mi_rol() = 'supervisor' and sucursal_id = public.mi_sucursal())
  or (public.mi_rol() = 'vendedor' and vendedor_id = auth.uid())
);
create policy "leads_edicion" on public.leads for update to authenticated using (
  public.es_admin()
  or vendedor_id = auth.uid()
  or (public.mi_rol() = 'supervisor' and sucursal_id = public.mi_sucursal())
) with check (
  public.es_admin()
  or (public.mi_rol() = 'supervisor' and sucursal_id = public.mi_sucursal())
  or (public.mi_rol() = 'vendedor' and vendedor_id = auth.uid())
);
create policy "leads_baja" on public.leads for delete to authenticated using (public.es_admin());

-- Mensajes y notas: siguen la visibilidad del lead.
create policy "mensajes_lectura" on public.mensajes for select to authenticated using (public.puede_ver_lead(lead_id));
create policy "mensajes_alta" on public.mensajes for insert to authenticated with check (public.puede_ver_lead(lead_id));
create policy "notas_lectura" on public.notas for select to authenticated using (public.puede_ver_lead(lead_id));
create policy "notas_alta" on public.notas for insert to authenticated with check (public.puede_ver_lead(lead_id) and autor_id = auth.uid());

-- Alertas: propias, o asociadas a un lead visible.
create policy "alertas_lectura" on public.alertas for select to authenticated using (
  owner_id = auth.uid() or (lead_id is not null and public.puede_ver_lead(lead_id))
);
create policy "alertas_alta" on public.alertas for insert to authenticated with check (
  owner_id = auth.uid() and (lead_id is null or public.puede_ver_lead(lead_id))
);
create policy "alertas_baja" on public.alertas for delete to authenticated using (owner_id = auth.uid());

-- Test drives: todos ven la agenda (para ver turnos ocupados); el vendedor solicita; gestión aprueba.
create policy "td_lectura" on public.test_drives for select to authenticated using (true);
create policy "td_alta" on public.test_drives for insert to authenticated with check (
  estado = 'pendiente' and (vendedor_id = auth.uid() or public.es_gestion())
);
create policy "td_gestion" on public.test_drives for update to authenticated using (
  public.es_admin() or (public.mi_rol() = 'supervisor' and sucursal_id = public.mi_sucursal())
);

-- Ventas: todos leen (el ranking es público dentro del equipo); gestión o el vendedor del lead registran.
create policy "ventas_lectura" on public.ventas for select to authenticated using (true);
create policy "ventas_alta" on public.ventas for insert to authenticated with check (
  public.es_admin()
  or (public.mi_rol() = 'supervisor' and sucursal_id = public.mi_sucursal())
  or vendedor_id = auth.uid()
);
create policy "ventas_edicion" on public.ventas for update to authenticated using (
  public.es_admin() or (public.mi_rol() = 'supervisor' and sucursal_id = public.mi_sucursal())
);
create policy "ventas_baja" on public.ventas for delete to authenticated using (
  public.es_admin() or vendedor_id = auth.uid()
);

-- Panel general: lectura para todos, gestión para admin y supervisores.
create policy "comunicados_lectura" on public.comunicados for select to authenticated using (true);
create policy "comunicados_gestion" on public.comunicados for all to authenticated using (public.es_gestion()) with check (public.es_gestion());
create policy "giras_lectura" on public.giras for select to authenticated using (true);
create policy "giras_gestion" on public.giras for all to authenticated using (public.es_gestion()) with check (public.es_gestion());
create policy "entregas_lectura" on public.entregas for select to authenticated using (true);
create policy "entregas_gestion" on public.entregas for all to authenticated using (public.es_gestion()) with check (public.es_gestion());
