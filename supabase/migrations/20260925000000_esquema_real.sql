-- =============================================================
-- Akar CRM + bot — ESQUEMA REAL (Partes 1 a 5 del registro del proyecto)
-- =============================================================
-- ⚠ Este archivo DOCUMENTA lo que ya se ejecutó en la base Supabase de prueba.
--   NO volver a correrlo en esa base: ya está aplicado. Sirve para armar una base nueva
--   desde cero (por ejemplo, la de producción) con `supabase db push`.
--
-- ⚠ Algunas listas de valores permitidos (check) quedaron cortadas en el registro de la
--   conversación. Las marcadas con "(verificar)" se confirman con el resultado de
--   supabase/parte6/00_verificacion.sql y se corrigen acá si hace falta.
-- =============================================================

-- ---------- Parte 1: estructura de la empresa ----------
create table sucursales (
  id          bigint generated always as identity primary key,
  nombre      text not null unique,
  direccion   text,
  telefono    text,
  activa      boolean not null default true,
  creado_en   timestamptz not null default now()
);

create table localidades (
  id           bigint generated always as identity primary key,
  nombre       text not null unique,
  sucursal_id  bigint not null references sucursales(id),
  creado_en    timestamptz not null default now()
);

create table usuarios (
  id           bigint generated always as identity primary key,
  nombre       text not null,
  email        text not null unique,
  telefono     text,
  foto_url     text,
  rol          text not null check (rol in ('vendedor','supervisor','admin')),
  sucursal_id  bigint references sucursales(id),
  sector       text check (sector in ('convencional','plan_ahorro','usados','postventa','repuestos')),   -- (verificar)
  estado       text not null default 'desconectado' check (estado in ('activo','ocupado','desconectado')), -- (verificar)
  activo       boolean not null default true,
  creado_en    timestamptz not null default now()
);

alter table sucursales  enable row level security;
alter table localidades enable row level security;
alter table usuarios    enable row level security;

-- ---------- Parte 2: leads y conversaciones ----------
create table contactos (
  id             bigint generated always as identity primary key,
  canal          text not null check (canal in ('whatsapp','messenger','instagram')), -- (verificar) · la Parte 6 la amplía
  canal_id       text not null,
  nombre_perfil  text,
  telefono       text,
  creado_en      timestamptz not null default now(),
  unique (canal, canal_id)
);

create table leads (
  id                     bigint generated always as identity primary key,
  contacto_id            bigint not null references contactos(id),
  modo                   text not null default 'bot' check (modo in ('bot','humano')), -- (verificar)
  estado                 text not null default 'en_conversacion'
                         check (estado in ('en_conversacion','en_cola','derivado','perdido','recuperar','no_contactar')), -- se reemplaza en la Parte 5
  sucursal_id            bigint references sucursales(id),
  sector                 text check (sector in ('convencional','plan_ahorro','usados','postventa','repuestos')), -- (verificar)
  vendedor_id            bigint references usuarios(id),
  nombre_cliente         text,
  localidad              text,
  clasificacion          text check (clasificacion in ('frio','tibio','caliente')),
  tipo                   text check (tipo in ('0km','usado','promocion')),
  vehiculo_interes       text,
  marca                  text,
  modelo_anio            text,
  uso                    text check (uso in ('comercial','familiar','laboral')),
  forma_pago             text check (forma_pago in ('financiacion','plan_ahorro','contado')), -- (verificar)
  entrega_vehiculo       boolean,
  entrega_capital        boolean,
  monto_capital          text,
  urgencia               text,
  contexto_conversacion  text,
  seguimiento_n          smallint not null default 0,
  strike_precio          smallint not null default 0,
  ultima_interaccion     timestamptz,
  derivado_en            timestamptz,
  creado_en              timestamptz not null default now(),
  actualizado_en         timestamptz not null default now()
);

create table mensajes (
  id                bigint generated always as identity primary key,
  lead_id           bigint not null references leads(id) on delete cascade,
  direccion         text not null check (direccion in ('entrante','saliente')),
  autor_tipo        text not null check (autor_tipo in ('cliente','bot','vendedor')), -- (verificar)
  autor_usuario_id  bigint references usuarios(id),
  tipo              text not null default 'texto' check (tipo in ('texto','imagen','audio','documento','video','plantilla')), -- (verificar)
  contenido         text,
  media_url         text,
  canal_mensaje_id  text unique,
  estado_envio      text check (estado_envio in ('pendiente','enviado','entregado','leido','error')), -- (verificar)
  creado_en         timestamptz not null default now(),
  check (autor_tipo <> 'vendedor' or autor_usuario_id is not null)
);

create table asignaciones (
  id           bigint generated always as identity primary key,
  lead_id      bigint not null references leads(id) on delete cascade,
  vendedor_id  bigint not null references usuarios(id),
  motivo       text not null check (motivo in ('automatica','reasignacion','manual')), -- (verificar)
  asignado_en  timestamptz not null default now()
);

create index idx_leads_contacto on leads(contacto_id);
create index idx_leads_vendedor on leads(vendedor_id);
create index idx_mensajes_lead_fecha on mensajes(lead_id, creado_en);
create index idx_asignaciones_vendedor on asignaciones(vendedor_id, asignado_en);

create function al_guardar_mensaje() returns trigger language plpgsql as $$
begin
  if new.autor_tipo = 'vendedor' then
    update leads set modo = 'humano' where id = new.lead_id;
  elsif new.autor_tipo = 'cliente' then
    update leads set ultima_interaccion = new.creado_en where id = new.lead_id;
  end if;
  return new;
end;
$$;
create trigger trg_al_guardar_mensaje after insert on mensajes
  for each row execute function al_guardar_mensaje();

create function antes_de_guardar_lead() returns trigger language plpgsql as $$
begin
  new.actualizado_en = now();
  if new.vendedor_id is not null then
    new.modo = 'humano';
  end if;
  return new;
end;
$$;
create trigger trg_antes_de_guardar_lead before insert or update on leads
  for each row execute function antes_de_guardar_lead();

alter table contactos    enable row level security;
alter table leads        enable row level security;
alter table mensajes     enable row level security;
alter table asignaciones enable row level security;

-- ---------- Parte 3: organización del lead ----------
create table etapas_pipeline (
  id      bigint generated always as identity primary key,
  sector  text not null check (sector in ('convencional','plan_ahorro','usados')), -- (verificar)
  orden   smallint not null,
  nombre  text not null,
  unique (sector, orden)
);

insert into etapas_pipeline (sector, orden, nombre) values
  ('convencional', 1, 'Nuevo'), ('convencional', 2, 'Contactado'), ('convencional', 3, 'Test drive agendado'),
  ('convencional', 4, 'Cotización'), ('convencional', 5, 'Negociación'), ('convencional', 6, 'Ganado'),
  ('plan_ahorro', 1, 'Nuevo'), ('plan_ahorro', 2, 'Contactado'), ('plan_ahorro', 3, 'Explicación del sistema'),
  ('plan_ahorro', 4, 'Suscripción firmada'), ('plan_ahorro', 5, 'En espera de adjudicación'), ('plan_ahorro', 6, 'Adjudicado');

alter table leads add column etapa_id bigint references etapas_pipeline(id);

create table etiquetas (
  id      bigint generated always as identity primary key,
  nombre  text not null unique,
  color   text
);

create table lead_etiquetas (
  lead_id      bigint not null references leads(id) on delete cascade,
  etiqueta_id  bigint not null references etiquetas(id) on delete cascade,
  creado_en    timestamptz not null default now(),
  primary key (lead_id, etiqueta_id)
);

create table notas (
  id          bigint generated always as identity primary key,
  lead_id     bigint not null references leads(id) on delete cascade,
  usuario_id  bigint not null references usuarios(id),
  texto       text not null,
  creado_en   timestamptz not null default now()
);

create table lead_historial (
  id           bigint generated always as identity primary key,
  lead_id      bigint not null references leads(id) on delete cascade,
  tipo         text not null check (tipo in ('etapa','asignacion','derivacion','estado','nota')), -- (verificar)
  descripcion  text not null,
  usuario_id   bigint references usuarios(id),
  creado_en    timestamptz not null default now()
);
create index idx_historial_lead on lead_historial(lead_id, creado_en);

create function registrar_cambio_etapa() returns trigger language plpgsql as $$
declare nombre_etapa text;
begin
  if new.etapa_id is distinct from old.etapa_id and new.etapa_id is not null then
    select nombre into nombre_etapa from etapas_pipeline where id = new.etapa_id;
    insert into lead_historial (lead_id, tipo, descripcion)
    values (new.id, 'etapa', 'Pasó a la etapa: ' || nombre_etapa);
  end if;
  return new;
end;
$$;
create trigger trg_registrar_cambio_etapa after update on leads
  for each row execute function registrar_cambio_etapa();

alter table etapas_pipeline enable row level security;
alter table etiquetas       enable row level security;
alter table lead_etiquetas  enable row level security;
alter table notas           enable row level security;
alter table lead_historial  enable row level security;

-- ---------- Parte 4: gestión comercial ----------
create table supervisor_sucursales (
  usuario_id   bigint not null references usuarios(id) on delete cascade,
  sucursal_id  bigint not null references sucursales(id) on delete cascade,
  primary key (usuario_id, sucursal_id)
);

create table alertas (
  id          bigint generated always as identity primary key,
  usuario_id  bigint not null references usuarios(id) on delete cascade,
  lead_id     bigint references leads(id) on delete set null,
  fecha_hora  timestamptz not null,
  mensaje     text not null,
  leida       boolean not null default false,
  creado_en   timestamptz not null default now()
);
create index idx_alertas_usuario_fecha on alertas(usuario_id, fecha_hora);

create table turnos (
  id                bigint generated always as identity primary key,
  tipo              text not null default 'test_drive' check (tipo in ('test_drive','visita','entrega')), -- (verificar)
  lead_id           bigint references leads(id) on delete set null,
  cliente_nombre    text not null,
  cliente_telefono  text,
  vehiculo          text,
  sucursal_id       bigint references sucursales(id),
  vendedor_id       bigint not null references usuarios(id),
  fecha_hora        timestamptz not null,
  estado            text not null default 'pendiente' check (estado in ('pendiente','aprobado','rechazado','realizado','cancelado')), -- (verificar)
  aprobado_por      bigint references usuarios(id),
  creado_en         timestamptz not null default now()
);
create index idx_turnos_fecha on turnos(fecha_hora);

create table ventas (
  id              bigint generated always as identity primary key,
  lead_id         bigint references leads(id) on delete set null,
  cliente_nombre  text not null,
  vehiculo        text not null,
  vendedor_id     bigint not null references usuarios(id),
  sucursal_id     bigint references sucursales(id),
  sector          text not null check (sector in ('convencional','plan_ahorro','usados')), -- (verificar)
  fecha           date not null default current_date,
  monto           numeric(14,2),
  datos_extra     jsonb,
  creado_en       timestamptz not null default now()
);
create index idx_ventas_vendedor_fecha on ventas(vendedor_id, fecha);

create table comunicados (
  id           bigint generated always as identity primary key,
  categoria    text,
  texto        text not null,
  cuando       text,
  sucursal_id  bigint references sucursales(id),
  activo       boolean not null default true,
  creado_en    timestamptz not null default now()
);

create table giras_plan_ahorro (
  id          bigint generated always as identity primary key,
  destino     text not null,
  fecha_hora  timestamptz not null,
  unidades    text,
  creado_en   timestamptz not null default now()
);

create table entregas (
  id              bigint generated always as identity primary key,
  lead_id         bigint references leads(id) on delete set null,
  cliente_nombre  text not null,
  vehiculo        text not null,
  fecha           date not null,
  entregada       boolean not null default false,
  creado_en       timestamptz not null default now()
);

alter table supervisor_sucursales enable row level security;
alter table alertas               enable row level security;
alter table turnos                enable row level security;
alter table ventas                enable row level security;
alter table comunicados           enable row level security;
alter table giras_plan_ahorro     enable row level security;
alter table entregas              enable row level security;

-- ---------- Parte 5: plantillas, asignación y cola ----------
create function actualizar_fecha() returns trigger language plpgsql as $$
begin new.actualizado_en = now(); return new; end;
$$;

create table plantillas (
  id              bigint generated always as identity primary key,
  nombre          text not null,
  idioma          text not null default 'es_AR',
  categoria       text not null default 'MARKETING' check (categoria in ('MARKETING','UTILITY','AUTHENTICATION')), -- (verificar)
  texto           text not null,
  variables       text[],
  estado          text not null default 'borrador' check (estado in ('borrador','pendiente','aprobada','rechazada','pausada')), -- (verificar)
  meta_id         text,
  motivo_rechazo  text,
  activa          boolean not null default true,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  unique (nombre, idioma)
);
create trigger trg_plantillas_actualizado before update on plantillas
  for each row execute function actualizar_fecha();
alter table plantillas enable row level security;

-- Sucursales, localidades y alias (5.7)
create extension if not exists unaccent with schema extensions;
alter table localidades add column alias text[] not null default '{}';
alter table leads drop constraint leads_estado_check;
alter table leads add constraint leads_estado_check
  check (estado in ('en_conversacion','en_cola','asignacion_manual','derivado',
                    'perdido','recuperar','no_contactar','cerrado'));

insert into sucursales (nombre) values
  ('Casa Central Comodoro Rivadavia'), ('Puerto Madryn'), ('Trelew'), ('Esquel');

insert into localidades (nombre, sucursal_id, alias)
select v.nombre, s.id, v.alias
from (values
  ('Comodoro Rivadavia', 'Casa Central Comodoro Rivadavia', array['comodoro']),
  ('Rada Tilly',         'Casa Central Comodoro Rivadavia', array[]::text[]),
  ('Río Mayo',           'Casa Central Comodoro Rivadavia', array[]::text[]),
  ('Caleta Olivia',      'Casa Central Comodoro Rivadavia', array['caleta']),
  ('Sarmiento',          'Casa Central Comodoro Rivadavia', array[]::text[]),
  ('Las Heras',          'Casa Central Comodoro Rivadavia', array[]::text[]),
  ('Los Antiguos',       'Casa Central Comodoro Rivadavia', array[]::text[]),
  ('Pico Truncado',      'Casa Central Comodoro Rivadavia', array['truncado']),
  ('Cañadón Seco',       'Casa Central Comodoro Rivadavia', array[]::text[]),
  ('Puerto Madryn',      'Puerto Madryn', array['madryn']),
  ('Puerto Pirámides',   'Puerto Madryn', array['piramides']),
  ('28 de Julio',        'Puerto Madryn', array['veintiocho de julio']),
  ('Cipolletti',         'Puerto Madryn', array['cipoletti']),
  ('General Roca',       'Puerto Madryn', array['gral roca','gral. roca']),
  ('Las Grutas',         'Puerto Madryn', array[]::text[]),
  ('Sierra Grande',      'Puerto Madryn', array[]::text[]),
  ('San Antonio Oeste',  'Puerto Madryn', array['san antonio']),
  ('Viedma',             'Puerto Madryn', array[]::text[]),
  ('Trelew',             'Trelew', array[]::text[]),
  ('Dolavon',            'Trelew', array[]::text[]),
  ('Gaiman',             'Trelew', array[]::text[]),
  ('Paso de Indios',     'Trelew', array[]::text[]),
  ('Rawson',             'Trelew', array[]::text[]),
  ('Las Plumas',         'Trelew', array[]::text[]),
  ('Esquel',             'Esquel', array[]::text[]),
  ('El Hoyo',            'Esquel', array[]::text[]),
  ('Gobernador Costa',   'Esquel', array['gdor costa','gdor. costa']),
  ('Tecka',              'Esquel', array[]::text[]),
  ('Trevelin',           'Esquel', array[]::text[]),
  ('El Bolsón',          'Esquel', array['bolson']),
  ('Bariloche',          'Esquel', array['san carlos de bariloche'])
) as v(nombre, sucursal, alias)
join sucursales s on s.nombre = v.sucursal;

create function buscar_sucursal(p_texto text) returns bigint language sql stable as $$
  select l.sucursal_id from localidades l
  where lower(extensions.unaccent(trim(p_texto))) = lower(extensions.unaccent(l.nombre))
     or lower(extensions.unaccent(trim(p_texto))) in (
          select lower(extensions.unaccent(a)) from unnest(l.alias) a)
  limit 1;
$$;
revoke execute on function buscar_sucursal(text) from public, anon, authenticated;

-- Horarios por fecha concreta (5.8; reemplazó a la versión por día de la semana)
create table horarios_vendedor (
  id          bigint generated always as identity primary key,
  usuario_id  bigint not null references usuarios(id) on delete cascade,
  fecha       date not null,
  hora_desde  time not null,
  hora_hasta  time not null,
  check (hora_desde < hora_hasta)
);
create index idx_horarios_fecha on horarios_vendedor(fecha, usuario_id);
alter table horarios_vendedor enable row level security;

-- Asignación automática (D5): sucursal → sector → en horario → menos asignaciones hoy.
-- (El criterio de desempate quedó cortado en el registro: verificar contra la función de la base.)
create or replace function asignar_vendedor(p_lead_id bigint) returns bigint
language plpgsql as $$
declare
  v_sucursal  bigint;
  v_sector    text;
  v_vendedor  bigint;
  v_ahora     timestamp := now() at time zone 'America/Argentina/Buenos_Aires';
begin
  select sucursal_id, sector into v_sucursal, v_sector from leads where id = p_lead_id;
  if not found then raise exception 'No existe el lead %', p_lead_id; end if;
  if v_sucursal is null or v_sector is null then
    raise exception 'El lead % no tiene sucursal o sector cargado', p_lead_id;
  end if;

  perform pg_advisory_xact_lock(hashtext(v_sucursal::text || '-' || v_sector));

  select u.id into v_vendedor
  from usuarios u
  where u.rol = 'vendedor' and u.activo
    and u.sucursal_id = v_sucursal
    and u.sector = v_sector
    and exists (
      select 1 from horarios_vendedor h
      where h.usuario_id = u.id
        and h.fecha = v_ahora::date
        and v_ahora::time >= h.hora_desde
        and v_ahora::time <  h.hora_hasta)
  order by
    (select count(*) from asignaciones a
      where a.vendedor_id = u.id
        and (a.asignado_en at time zone 'America/Argentina/Buenos_Aires')::date = v_ahora::date) asc,
    (select max(a.asignado_en) from asignaciones a where a.vendedor_id = u.id) asc nulls first,
    u.id asc
  limit 1;

  if v_vendedor is null then
    update leads set estado = 'en_cola' where id = p_lead_id;
    return null;
  end if;

  update leads set vendedor_id = v_vendedor, estado = 'derivado', derivado_en = now() where id = p_lead_id;
  insert into asignaciones (lead_id, vendedor_id, motivo) values (p_lead_id, v_vendedor, 'automatica');
  insert into lead_historial (lead_id, tipo, descripcion)
  select p_lead_id, 'asignacion', 'Asignado automáticamente a ' || nombre from usuarios where id = v_vendedor;
  return v_vendedor;
end;
$$;
revoke execute on function asignar_vendedor(bigint) from public, anon, authenticated;

create function procesar_cola() returns integer language plpgsql as $$
declare r record; asignados integer := 0;
begin
  for r in select id from leads where estado = 'en_cola' order by creado_en loop
    if asignar_vendedor(r.id) is not null then asignados := asignados + 1; end if;
  end loop;
  return asignados;
end;
$$;
revoke execute on function procesar_cola() from public, anon, authenticated;
