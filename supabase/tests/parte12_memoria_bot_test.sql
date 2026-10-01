-- Pruebas de la Parte 12 (memoria de la IA). Corren dentro de una transacción y al final se deshace todo.
begin;
create function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if not cond then raise exception 'FALLA  %', msg; end if; raise notice 'OK  %', msg; end $$;

select bot_registrar_entrante('whatsapp', 'sesion-prueba', 'Prueba', null, 'texto', 'hola', null, 'p12.1', true);
select bot_registrar_entrante('whatsapp', '5492800000123', 'Real', null, 'texto', 'hola', null, 'p12.2');
insert into n8n_chat_histories (session_id, message) values
  ('whatsapp:sesion-prueba', '{"type":"human","data":{"content":"hola"}}'),
  ('whatsapp:5492800000123', '{"type":"human","data":{"content":"hola"}}');

select pg_temp.ok(bot_borrar_pruebas() = 1, 'borra el lead de prueba');
select pg_temp.ok(not exists (select 1 from n8n_chat_histories where session_id = 'whatsapp:sesion-prueba'), 'y la memoria de la prueba');
select pg_temp.ok(exists (select 1 from n8n_chat_histories where session_id = 'whatsapp:5492800000123'), 'la memoria de un cliente real no se toca');

-- Desde el CRM o internet no se puede leer la memoria.
grant usage on schema public to authenticated, anon;
set local role authenticated;
do $$ begin
  perform 1 from public.n8n_chat_histories;
  raise exception 'FALLA  un usuario del CRM pudo leer la memoria';
exception when insufficient_privilege then raise notice 'OK  el CRM no puede leer la memoria';
end $$;
reset role;

rollback;
