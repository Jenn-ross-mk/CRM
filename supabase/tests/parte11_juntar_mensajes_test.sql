-- Pruebas de la Parte 11 (juntar mensajes). Corren dentro de una transacción y al final se deshace todo.
begin;
create function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if not cond then raise exception 'FALLA  %', msg; end if; raise notice 'OK  %', msg; end $$;
create temp table r (k text primary key, v jsonb);

-- El cliente manda tres mensajes seguidos: texto, foto con texto y audio.
insert into r values ('m1', bot_registrar_entrante('whatsapp', '5492800000099', 'Ana', null, 'texto', 'hola', null, 'p11.1'));
insert into r values ('m2', bot_registrar_entrante('whatsapp', '5492800000099', 'Ana', null, 'imagen', 'mirá', '99/foto.png', 'p11.2'));
insert into r values ('m3', bot_registrar_entrante('whatsapp', '5492800000099', 'Ana', null, 'audio', null, '99/audio.ogg', 'p11.3'));
select bot_guardar_transcripcion((select (v->>'mensaje_id')::bigint from r where k = 'm2'), 'Un Chevrolet Onix rojo');
select bot_guardar_transcripcion((select (v->>'mensaje_id')::bigint from r where k = 'm3'), '  quiero saber el precio  ');

select pg_temp.ok((select texto from mensaje_transcripciones where mensaje_id = (select (v->>'mensaje_id')::bigint from r where k = 'm3')) = 'quiero saber el precio',
  'la transcripción se guarda sin espacios de más');

-- Los dos primeros se callan: hay un mensaje más nuevo.
select pg_temp.ok(not (bot_mensajes_pendientes((select (v->>'lead_id')::bigint from r where k = 'm1'),
  (select (v->>'mensaje_id')::bigint from r where k = 'm1'))->>'es_ultimo')::boolean, 'el primer mensaje se calla si llegó otro');
select pg_temp.ok(not (bot_mensajes_pendientes((select (v->>'lead_id')::bigint from r where k = 'm2'),
  (select (v->>'mensaje_id')::bigint from r where k = 'm2'))->>'es_ultimo')::boolean, 'el segundo también');

-- El último junta los tres.
insert into r values ('p3', bot_mensajes_pendientes((select (v->>'lead_id')::bigint from r where k = 'm3'),
  (select (v->>'mensaje_id')::bigint from r where k = 'm3')));
select pg_temp.ok((v->>'es_ultimo')::boolean and v->>'modo' = 'bot', 'el último contesta') from r where k = 'p3';
select pg_temp.ok(v->>'texto' = E'hola\n[El cliente envió una imagen: Un Chevrolet Onix rojo] mirá\n[Audio del cliente: quiero saber el precio]',
  'junta los tres mensajes, con la foto y el audio explicados') from r where k = 'p3';

-- Después de que el bot contesta, solo cuentan los mensajes nuevos.
select bot_registrar_saliente((select (v->>'lead_id')::bigint from r where k = 'm1'), 'texto', 'Hola Ana, el Onix...', null, null);
insert into r values ('m4', bot_registrar_entrante('whatsapp', '5492800000099', 'Ana', null, 'texto', '¿y en cuotas?', null, 'p11.4'));
select pg_temp.ok(bot_mensajes_pendientes((select (v->>'lead_id')::bigint from r where k = 'm4'),
  (select (v->>'mensaje_id')::bigint from r where k = 'm4'))->>'texto' = '¿y en cuotas?', 'después de una respuesta, solo los mensajes nuevos');

-- Si en la espera le pusieron la etiqueta "humano", lo avisa.
insert into lead_etiquetas (lead_id, etiqueta_id)
values ((select (v->>'lead_id')::bigint from r where k = 'm4'), (select id from etiquetas where nombre = 'humano'));
select pg_temp.ok(bot_mensajes_pendientes((select (v->>'lead_id')::bigint from r where k = 'm4'),
  (select (v->>'mensaje_id')::bigint from r where k = 'm4'))->>'modo' = 'humano', 'si lo pasaron a humano durante la espera, lo avisa');

-- Nadie con sesión del CRM puede leer las transcripciones.
grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;
set local role authenticated;
select pg_temp.ok(not exists (select 1 from mensaje_transcripciones), 'el CRM no puede ver las transcripciones');
reset role;

rollback;
