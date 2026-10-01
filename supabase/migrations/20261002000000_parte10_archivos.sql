-- =============================================================
-- Parte 10 — Archivos de los mensajes (fotos, audios, PDF) en una carpeta privada
-- =============================================================
-- Qué hace:
--   1. Crea la carpeta (bucket) privada "mensajes" en Supabase Storage. Ahí el bot (n8n) sube cada archivo
--      que manda un cliente y guarda en mensajes.media_url dónde quedó (por ejemplo "4/1790873670069-foto.png").
--   2. Desde el CRM, cada usuario puede abrir solo los archivos de los mensajes que ya puede ver
--      (las mismas reglas que los mensajes: el vendedor, los suyos; supervisores y administradores, lo que les toca).
--   Subir archivos solo puede n8n (con la clave service_role). Nadie los puede ver con un link público.
--
-- Resultado esperado: "Success. No rows returned".
-- Verificación: Storage → aparece la carpeta "mensajes" con el candado de privada.

insert into storage.buckets (id, name, public)
values ('mensajes', 'mensajes', false)
on conflict (id) do nothing;

create policy "mensajes: abrir archivos de mensajes visibles"
on storage.objects for select to authenticated
using (
  bucket_id = 'mensajes'
  and exists (select 1 from public.mensajes m where m.media_url = objects.name)
);
