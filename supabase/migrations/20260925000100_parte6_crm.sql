-- Parte 6 del proyecto (CRM). Mismo contenido que supabase/parte6/01..08, en un solo archivo.
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
-- =============================================================
-- Parte 6 · Bloque 3 — Columnas nuevas de leads y triggers que las mantienen
-- =============================================================
-- Qué hace:
--   1. Agrega a leads: prioridad, leido, ultimo_mensaje_en y etapa_actualizada_en.
--   2. Completa ultimo_mensaje_en en los leads que ya existen.
--   3. El trigger de mensajes ahora también: actualiza ultimo_mensaje_en con cualquier
--      mensaje y marca el lead como no leído (leido = false) cuando el mensaje es entrante.
--      Sigue haciendo lo de antes: vendedor escribe → modo 'humano'; cliente escribe →
--      ultima_interaccion.
--   4. El trigger de leads ahora también guarda cuándo cambió la etapa.
--   5. El registro de cambio de etapa pasa a guardar quién lo hizo.
--
-- Resultado esperado: "Success. No rows returned".
-- Verificación: Table Editor → leads → aparecen las 4 columnas nuevas; ultimo_mensaje_en tiene fecha.

alter table public.leads
  add column prioridad            text        not null default 'media' check (prioridad in ('alta', 'media', 'baja')),
  add column leido                boolean     not null default false,
  add column ultimo_mensaje_en    timestamptz not null default now(),
  add column etapa_actualizada_en timestamptz not null default now();

update public.leads l
   set ultimo_mensaje_en = coalesce((select max(m.creado_en) from public.mensajes m where m.lead_id = l.id), l.creado_en),
       etapa_actualizada_en = l.creado_en;

create index idx_leads_ultimo_mensaje on public.leads (ultimo_mensaje_en desc);

create or replace function public.al_guardar_mensaje()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.leads
     set ultimo_mensaje_en  = greatest(ultimo_mensaje_en, new.creado_en),
         leido              = case when new.direccion = 'entrante' then false else leido end,
         modo               = case when new.autor_tipo = 'vendedor' then 'humano' else modo end,
         ultima_interaccion = case when new.autor_tipo = 'cliente' then new.creado_en else ultima_interaccion end
   where id = new.lead_id;
  return new;
end;
$$;

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
  return new;
end;
$$;

create or replace function public.registrar_cambio_etapa()
returns trigger language plpgsql security definer set search_path = public as $$
declare nombre_etapa text;
begin
  if new.etapa_id is distinct from old.etapa_id and new.etapa_id is not null then
    select nombre into nombre_etapa from public.etapas_pipeline where id = new.etapa_id;
    insert into public.lead_historial (lead_id, tipo, descripcion, usuario_id)
    values (new.id, 'etapa', 'Pasó a la etapa: ' || nombre_etapa, public.mi_usuario_id());
  end if;
  return new;
end;
$$;
-- =============================================================
-- Parte 6 · Bloque 4 — Tabla de modelos y canales "teléfono" y "presencial"
-- =============================================================
-- Qué hace:
--   1. Crea la tabla modelos (los 0km que se ofrecen en el CRM: test drive, ventas, lead).
--   2. Agrega 'telefono' y 'presencial' a los canales permitidos en contactos
--      (para los leads que el vendedor carga a mano).
--      ⚠ La lista de canales de abajo se confirma con el resultado del Bloque 0.
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
-- =============================================================
-- Parte 6 · Bloque 5 — Vista "bandeja"
-- =============================================================
-- Qué hace: crea una vista (una consulta guardada) con cada lead, los datos de su contacto
-- y el último mensaje. La usa la bandeja del CRM.
-- security_invoker = true → la vista respeta los permisos de quien la consulta.
--
-- Resultado esperado: "Success. No rows returned".
-- Verificación: Table Editor → bandeja (aparece como vista) → una fila por lead.

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
-- Parte 6 · Bloque 6 — Permisos (RLS): catálogos y equipo
-- =============================================================
-- Qué hace: define quién puede leer y escribir cada tabla.
--   · Catálogos (sucursales, localidades, etapas, etiquetas, plantillas, modelos):
--     los lee cualquier usuario logueado; solo el admin los modifica.
--   · usuarios: todos ven al equipo (nombres, fotos, ranking); solo el admin modifica.
--     Cada vendedor cambia su propio estado con la función cambiar_mi_estado.
--   · horarios_vendedor: cada uno ve los suyos; admin y supervisores ven todos; solo el admin los carga.
--   · supervisor_sucursales: lectura para todos; solo el admin modifica.
-- n8n se conecta con la clave service_role, que no pasa por estos permisos.
--
-- Resultado esperado: "Success. No rows returned".
-- Verificación: Authentication → Policies → cada una de estas tablas tiene sus policies.

create policy sucursales_lectura on public.sucursales for select to authenticated using (true);
create policy sucursales_admin   on public.sucursales for all    to authenticated using (public.es_admin()) with check (public.es_admin());

create policy localidades_lectura on public.localidades for select to authenticated using (true);
create policy localidades_admin   on public.localidades for all    to authenticated using (public.es_admin()) with check (public.es_admin());

create policy etapas_lectura on public.etapas_pipeline for select to authenticated using (true);
create policy etapas_admin   on public.etapas_pipeline for all    to authenticated using (public.es_admin()) with check (public.es_admin());

create policy etiquetas_lectura on public.etiquetas for select to authenticated using (true);
create policy etiquetas_admin   on public.etiquetas for all    to authenticated using (public.es_admin()) with check (public.es_admin());

create policy plantillas_lectura on public.plantillas for select to authenticated using (true);
create policy plantillas_admin   on public.plantillas for all    to authenticated using (public.es_admin()) with check (public.es_admin());

create policy modelos_lectura on public.modelos for select to authenticated using (true);
create policy modelos_admin   on public.modelos for all    to authenticated using (public.es_admin()) with check (public.es_admin());

create policy usuarios_lectura on public.usuarios for select to authenticated using (true);
create policy usuarios_admin   on public.usuarios for all    to authenticated using (public.es_admin()) with check (public.es_admin());

create policy horarios_lectura on public.horarios_vendedor for select to authenticated
  using (usuario_id = public.mi_usuario_id() or public.es_gestion());
create policy horarios_admin on public.horarios_vendedor for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

create policy supervisor_sucursales_lectura on public.supervisor_sucursales for select to authenticated using (true);
create policy supervisor_sucursales_admin   on public.supervisor_sucursales for all    to authenticated using (public.es_admin()) with check (public.es_admin());
-- =============================================================
-- Parte 6 · Bloque 7 — Permisos (RLS): leads y conversaciones
-- =============================================================
-- Regla general: el vendedor ve lo suyo, el supervisor lo de sus sucursales y el admin todo.
--   · leads: ver y editar según esa regla. No se borran.
--   · contactos: se ven si se puede ver alguno de sus leads.
--   · mensajes: se ven con el lead; desde el CRM solo se escriben mensajes salientes
--     firmados por el propio usuario (quedan "pendientes" hasta que n8n los envíe).
--   · asignaciones: se ven con el lead; admin y supervisores registran reasignaciones.
--   · etiquetas del lead, notas e historial: siguen al lead.
-- Los leads nuevos los crean n8n (service_role) o el CRM desde el servidor.
--
-- Resultado esperado: "Success. No rows returned".
-- Verificación: Authentication → Policies → leads, contactos, mensajes, asignaciones,
-- lead_etiquetas, notas y lead_historial tienen sus policies.

create policy leads_lectura on public.leads for select to authenticated using (
  public.es_admin()
  or vendedor_id = public.mi_usuario_id()
  or (public.mi_rol() = 'supervisor' and sucursal_id in (select public.mis_sucursales()))
);
create policy leads_edicion on public.leads for update to authenticated using (
  public.es_admin()
  or vendedor_id = public.mi_usuario_id()
  or (public.mi_rol() = 'supervisor' and sucursal_id in (select public.mis_sucursales()))
) with check (
  public.es_admin()
  or (public.mi_rol() = 'vendedor' and vendedor_id = public.mi_usuario_id())
  or (public.mi_rol() = 'supervisor' and sucursal_id in (select public.mis_sucursales()))
);

create policy contactos_lectura on public.contactos for select to authenticated using (
  exists (select 1 from public.leads l where l.contacto_id = contactos.id)
);

create policy mensajes_lectura on public.mensajes for select to authenticated using (public.puede_ver_lead(lead_id));
create policy mensajes_alta on public.mensajes for insert to authenticated with check (
  public.puede_ver_lead(lead_id)
  and direccion = 'saliente'
  and autor_tipo = 'vendedor'
  and autor_usuario_id = public.mi_usuario_id()
);

create policy asignaciones_lectura on public.asignaciones for select to authenticated using (public.puede_ver_lead(lead_id));
create policy asignaciones_alta on public.asignaciones for insert to authenticated with check (
  public.es_gestion() and public.puede_ver_lead(lead_id)
);

create policy lead_etiquetas_lectura on public.lead_etiquetas for select to authenticated using (public.puede_ver_lead(lead_id));
create policy lead_etiquetas_alta    on public.lead_etiquetas for insert to authenticated with check (public.puede_ver_lead(lead_id));
create policy lead_etiquetas_baja    on public.lead_etiquetas for delete to authenticated using (public.puede_ver_lead(lead_id));

create policy notas_lectura on public.notas for select to authenticated using (public.puede_ver_lead(lead_id));
create policy notas_alta on public.notas for insert to authenticated with check (
  public.puede_ver_lead(lead_id) and usuario_id = public.mi_usuario_id()
);

create policy historial_lectura on public.lead_historial for select to authenticated using (public.puede_ver_lead(lead_id));
create policy historial_alta on public.lead_historial for insert to authenticated with check (
  public.puede_ver_lead(lead_id) and usuario_id = public.mi_usuario_id()
);
-- =============================================================
-- Parte 6 · Bloque 8 — Permisos (RLS): gestión comercial
-- =============================================================
--   · alertas: cada uno ve, crea, marca y borra las suyas; también se ven las de un lead visible.
--   · turnos (test drive): todos ven la agenda; el vendedor solicita (queda pendiente);
--     admin y supervisor de la sucursal aprueban, rechazan o marcan realizado.
--   · ventas: todos las leen (ranking); admin y supervisor de la sucursal registran y editan.
--     El vendedor solo registra la venta de un lead propio que llegó a la última etapa.
--   · comunicados, giras y entregas: todos leen; admin y supervisores modifican.
--
-- Resultado esperado: "Success. No rows returned".
-- Verificación: Authentication → Policies → ninguna de las 22 tablas dice "No policies".

create policy alertas_lectura on public.alertas for select to authenticated using (
  usuario_id = public.mi_usuario_id() or (lead_id is not null and public.puede_ver_lead(lead_id))
);
create policy alertas_alta on public.alertas for insert to authenticated with check (
  usuario_id = public.mi_usuario_id() and (lead_id is null or public.puede_ver_lead(lead_id))
);
create policy alertas_edicion on public.alertas for update to authenticated
  using (usuario_id = public.mi_usuario_id()) with check (usuario_id = public.mi_usuario_id());
create policy alertas_baja on public.alertas for delete to authenticated using (usuario_id = public.mi_usuario_id());

create policy turnos_lectura on public.turnos for select to authenticated using (true);
create policy turnos_alta on public.turnos for insert to authenticated with check (
  estado = 'pendiente' and (vendedor_id = public.mi_usuario_id() or public.es_gestion())
);
create policy turnos_gestion on public.turnos for update to authenticated using (
  public.es_admin() or (public.mi_rol() = 'supervisor' and sucursal_id in (select public.mis_sucursales()))
);

create policy ventas_lectura on public.ventas for select to authenticated using (true);
create policy ventas_alta on public.ventas for insert to authenticated with check (
  public.es_admin()
  or (public.mi_rol() = 'supervisor' and sucursal_id in (select public.mis_sucursales()))
  or (
    vendedor_id = public.mi_usuario_id()
    and lead_id is not null
    and exists (
      select 1 from public.leads l
      join public.etapas_pipeline e on e.id = l.etapa_id
      where l.id = lead_id
        and l.vendedor_id = public.mi_usuario_id()
        and e.orden = (select max(orden) from public.etapas_pipeline where sector = e.sector)
    )
  )
);
create policy ventas_edicion on public.ventas for update to authenticated using (
  public.es_admin() or (public.mi_rol() = 'supervisor' and sucursal_id in (select public.mis_sucursales()))
);
create policy ventas_baja on public.ventas for delete to authenticated using (
  public.es_admin() or (vendedor_id = public.mi_usuario_id() and lead_id is not null)
);

create policy comunicados_lectura on public.comunicados for select to authenticated using (true);
create policy comunicados_gestion on public.comunicados for all to authenticated using (public.es_gestion()) with check (public.es_gestion());

create policy giras_lectura on public.giras_plan_ahorro for select to authenticated using (true);
create policy giras_gestion on public.giras_plan_ahorro for all to authenticated using (public.es_gestion()) with check (public.es_gestion());

create policy entregas_lectura on public.entregas for select to authenticated using (true);
create policy entregas_gestion on public.entregas for all to authenticated using (public.es_gestion()) with check (public.es_gestion());
