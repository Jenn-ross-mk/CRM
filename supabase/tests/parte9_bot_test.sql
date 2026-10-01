-- Pruebas de la Parte 9 (bot). Corren dentro de una transacción y al final se deshace todo.
-- Uso: psql ... -f supabase/tests/parte9_bot_test.sql   → cada caso imprime "OK ..." o corta con el error.
begin;

create temp table r (k text primary key, v jsonb);
create function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is not true then raise exception 'FALLA: %', msg; end if; raise notice 'OK  %', msg; end $$;

-- Datos de ejemplo: vendedores en Trelew y Comodoro, horarios de hoy.
insert into usuarios (nombre, email, rol, sucursal_id, sector) values
  ('Vend Conv A', 'a@x', 'vendedor', (select id from sucursales where nombre = 'Trelew'), 'convencional'),
  ('Vend Conv B', 'b@x', 'vendedor', (select id from sucursales where nombre = 'Trelew'), 'convencional'),
  ('Vend PDA fuera', 'c@x', 'vendedor', (select id from sucursales where nombre = 'Trelew'), 'plan_ahorro'),
  ('Vend Usados', 'd@x', 'vendedor', (select id from sucursales where nombre = 'Casa Central Comodoro Rivadavia'), 'usados');
insert into horarios_vendedor (usuario_id, fecha, hora_desde, hora_hasta)
select id, (now() at time zone 'America/Argentina/Buenos_Aires')::date, '00:00', '23:59:59' from usuarios where email in ('a@x', 'b@x', 'd@x');

-- 1. Cliente nuevo por WhatsApp: crea contacto y lead en modo bot.
insert into r values ('w1', bot_registrar_entrante('whatsapp', '5492800000001', 'Juan', '+5492800000001', 'texto', 'Hola, quiero un Onix', null, 'wamid.1'));
select pg_temp.ok((v->>'nuevo')::boolean and v->>'modo' = 'bot' and v->>'estado' = 'en_conversacion', 'cliente nuevo crea lead en modo bot') from r where k = 'w1';

-- 2. El mismo aviso de Meta dos veces: no se guarda dos veces.
insert into r values ('w1b', bot_registrar_entrante('whatsapp', '5492800000001', 'Juan', null, 'texto', 'Hola, quiero un Onix', null, 'wamid.1'));
select pg_temp.ok((v->>'duplicado')::boolean, 'mensaje repetido se descarta') from r where k = 'w1b';
select pg_temp.ok((select count(*) from mensajes where canal_mensaje_id = 'wamid.1') = 1, 'el mensaje repetido no se guardó dos veces');

-- 3. Segundo mensaje del mismo cliente: mismo lead.
insert into r values ('w2', bot_registrar_entrante('whatsapp', '5492800000001', 'Juan', null, 'texto', 'Soy de Trelew', null, 'wamid.2'));
select pg_temp.ok((select v->>'lead_id' from r where k = 'w2') = (select v->>'lead_id' from r where k = 'w1') and not (select (v->>'nuevo')::boolean from r where k = 'w2'), 'segundo mensaje va al mismo lead');

-- 4. Dos clientes de Instagram (sin teléfono): cada uno con su lead.
insert into r values ('ig1', bot_registrar_entrante('instagram', '1789000001', 'Ana', null, 'texto', 'Hola', null, 'ig.1'));
insert into r values ('ig2', bot_registrar_entrante('instagram', '1789000002', 'Luis', null, 'texto', 'Hola', null, 'ig.2'));
select pg_temp.ok((select v->>'lead_id' from r where k = 'ig1') <> (select v->>'lead_id' from r where k = 'ig2'), 'Instagram: dos clientes no se mezclan');

-- 5. Ficha: valores inválidos o vacíos no se guardan; la marca entera; strike suma; localidad → sucursal.
select bot_actualizar_ficha((select (v->>'lead_id')::bigint from r where k = 'w1'),
  '{"clasificacion":"tibio","uso":"familiar","marca":"Chevrolet","entrega_vehiculo":true,"localidad":"madryn","strike":"1"}');
insert into r values ('f1', bot_actualizar_ficha((select (v->>'lead_id')::bigint from r where k = 'w1'),
  '{"clasificacion":"muy caliente","uso":"","marca":"","strike":"1","forma_pago":"plan de ahorro"}'));
select pg_temp.ok(v->>'clasificacion' = 'tibio' and v->>'uso' = 'familiar' and v->>'marca' = 'Chevrolet', 'valores inválidos o vacíos no pisan los buenos') from r where k = 'f1';
select pg_temp.ok((v->>'entrega_vehiculo')::boolean, '"entrega vehículo" no vuelve a false si la IA no lo menciona') from r where k = 'f1';
select pg_temp.ok((v->>'strike_precio')::int = 2, 'cada pregunta por precio suma 1') from r where k = 'f1';
select pg_temp.ok((v->>'sucursal_id')::bigint = (select id from sucursales where nombre = 'Puerto Madryn'), 'la localidad "madryn" da la sucursal Puerto Madryn') from r where k = 'f1';

-- 6. Reparto parejo en Trelew, convencional: A, B, A...
insert into r values ('t1', bot_registrar_entrante('whatsapp', '5492800000011', 'C1', null, 'texto', 'Hola', null, 'wamid.11'));
insert into r values ('t2', bot_registrar_entrante('whatsapp', '5492800000012', 'C2', null, 'texto', 'Hola', null, 'wamid.12'));
insert into r values ('t3', bot_registrar_entrante('whatsapp', '5492800000013', 'C3', null, 'texto', 'Hola', null, 'wamid.13'));
insert into r values ('d1', bot_derivar((select (v->>'lead_id')::bigint from r where k = 't1'), 'convencional', 'seguimiento', 'Quiere un Onix', 'Carla', 'Trelew'));
insert into r values ('d2', bot_derivar((select (v->>'lead_id')::bigint from r where k = 't2'), 'convencional', 'seguimiento', 'Quiere una Tracker', 'Pedro', 'trelew'));
insert into r values ('d3', bot_derivar((select (v->>'lead_id')::bigint from r where k = 't3'), 'convencional', 'seguimiento', 'Quiere una S10', 'Sofía', 'Trelew'));
select pg_temp.ok(v->>'resultado' = 'asignado', 'derivación con vendedor en horario: asignado') from r where k = 'd1';
select pg_temp.ok((select v->>'vendedor' from r where k = 'd1') <> (select v->>'vendedor' from r where k = 'd2'), 'el segundo lead va al otro vendedor');
select pg_temp.ok((select v->>'vendedor' from r where k = 'd3') = (select v->>'vendedor' from r where k = 'd1'), 'el tercero vuelve al primero (reparto parejo)');
select pg_temp.ok((select modo from leads where id = (select (v->>'lead_id')::bigint from r where k = 't1')) = 'humano', 'después de derivar, el bot deja de responder');

-- 7. Plan de ahorro en Trelew sin nadie en horario: queda en cola.
insert into r values ('p1', bot_registrar_entrante('whatsapp', '5492800000021', 'C4', null, 'texto', 'Plan', null, 'wamid.21'));
insert into r values ('dp', bot_derivar((select (v->>'lead_id')::bigint from r where k = 'p1'), 'plan_ahorro', 'seguimiento', 'Plan de ahorro', 'Rosa', 'Trelew'));
select pg_temp.ok(v->>'resultado' = 'en_cola', 'fuera de horario: queda en cola') from r where k = 'dp';
select pg_temp.ok((select estado from leads where id = (select (v->>'lead_id')::bigint from r where k = 'p1')) = 'en_cola', 'el lead figura "en cola"');

-- 8. Localidad sin sucursal: queda sin asignar para los administradores.
insert into r values ('z1', bot_registrar_entrante('whatsapp', '5492800000031', 'C5', null, 'texto', 'Hola', null, 'wamid.31'));
insert into r values ('dz', bot_derivar((select (v->>'lead_id')::bigint from r where k = 'z1'), 'convencional', 'seguimiento', 'De Chaco', 'Mario', 'Resistencia'));
select pg_temp.ok(v->>'resultado' = 'sin_asignar' and v->>'causa' = 'sin_sucursal', 'otra provincia: sin asignar') from r where k = 'dz';
select pg_temp.ok((select estado from leads where id = (select (v->>'lead_id')::bigint from r where k = 'z1')) = 'asignacion_manual', 'el lead figura en asignación manual');

-- 8b. Cliente enojado: sin asignar y con etiqueta "urgente"; una derivación normal no la lleva.
insert into r values ('q1', bot_registrar_entrante('whatsapp', '5492800000035', 'C9', null, 'texto', 'Quiero hablar con un responsable', null, 'wamid.35'));
insert into r values ('dq', bot_derivar((select (v->>'lead_id')::bigint from r where k = 'q1'), 'convencional', 'problema', 'Reclamo por demora', 'Ana', 'Trelew'));
select pg_temp.ok(v->>'resultado' = 'sin_asignar' and v->>'causa' = 'problema', 'cliente enojado: sin asignar') from r where k = 'dq';
select pg_temp.ok(exists (select 1 from lead_etiquetas le join etiquetas e on e.id = le.etiqueta_id
  where le.lead_id = (select (v->>'lead_id')::bigint from r where k = 'q1') and e.nombre = 'urgente'), 'cliente enojado: etiqueta "urgente"');
select pg_temp.ok(not exists (select 1 from lead_etiquetas le join etiquetas e on e.id = le.etiqueta_id
  where le.lead_id = (select (v->>'lead_id')::bigint from r where k = 'z1') and e.nombre = 'urgente'), 'otra provincia: sin etiqueta "urgente"');

-- 9. No contactar.
insert into r values ('n1', bot_registrar_entrante('whatsapp', '5492800000041', 'C6', null, 'texto', 'No me escriban', null, 'wamid.41'));
insert into r values ('dn', bot_derivar((select (v->>'lead_id')::bigint from r where k = 'n1'), null, 'no_contactar', 'Pidió no ser contactado', null, null));
select pg_temp.ok(v->>'resultado' = 'no_contactar' and (select estado from leads where id = (select (v->>'lead_id')::bigint from r where k = 'n1')) = 'no_contactar', 'no contactar') from r where k = 'dn';

-- 10. Usados: solo vendedores de usados.
insert into r values ('u1', bot_registrar_entrante('whatsapp', '5492800000051', 'C7', null, 'texto', 'Busco usado', null, 'wamid.51'));
insert into r values ('du', bot_derivar((select (v->>'lead_id')::bigint from r where k = 'u1'), null, 'usados', 'Busca un Cronos usado', 'Hugo', 'Comodoro Rivadavia'));
select pg_temp.ok(v->>'resultado' = 'asignado' and v->>'vendedor' = 'Vend Usados', 'usados va a un vendedor de usados') from r where k = 'du';

-- 11. Modo prueba: dice a quién iría, pero no asigna a nadie.
insert into r values ('pr', bot_registrar_entrante('web', 'chat-prueba-1', 'Prueba', null, 'texto', 'Hola', null, null, true));
insert into r values ('dpr', bot_derivar((select (v->>'lead_id')::bigint from r where k = 'pr'), 'convencional', 'seguimiento', 'Prueba', 'Tester', 'Trelew'));
select pg_temp.ok(v->>'resultado' = 'prueba' and v->>'vendedor' is not null, 'prueba: informa a quién se asignaría') from r where k = 'dpr';
select pg_temp.ok(not exists (select 1 from asignaciones where lead_id = (select (v->>'lead_id')::bigint from r where k = 'pr')), 'prueba: no asigna a nadie');

-- 12. Etiqueta "humano".
insert into lead_etiquetas (lead_id, etiqueta_id) select (v->>'lead_id')::bigint, (select id from etiquetas where nombre = 'humano') from r where k = 'ig1';
select pg_temp.ok((select modo from leads where id = (select (v->>'lead_id')::bigint from r where k = 'ig1')) = 'humano', 'poner "humano" calla al bot');
delete from lead_etiquetas where lead_id = (select (v->>'lead_id')::bigint from r where k = 'ig1');
select pg_temp.ok((select modo from leads where id = (select (v->>'lead_id')::bigint from r where k = 'ig1')) = 'bot', 'sacar "humano" sin vendedor: vuelve el bot');
insert into lead_etiquetas (lead_id, etiqueta_id) select (v->>'lead_id')::bigint, (select id from etiquetas where nombre = 'humano') from r where k = 't1';
delete from lead_etiquetas where lead_id = (select (v->>'lead_id')::bigint from r where k = 't1');
select pg_temp.ok((select modo from leads where id = (select (v->>'lead_id')::bigint from r where k = 't1')) = 'humano', 'sacar "humano" con vendedor: sigue el vendedor');

-- 13. Chat cerrado: el cliente vuelve a escribir y se reabre el mismo lead.
update leads set estado = 'cerrado' where id = (select (v->>'lead_id')::bigint from r where k = 't1');
insert into r values ('re', bot_registrar_entrante('whatsapp', '5492800000011', 'C1', null, 'texto', 'Volví', null, 'wamid.14'));
select pg_temp.ok(v->>'lead_id' = (select v->>'lead_id' from r where k = 't1') and v->>'estado' = 'derivado', 'chat cerrado: mismo lead, reabierto con su vendedor') from r where k = 're';

-- 14. Seguimientos (esta prueba depende de que la hora de Argentina esté entre 7 y 22).
do $$
declare l bigint;
begin
  if (now() at time zone 'America/Argentina/Buenos_Aires')::time not between time '07:00' and time '22:00' then
    raise notice 'SALTEADO  seguimientos (fuera de la franja 7-22)'; return;
  end if;
  l := (select (v->>'lead_id')::bigint from r where k = 'ig2');
  update leads set ultima_interaccion = now() - interval '40 minutes' where id = l;
  perform bot_registrar_saliente(l, 'texto', 'Hola Luis, ¿qué vehículo buscás?', null, null);
  perform pg_temp.ok((select seguimiento from bot_leads_para_seguimiento() where lead_id = l) = 1, 'a los 30 min sin respuesta: seguimiento 1');
  perform bot_registrar_seguimiento(l, 1);
  perform pg_temp.ok(not exists (select 1 from bot_leads_para_seguimiento() where lead_id = l), 'después del 1, espera a las 2 horas');
  update leads set ultima_interaccion = now() - interval '2 hours 5 minutes' where id = l;
  perform pg_temp.ok((select seguimiento from bot_leads_para_seguimiento() where lead_id = l) = 2, 'a las 2 horas: seguimiento 2');
  perform bot_registrar_seguimiento(l, 2);
  perform pg_temp.ok(not exists (select 1 from bot_leads_para_seguimiento() where lead_id = l), 'no hay tercer seguimiento');
  l := (select (v->>'lead_id')::bigint from r where k = 'w2');
  update leads set ultima_interaccion = now() - interval '40 minutes' where id = l;
  perform pg_temp.ok(not exists (select 1 from bot_leads_para_seguimiento() where lead_id = l), 'si el último mensaje es del cliente, no hay seguimiento');
end $$;

-- 15. Borrar las pruebas.
select pg_temp.ok(bot_borrar_pruebas() = 1, 'bot_borrar_pruebas borra el lead de prueba');
select pg_temp.ok(not exists (select 1 from contactos where es_prueba), 'y su contacto');

rollback;
