-- =============================================================
-- Parte 9 — Lo que necesita el bot de n8n para trabajar con el CRM (reemplaza a Chatwoot)
-- =============================================================
-- Qué hace:
--   1. contactos.es_prueba: marca los contactos del chat de prueba de n8n (se borran con bot_borrar_pruebas).
--   2. Etiqueta "humano": al ponerla, el bot deja de responder. Al sacarla, vuelve a responder
--      solo si el lead no tiene vendedor asignado.
--   3. Funciones que llama n8n (solo con la clave service_role, nunca desde el navegador):
--      · bot_registrar_entrante  → guarda cada mensaje del cliente (crea contacto y lead si no existen).
--      · bot_registrar_saliente  → guarda cada mensaje que envía el bot.
--      · bot_actualizar_ficha    → completa la ficha del lead con lo que extrae la IA (valida cada valor).
--      · bot_derivar             → deriva al lead: sucursal → sector → horario → menos leads del día.
--      · bot_leads_para_seguimiento / bot_registrar_seguimiento → los 2 seguimientos (30 min y 2 h).
--      · bot_borrar_pruebas      → borra todo lo del chat de prueba.
--
-- Resultado esperado: "Success. No rows returned".
-- Verificación: Database → Functions → aparecen las funciones bot_*; Table Editor → etiquetas → "humano".

-- ---------- 1. Contactos de prueba ----------
alter table public.contactos add column es_prueba boolean not null default false;

-- ---------- 2. Etiqueta "humano" ----------
insert into public.etiquetas (nombre, color) values ('humano', '#2f9aa3')
on conflict (nombre) do nothing;

create or replace function public.al_cambiar_etiqueta_humano()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_lead bigint := coalesce(new.lead_id, old.lead_id);
  v_etiqueta bigint := coalesce(new.etiqueta_id, old.etiqueta_id);
begin
  if not exists (select 1 from public.etiquetas where id = v_etiqueta and lower(nombre) = 'humano') then
    return null;
  end if;
  if tg_op = 'INSERT' then
    update public.leads set modo = 'humano' where id = v_lead;
    insert into public.lead_historial (lead_id, tipo, descripcion, usuario_id)
    values (v_lead, 'sistema', 'Etiqueta "humano": el bot deja de responder', public.mi_usuario_id());
  else
    -- Solo vuelve al bot si nadie lo tiene asignado.
    update public.leads set modo = 'bot' where id = v_lead and vendedor_id is null;
    if found then
      insert into public.lead_historial (lead_id, tipo, descripcion, usuario_id)
      values (v_lead, 'sistema', 'Se quitó la etiqueta "humano": el bot vuelve a responder', public.mi_usuario_id());
    end if;
  end if;
  return null;
end;
$$;

create trigger trg_etiqueta_humano
  after insert or delete on public.lead_etiquetas
  for each row execute function public.al_cambiar_etiqueta_humano();

-- ---------- 3. Funciones para n8n ----------

-- Datos del lead que usa el bot (los devuelven varias funciones).
create or replace function public.bot_datos_lead(p_lead_id bigint)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'lead_id', l.id, 'contacto_id', c.id, 'canal', c.canal, 'canal_id', c.canal_id, 'es_prueba', c.es_prueba,
    'nombre_perfil', c.nombre_perfil, 'telefono', c.telefono,
    'modo', l.modo, 'estado', l.estado, 'vendedor_id', l.vendedor_id, 'sucursal_id', l.sucursal_id,
    'nombre_cliente', l.nombre_cliente, 'localidad', l.localidad, 'sector', l.sector, 'tipo', l.tipo,
    'clasificacion', l.clasificacion, 'vehiculo_interes', l.vehiculo_interes, 'marca', l.marca,
    'modelo_anio', l.modelo_anio, 'uso', l.uso, 'forma_pago', l.forma_pago,
    'entrega_vehiculo', l.entrega_vehiculo, 'entrega_capital', l.entrega_capital, 'monto_capital', l.monto_capital,
    'urgencia', l.urgencia, 'contexto_conversacion', l.contexto_conversacion,
    'strike_precio', l.strike_precio, 'seguimiento_n', l.seguimiento_n)
  from public.leads l join public.contactos c on c.id = l.contacto_id
  where l.id = p_lead_id
$$;

-- Guarda un mensaje del cliente. Reusa el lead del contacto aunque esté cerrado (la base lo reabre sola).
-- Si el mensaje ya se había guardado (Meta a veces avisa dos veces), devuelve duplicado = true y no hace nada.
create or replace function public.bot_registrar_entrante(
  p_canal text, p_canal_id text, p_nombre text, p_telefono text,
  p_tipo text, p_contenido text, p_media_url text, p_canal_mensaje_id text,
  p_es_prueba boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_contacto bigint;
  v_lead bigint;
  v_nuevo boolean := false;
  v_mensaje bigint;
  v_tipo text := case when p_tipo in ('texto', 'imagen', 'audio', 'documento') then p_tipo else 'texto' end;
begin
  if p_canal_mensaje_id is not null then
    select lead_id into v_lead from public.mensajes where canal_mensaje_id = p_canal_mensaje_id;
    if found then
      return jsonb_build_object('duplicado', true, 'lead_id', v_lead);
    end if;
  end if;

  insert into public.contactos (canal, canal_id, nombre_perfil, telefono, es_prueba)
  values (p_canal, p_canal_id, nullif(trim(p_nombre), ''), nullif(trim(p_telefono), ''), p_es_prueba)
  on conflict (canal, canal_id) do update
    set nombre_perfil = coalesce(excluded.nombre_perfil, contactos.nombre_perfil),
        telefono      = coalesce(contactos.telefono, excluded.telefono)
  returning id into v_contacto;

  select id into v_lead from public.leads where contacto_id = v_contacto order by creado_en desc, id desc limit 1;
  if v_lead is null then
    insert into public.leads (contacto_id, modo, estado, leido)
    values (v_contacto, 'bot', 'en_conversacion', false)
    returning id into v_lead;
    v_nuevo := true;
    insert into public.lead_historial (lead_id, tipo, descripcion)
    values (v_lead, 'sistema', 'Lead creado por el bot (' || p_canal || ')');
  end if;

  begin
    insert into public.mensajes (lead_id, direccion, autor_tipo, tipo, contenido, media_url, canal_mensaje_id)
    values (v_lead, 'entrante', 'cliente', v_tipo, p_contenido, p_media_url, p_canal_mensaje_id)
    returning id into v_mensaje;
  exception when unique_violation then
    return jsonb_build_object('duplicado', true, 'lead_id', v_lead);
  end;

  return public.bot_datos_lead(v_lead)
    || jsonb_build_object('duplicado', false, 'nuevo', v_nuevo, 'mensaje_id', v_mensaje);
end;
$$;

-- Guarda un mensaje que envió el bot (texto, imagen o documento).
create or replace function public.bot_registrar_saliente(
  p_lead_id bigint, p_tipo text, p_contenido text, p_media_url text,
  p_canal_mensaje_id text, p_estado_envio text default 'enviado')
returns bigint language sql security definer set search_path = public as $$
  insert into public.mensajes (lead_id, direccion, autor_tipo, tipo, contenido, media_url, canal_mensaje_id, estado_envio)
  values (p_lead_id, 'saliente', 'bot',
          case when p_tipo in ('texto', 'imagen', 'audio', 'documento', 'plantilla') then p_tipo else 'texto' end,
          p_contenido, p_media_url, nullif(p_canal_mensaje_id, ''),
          case when p_estado_envio in ('pendiente', 'enviado', 'entregado', 'leido', 'fallido') then p_estado_envio else 'enviado' end)
  returning id
$$;

-- Completa la ficha con lo que extrae la IA. Un valor vacío o que no está en la lista permitida no se guarda
-- (así nunca falla ni pisa un dato bueno con uno vacío). strike = 1 suma una pregunta por el precio.
create or replace function public.bot_actualizar_ficha(p_lead_id bigint, p_datos jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d jsonb := coalesce(p_datos, '{}'::jsonb);
  v_localidad text := nullif(trim(d->>'localidad'), '');
  v_sucursal bigint;
  v_bool_vehiculo boolean;
  v_bool_capital boolean;
begin
  if jsonb_typeof(d->'entrega_vehiculo') = 'boolean' then v_bool_vehiculo := (d->>'entrega_vehiculo')::boolean; end if;
  if jsonb_typeof(d->'entrega_capital') = 'boolean' then v_bool_capital := (d->>'entrega_capital')::boolean; end if;
  if v_localidad is not null then v_sucursal := public.buscar_sucursal(v_localidad); end if;

  update public.leads l set
    nombre_cliente        = coalesce(nullif(trim(d->>'nombre_cliente'), ''), l.nombre_cliente),
    localidad             = coalesce(v_localidad, l.localidad),
    sucursal_id           = coalesce(l.sucursal_id, v_sucursal),
    clasificacion         = coalesce(case when d->>'clasificacion' in ('frio', 'tibio', 'caliente') then d->>'clasificacion' end, l.clasificacion),
    tipo                  = coalesce(case when d->>'tipo' in ('0km', 'usado', 'promocion') then d->>'tipo' end, l.tipo),
    sector                = coalesce(case when d->>'sector' in ('convencional', 'plan_ahorro', 'usados', 'postventa', 'repuestos') then d->>'sector' end, l.sector),
    vehiculo_interes      = coalesce(nullif(trim(d->>'vehiculo_interes'), ''), l.vehiculo_interes),
    marca                 = coalesce(nullif(trim(d->>'marca'), ''), l.marca),
    modelo_anio           = coalesce(nullif(trim(d->>'modelo_anio'), ''), l.modelo_anio),
    uso                   = coalesce(case when d->>'uso' in ('comercial', 'familiar', 'laboral') then d->>'uso' end, l.uso),
    forma_pago            = coalesce(case when d->>'forma_pago' in ('financiacion', 'plan_ahorro', 'contado') then d->>'forma_pago' end, l.forma_pago),
    entrega_vehiculo      = coalesce(v_bool_vehiculo, l.entrega_vehiculo),
    entrega_capital       = coalesce(v_bool_capital, l.entrega_capital),
    monto_capital         = coalesce(nullif(trim(d->>'monto_capital'), ''), l.monto_capital),
    urgencia              = coalesce(nullif(trim(d->>'urgencia'), ''), l.urgencia),
    contexto_conversacion = coalesce(nullif(trim(d->>'contexto_conversacion'), ''), l.contexto_conversacion),
    strike_precio         = l.strike_precio + case when d->>'strike' = '1' then 1 else 0 end
  where l.id = p_lead_id;

  return public.bot_datos_lead(p_lead_id);
end;
$$;

-- El vendedor que elegiría asignar_vendedor, sin asignar nada (lo usa el modo prueba).
create or replace function public.bot_elegir_vendedor(p_sucursal bigint, p_sector text)
returns bigint language sql stable security definer set search_path = public as $$
  with ahora as (select now() at time zone 'America/Argentina/Buenos_Aires' as t)
  select u.id
  from public.usuarios u, ahora
  where u.rol = 'vendedor' and u.activo and u.sucursal_id = p_sucursal and u.sector = p_sector
    and exists (select 1 from public.horarios_vendedor h
                where h.usuario_id = u.id and h.fecha = ahora.t::date
                  and ahora.t::time >= h.hora_desde and ahora.t::time < h.hora_hasta)
  order by
    (select count(*) from public.asignaciones a
      where a.vendedor_id = u.id and (a.asignado_en at time zone 'America/Argentina/Buenos_Aires')::date = ahora.t::date) asc,
    (select max(a.asignado_en) from public.asignaciones a where a.vendedor_id = u.id) asc nulls first,
    u.id asc
  limit 1
$$;

-- Deriva al lead. Motivos: seguimiento (venta), usados, repuestos, postventa, problema, no_contactar.
-- Devuelve resultado: asignado | en_cola | sin_asignar | no_contactar | prueba.
create or replace function public.bot_derivar(
  p_lead_id bigint, p_sector text, p_motivo text, p_resumen text, p_nombre text, p_localidad text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_motivo text := case when p_motivo in ('seguimiento', 'usados', 'repuestos', 'postventa', 'problema', 'no_contactar') then p_motivo else 'seguimiento' end;
  v_sector text := case when p_sector in ('convencional', 'plan_ahorro', 'usados', 'postventa', 'repuestos') then p_sector end;
  v_localidad text := nullif(trim(p_localidad), '');
  v_sucursal bigint;
  v_prueba boolean;
  v_vendedor bigint;
  v_nombre_vendedor text;
begin
  if v_motivo in ('usados', 'repuestos', 'postventa') then v_sector := v_motivo; end if;

  select c.es_prueba into v_prueba from public.leads l join public.contactos c on c.id = l.contacto_id where l.id = p_lead_id;
  if not found then raise exception 'No existe el lead %', p_lead_id; end if;

  update public.leads l set
    nombre_cliente = coalesce(nullif(trim(p_nombre), ''), l.nombre_cliente),
    localidad      = coalesce(v_localidad, l.localidad),
    sector         = coalesce(v_sector, l.sector),
    contexto_conversacion = coalesce(nullif(trim(p_resumen), ''), l.contexto_conversacion)
  where l.id = p_lead_id
  returning l.sucursal_id, l.sector, l.localidad into v_sucursal, v_sector, v_localidad;

  if v_sucursal is null and v_localidad is not null then
    v_sucursal := public.buscar_sucursal(v_localidad);
    update public.leads set sucursal_id = v_sucursal where id = p_lead_id and v_sucursal is not null;
  end if;

  insert into public.lead_historial (lead_id, tipo, descripcion)
  values (p_lead_id, 'derivacion', 'El bot derivó (motivo: ' || v_motivo || ')' || coalesce('. ' || nullif(trim(p_resumen), ''), ''));

  -- El bot deja de responder en todos los casos.
  if v_motivo = 'no_contactar' then
    update public.leads set estado = 'no_contactar', modo = 'humano' where id = p_lead_id;
    return jsonb_build_object('resultado', 'no_contactar');
  end if;

  if v_motivo = 'problema' or v_sucursal is null or v_sector is null then
    update public.leads set estado = 'asignacion_manual', modo = 'humano' where id = p_lead_id;
    return jsonb_build_object('resultado', 'sin_asignar',
      'causa', case when v_motivo = 'problema' then 'problema' when v_sucursal is null then 'sin_sucursal' else 'sin_sector' end);
  end if;

  if v_prueba then
    v_vendedor := public.bot_elegir_vendedor(v_sucursal, v_sector);
    select nombre into v_nombre_vendedor from public.usuarios where id = v_vendedor;
    update public.leads set estado = 'asignacion_manual', modo = 'humano' where id = p_lead_id;
    insert into public.lead_historial (lead_id, tipo, descripcion)
    values (p_lead_id, 'sistema', 'Prueba: se asignaría a ' || coalesce(v_nombre_vendedor, 'nadie (quedaría en cola)'));
    return jsonb_build_object('resultado', 'prueba', 'vendedor', v_nombre_vendedor);
  end if;

  update public.leads set modo = 'humano' where id = p_lead_id;
  v_vendedor := public.asignar_vendedor(p_lead_id);
  if v_vendedor is null then
    return jsonb_build_object('resultado', 'en_cola');
  end if;
  select nombre into v_nombre_vendedor from public.usuarios where id = v_vendedor;
  return jsonb_build_object('resultado', 'asignado', 'vendedor', v_nombre_vendedor);
end;
$$;

-- Leads a los que les toca un seguimiento ahora (solo de 7 a 22 h, hora de Argentina):
--   · los atiende el bot (modo bot, sin vendedor, nunca les escribió un vendedor, sin etiqueta "humano");
--   · el último mensaje de la conversación es del bot (el cliente no contestó);
--   · seguimiento 1: 30 minutos sin respuesta del cliente; seguimiento 2: 2 horas.
create or replace function public.bot_leads_para_seguimiento()
returns table (lead_id bigint, seguimiento integer, canal text, canal_id text, nombre text, es_prueba boolean)
language sql stable security definer set search_path = public as $$
  select l.id, l.seguimiento_n + 1, c.canal, c.canal_id, coalesce(l.nombre_cliente, c.nombre_perfil), c.es_prueba
  from public.leads l
  join public.contactos c on c.id = l.contacto_id
  where (now() at time zone 'America/Argentina/Buenos_Aires')::time between time '07:00' and time '22:00'
    and l.modo = 'bot' and l.vendedor_id is null and l.estado = 'en_conversacion'
    and l.seguimiento_n < 2
    and l.ultima_interaccion is not null
    and now() - l.ultima_interaccion >= case when l.seguimiento_n = 0 then interval '30 minutes' else interval '2 hours' end
    and not exists (select 1 from public.mensajes m where m.lead_id = l.id and m.autor_tipo = 'vendedor')
    and not exists (select 1 from public.lead_etiquetas le join public.etiquetas e on e.id = le.etiqueta_id
                    where le.lead_id = l.id and lower(e.nombre) = 'humano')
    and (select m.direccion from public.mensajes m where m.lead_id = l.id order by m.creado_en desc, m.id desc limit 1) = 'saliente'
  order by l.ultima_interaccion
  limit 50
$$;

create or replace function public.bot_registrar_seguimiento(p_lead_id bigint, p_seguimiento integer)
returns void language sql security definer set search_path = public as $$
  update public.leads set seguimiento_n = greatest(seguimiento_n, p_seguimiento) where id = p_lead_id;
  insert into public.lead_historial (lead_id, tipo, descripcion)
  values (p_lead_id, 'seguimiento', 'El bot envió el seguimiento ' || p_seguimiento);
$$;

-- Borra todo lo del chat de prueba (leads, mensajes, historial y contactos marcados es_prueba).
create or replace function public.bot_borrar_pruebas()
returns integer language plpgsql security definer set search_path = public as $$
declare v_cant integer;
begin
  delete from public.leads where contacto_id in (select id from public.contactos where es_prueba);
  get diagnostics v_cant = row_count;
  delete from public.contactos where es_prueba;
  return v_cant;
end;
$$;

-- Solo n8n (service_role) puede usar estas funciones.
revoke execute on function public.bot_datos_lead(bigint) from public, anon, authenticated;
revoke execute on function public.bot_registrar_entrante(text, text, text, text, text, text, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.bot_registrar_saliente(bigint, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.bot_actualizar_ficha(bigint, jsonb) from public, anon, authenticated;
revoke execute on function public.bot_elegir_vendedor(bigint, text) from public, anon, authenticated;
revoke execute on function public.bot_derivar(bigint, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.bot_leads_para_seguimiento() from public, anon, authenticated;
revoke execute on function public.bot_registrar_seguimiento(bigint, integer) from public, anon, authenticated;
revoke execute on function public.bot_borrar_pruebas() from public, anon, authenticated;
grant execute on function public.bot_datos_lead(bigint), public.bot_registrar_entrante(text, text, text, text, text, text, text, text, boolean),
  public.bot_registrar_saliente(bigint, text, text, text, text, text), public.bot_actualizar_ficha(bigint, jsonb),
  public.bot_elegir_vendedor(bigint, text), public.bot_derivar(bigint, text, text, text, text, text),
  public.bot_leads_para_seguimiento(), public.bot_registrar_seguimiento(bigint, integer), public.bot_borrar_pruebas()
  to service_role;
