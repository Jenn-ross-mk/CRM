-- Pruebas de la Parte 10 (archivos). Necesita un esquema "storage" como el de Supabase.
-- Corre dentro de una transacción y al final se deshace todo.
begin;
create function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if not cond then raise exception 'FALLA  %', msg; end if; raise notice 'OK  %', msg; end $$;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'va@x'), ('00000000-0000-0000-0000-00000000000b', 'vb@x');
insert into usuarios (nombre, email, rol, auth_id) values
  ('Vend A', 'va@x', 'vendedor', '00000000-0000-0000-0000-00000000000a'),
  ('Vend B', 'vb@x', 'vendedor', '00000000-0000-0000-0000-00000000000b');
select bot_registrar_entrante('whatsapp', '549280000a', 'Cliente A', null, 'imagen', 'foto A', '1/a.png', 'arch.a');
select bot_registrar_entrante('whatsapp', '549280000b', 'Cliente B', null, 'imagen', 'foto B', '2/b.png', 'arch.b');
update leads set vendedor_id = (select id from usuarios where email = 'va@x')
  where contacto_id = (select id from contactos where canal_id = '549280000a');
update leads set vendedor_id = (select id from usuarios where email = 'vb@x')
  where contacto_id = (select id from contactos where canal_id = '549280000b');
insert into storage.objects (bucket_id, name) values ('mensajes', '1/a.png'), ('mensajes', '2/b.png'), ('mensajes', '9/suelto.png');

-- Supabase da por defecto estos permisos a los usuarios con sesión; la copia local no los tiene.
grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;

select pg_temp.ok((select public = false from storage.buckets where id = 'mensajes'), 'la carpeta "mensajes" es privada');

set local role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-00000000000a', true);
select pg_temp.ok((select array_agg(name order by name) from storage.objects) = array['1/a.png'], 'el vendedor A solo ve el archivo de su lead');
select set_config('test.uid', '', true);
select pg_temp.ok(not exists (select 1 from storage.objects), 'sin usuario no se ve ningún archivo');
reset role;

rollback;
