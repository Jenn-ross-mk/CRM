-- Bandeja: cada lead con el texto de su último mensaje. security_invoker => respeta el RLS de quien consulta.
create view public.bandeja with (security_invoker = true) as
select l.*, m.texto as ultimo_texto, m.direccion as ultima_direccion
from public.leads l
left join lateral (
  select texto, direccion from public.mensajes
  where lead_id = l.id
  order by created_at desc, id desc
  limit 1
) m on true;
