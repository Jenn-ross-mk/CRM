-- =============================================================
-- Parte 8 · Bloque 3 — Vista "bandeja" con las columnas nuevas
-- =============================================================
-- Qué hace: vuelve a crear la vista bandeja (misma consulta que en la Parte 7) para que incluya
-- las columnas agregadas en el bloque 1 (email, preferencias, usado_descripcion). Una vista guarda la lista de columnas del momento
-- en que se creó, por eso hay que recrearla.
--
-- Resultado esperado: "Success. No rows returned".
-- Verificación: Table Editor → bandeja → aparecen email, preferencias y usado_descripcion.

drop view public.bandeja;

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
