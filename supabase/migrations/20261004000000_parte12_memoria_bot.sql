-- =============================================================
-- Parte 12 — Memoria de la IA del bot (historial de la conversación que usa n8n)
-- =============================================================
-- Qué hace:
--   Crea la tabla donde n8n guarda la memoria de la IA (nodo "Postgres Chat Memory"), con el mismo formato
--   que usa n8n, pero con la seguridad activada y sin reglas de acceso: nadie la puede leer ni modificar
--   desde el CRM ni desde internet. Solo n8n, que entra con el usuario de la base de datos.
--   (Si n8n la creara solo, quedaría abierta: cualquiera con la dirección del Supabase podría leer las conversaciones.)
--   La clave de cada conversación es canal:id del cliente (por ejemplo "whatsapp:5492804...").
--   Además, bot_borrar_pruebas pasa a borrar también la memoria de las conversaciones de prueba.
--
-- Resultado esperado: "Success. No rows returned".

create table public.n8n_chat_histories (
  id          serial primary key,
  session_id  varchar(255) not null,
  message     jsonb not null
);
create index n8n_chat_histories_session_idx on public.n8n_chat_histories (session_id);

alter table public.n8n_chat_histories enable row level security;
revoke all on public.n8n_chat_histories from anon, authenticated;

-- bot_borrar_pruebas ahora también borra la memoria de la IA de las conversaciones de prueba.
create or replace function public.bot_borrar_pruebas()
returns integer language plpgsql security definer set search_path = public as $$
declare v_cant integer;
begin
  delete from public.n8n_chat_histories
  where session_id in (select canal || ':' || canal_id from public.contactos where es_prueba);
  delete from public.leads where contacto_id in (select id from public.contactos where es_prueba);
  get diagnostics v_cant = row_count;
  delete from public.contactos where es_prueba;
  return v_cant;
end;
$$;
