-- =============================================================
-- Parte 11 — El bot junta los mensajes seguidos del cliente usando el CRM (reemplaza a Redis)
-- =============================================================
-- Qué hace:
--   1. mensajes.transcripcion: lo que el bot entendió de un archivo del cliente
--      (la descripción de una foto, la transcripción de un audio, el texto de un PDF).
--      El CRM lo muestra debajo del archivo, así el vendedor puede leer un audio sin escucharlo.
--   2. bot_guardar_transcripcion: n8n guarda ahí esa descripción o transcripción.
--   3. bot_mensajes_pendientes: después de esperar 30 segundos, n8n pregunta si llegó algún mensaje
--      más nuevo del cliente. Si llegó, este se calla (va a contestar el más nuevo). Si no, devuelve
--      todos los mensajes del cliente que todavía no se contestaron, juntos, para contestar una sola vez.
--
-- Resultado esperado: "Success. No rows returned".

alter table public.mensajes add column transcripcion text;

create or replace function public.bot_guardar_transcripcion(p_mensaje_id bigint, p_texto text)
returns void language sql security definer set search_path = public as $$
  update public.mensajes set transcripcion = nullif(trim(p_texto), '') where id = p_mensaje_id;
$$;

-- es_ultimo = false: llegó otro mensaje del cliente después de este (lo contesta el otro).
-- es_ultimo = true: texto = los mensajes del cliente desde la última respuesta, uno por línea;
--   modo = 'bot' o 'humano' (si en la espera lo derivaron o le pusieron la etiqueta "humano", el bot no contesta).
create or replace function public.bot_mensajes_pendientes(p_lead_id bigint, p_mensaje_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_ultima_respuesta bigint;
  v_texto text;
begin
  if exists (select 1 from public.mensajes
             where lead_id = p_lead_id and direccion = 'entrante' and id > p_mensaje_id) then
    return jsonb_build_object('es_ultimo', false);
  end if;

  select max(id) into v_ultima_respuesta from public.mensajes
  where lead_id = p_lead_id and direccion = 'saliente';

  select string_agg(
           case m.tipo
             when 'texto' then coalesce(m.contenido, '')
             else '[' || case m.tipo when 'imagen' then 'El cliente envió una imagen'
                                     when 'audio' then 'Audio del cliente'
                                     else 'El cliente envió un documento' end
                  || coalesce(': ' || m.transcripcion, '') || ']'
                  || coalesce(' ' || nullif(trim(m.contenido), ''), '')
           end, E'\n' order by m.id)
  into v_texto
  from public.mensajes m
  where m.lead_id = p_lead_id and m.direccion = 'entrante' and m.id > coalesce(v_ultima_respuesta, 0);

  return jsonb_build_object(
    'es_ultimo', true,
    'texto', coalesce(v_texto, ''),
    'modo', (select modo from public.leads where id = p_lead_id));
end;
$$;

-- Solo n8n (service_role) puede usar estas funciones.
revoke execute on function public.bot_guardar_transcripcion(bigint, text) from public, anon, authenticated;
revoke execute on function public.bot_mensajes_pendientes(bigint, bigint) from public, anon, authenticated;
grant execute on function public.bot_guardar_transcripcion(bigint, text), public.bot_mensajes_pendientes(bigint, bigint) to service_role;
