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
