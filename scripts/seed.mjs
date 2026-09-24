// Carga datos de prueba en Supabase (replica los datos del mockup).
// Uso: npm run seed   (lee NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY de .env.local)
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const sb = createClient(url, serviceKey, { auth: { persistSession: false } });
const PASSWORD = process.env.SEED_PASSWORD || 'Akar2026!';

// Generador pseudoaleatorio determinístico para que el seed sea reproducible.
let semilla = 42;
const rnd = () => ((semilla = (semilla * 16807) % 2147483647) - 1) / 2147483646;
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

const ahora = new Date();
const haceMin = (min) => new Date(ahora.getTime() - min * 60000).toISOString();
const haceDias = (d, h = 10, m = 0) => {
  const x = new Date(ahora);
  x.setDate(x.getDate() - d);
  x.setHours(h, m, 0, 0);
  return x.toISOString();
};
const iso = (d) => d.toISOString().slice(0, 10);
const diaDelMes = (dia, offsetMes = 0) => new Date(ahora.getFullYear(), ahora.getMonth() + offsetMes, dia, 12);
const enDias = (d) => { const x = new Date(ahora); x.setDate(x.getDate() + d); return x; };

async function must(p) {
  const { data, error } = await p;
  if (error) throw error;
  return data;
}

async function limpiar() {
  for (const t of ['alertas', 'notas', 'mensajes', 'test_drives', 'ventas', 'leads', 'comunicados', 'giras', 'entregas', 'modelos']) {
    await must(sb.from(t).delete().gte('id', 0));
  }
  const { data } = await sb.auth.admin.listUsers({ perPage: 1000 });
  for (const u of data?.users ?? []) await sb.auth.admin.deleteUser(u.id);
  await must(sb.from('sucursales').delete().gte('id', 0));
}

async function crearUsuario({ nombre, email, telefono, rol, sucursal_id, sector }) {
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { nombre, telefono, rol, sucursal_id: sucursal_id ? String(sucursal_id) : '', sector: sector ?? '' },
  });
  if (error) throw error;
  return data.user.id;
}

async function main() {
  console.log('Limpiando datos anteriores…');
  await limpiar();

  const sucursales = await must(sb.from('sucursales').insert([
    { nombre: 'Centro', direccion: 'Av. Roca 1234, Comodoro Rivadavia', telefono: '297 400-1000' },
    { nombre: 'Norte', direccion: 'Ruta Nacional 3 Km 1900, Comodoro Rivadavia', telefono: '297 400-2000' },
  ]).select());
  const suc = Object.fromEntries(sucursales.map((s) => [s.nombre, s.id]));

  await must(sb.from('modelos').insert(
    ['Chevrolet Tracker Premier', 'Chevrolet Onix Plus', 'Chevrolet Onix LTZ', 'Chevrolet S10 High Country', 'Chevrolet Spark GT', 'Chevrolet Onix']
      .map((nombre) => ({ nombre }))
  ));

  console.log('Creando usuarios…');
  const vendedoresBase = [
    ['M. González', 'Centro', 'Convencional', 11], ['J. Perotti', 'Norte', 'Convencional', 8],
    ['D. Farías', 'Norte', 'Convencional', 6], ['A. Cáceres', 'Centro', 'Convencional', 5],
    ['W. Villar', 'Centro', 'Convencional', 4], ['T. Barrientos', 'Norte', 'Convencional', 3],
    ['S. Herrera', 'Centro', 'Convencional', 2], ['F. Molina', 'Norte', 'Convencional', 1],
    ['C. Ibarra', 'Centro', 'Plan de ahorro', 14], ['R. Salto', 'Centro', 'Plan de ahorro', 10],
    ['N. Vega', 'Norte', 'Plan de ahorro', 7], ['L. Acevedo', 'Norte', 'Plan de ahorro', 6],
    ['P. Moyano', 'Centro', 'Plan de ahorro', 4], ['E. Ríos', 'Norte', 'Plan de ahorro', 3],
    ['G. Paz', 'Centro', 'Plan de ahorro', 2], ['M. Duarte', 'Norte', 'Plan de ahorro', 1],
  ];
  const emailDe = (nombre) =>
    nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '').replace('.', '.') + '@akarautomotores.com.ar';

  const vend = {};
  let tel = 1001;
  for (const [nombre, sucursal, sector] of vendedoresBase) {
    vend[nombre] = await crearUsuario({ nombre, email: emailDe(nombre), telefono: `297 400-${tel++}`, rol: 'vendedor', sucursal_id: suc[sucursal], sector });
  }
  const admin = await crearUsuario({ nombre: 'Jennifer Rossetti', email: 'jennifer.rossetti@akarautomotores.com.ar', telefono: '297 400-9000', rol: 'administrador' });
  await crearUsuario({ nombre: 'R. Medina', email: 'r.medina@akarautomotores.com.ar', telefono: '297 400-5001', rol: 'supervisor', sucursal_id: suc.Centro });
  await crearUsuario({ nombre: 'L. Funes', email: 'l.funes@akarautomotores.com.ar', telefono: '297 400-5002', rol: 'supervisor', sucursal_id: suc.Norte });

  console.log('Creando leads y conversaciones…');
  // Leads del mockup, con sus conversaciones.
  const leadsMockup = [
    { v: 'M. González', nombre: 'Romina Díaz', telefono: '+54 9 297 400-1122', canal: 'WhatsApp', s: 'Centro', sector: 'Convencional', leido: false, modelo: 'Tracker Premier', forma_pago: 'Financiado', presupuesto: '$ 38.000.000', etapa: 2, prioridad: 'alta', tags: ['Financiación aprobada', 'Seguimiento prioritario'],
      nota: 'Cliente ya tiene el usado tasado en otra agencia. Comparar contraoferta antes del viernes.',
      thread: [['in', 'Hola, vi el Tracker Premier en la página. ¿Sigue disponible en gris?', haceMin(40)], ['out', 'Hola Romina, sí, tenemos una unidad en showroom. ¿Querés coordinar un test drive esta semana?', haceMin(39)], ['in', '¿El Tracker viene con techo panorámico?', haceMin(37)]] },
    { v: 'J. Perotti', nombre: 'Fernando Acosta', telefono: '+54 9 297 411-2233', canal: 'Web', s: 'Norte', sector: 'Plan de ahorro', leido: false, modelo: 'Onix Plus', forma_pago: 'Plan de ahorro', presupuesto: 'Cuota N.º 2 de 84', etapa: 1, prioridad: 'media', tags: ['Grupo asignado'],
      nota: 'Consultó por adelanto de cuotas para mejorar posición en la licitación.',
      thread: [['in', 'Hola, quiero saber cómo sigue el plan de ahorro que empecé el mes pasado.', haceMin(70)], ['out', 'Hola Fernando, tu grupo entra al sorteo del día 15. Te aviso apenas salga el resultado.', haceMin(69)], ['in', 'Quiero saber cómo sigue el plan de ahorro', haceMin(68)]] },
    { v: 'M. González', nombre: 'Laura Sosa', telefono: '+54 9 297 422-3344', canal: 'WhatsApp', s: 'Centro', sector: 'Convencional', leido: true, modelo: 'Onix Plus', forma_pago: 'Contado', presupuesto: '$ 26.500.000', etapa: 4, prioridad: 'alta', tags: ['Listo para entrega'],
      nota: 'Retira el sábado a las 11. Confirmar patentamiento antes.',
      thread: [['out', 'Laura, quedamos en que pasás el sábado a las 11 para el retiro del Onix, ¿va bien?', haceDias(8, 17, 10)], ['in', 'Perfecto, paso el sábado a las 11', haceDias(8, 17, 25)]] },
    { v: 'D. Farías', nombre: 'Gustavo Núñez', telefono: '+54 9 297 433-4455', canal: 'Marketplace', s: 'Norte', sector: 'Convencional', leido: false, modelo: 'Onix', forma_pago: 'A definir', presupuesto: '—', etapa: 0, prioridad: 'media', tags: [],
      thread: [['in', '¿Tienen el Onix en gris plata?', haceDias(1, 18, 2)], ['out', 'Sí, tenemos una unidad. ¿Te paso el precio y las condiciones?', haceDias(1, 18, 20)]] },
    { v: 'C. Ibarra', nombre: 'Jonathan Estevenz', telefono: '+54 9 297 444-5566', canal: 'WhatsApp', s: 'Centro', sector: 'Plan de ahorro', leido: true, modelo: 'S10 High Country', forma_pago: 'Plan de ahorro', presupuesto: 'Cuota N.º 1 de 84', etapa: 1, prioridad: 'media', tags: ['Grupo asignado'],
      thread: [['in', '¿Cuándo sale el próximo sorteo?', haceDias(1, 11, 0)], ['out', 'El próximo sorteo es el 15 de este mes.', haceDias(1, 11, 15)]] },
    { v: 'R. Salto', nombre: 'Paola Cabral', telefono: '+54 9 297 455-6677', canal: 'WhatsApp', s: 'Centro', sector: 'Plan de ahorro', leido: true, modelo: 'Tracker Premier', forma_pago: 'Plan de ahorro', presupuesto: 'Cuota N.º 1 de 84', etapa: 1, prioridad: 'baja', tags: ['Grupo asignado'],
      thread: [['out', 'Paola, tu grupo no salió sorteado esta vez, seguís participando el mes que viene.', haceDias(95, 10, 0)], ['in', 'Quedo atenta al sorteo, gracias', haceDias(95, 10, 30)]] },
    { v: 'A. Cáceres', nombre: 'Ricardo Torres', telefono: '+54 9 297 466-7788', canal: 'Web', s: 'Centro', sector: 'Convencional', leido: true, modelo: 'Onix LTZ', forma_pago: 'Financiado', presupuesto: '$ 29.800.000', etapa: 2, prioridad: 'media', tags: [],
      thread: [['in', '¿Tienen stock del Onix LTZ?', haceDias(3, 9, 0)], ['out', 'Sí, tenemos 2 unidades disponibles en el Centro.', haceDias(3, 9, 20)]] },
    { v: 'W. Villar', nombre: 'Marisa Funes', telefono: '+54 9 297 477-8899', canal: 'WhatsApp', s: 'Centro', sector: 'Convencional', leido: false, modelo: 'S10 High Country', forma_pago: 'Financiado', presupuesto: '$ 52.000.000', etapa: 3, prioridad: 'alta', tags: ['Seguimiento prioritario'],
      nota: 'Está comparando con otra concesionaria, cotización es clave.',
      thread: [['in', '¿Cómo va la cotización que me ibas a mandar?', haceDias(9, 15, 0)], ['out', 'Envío la cotización en un rato', haceDias(9, 15, 10)]] },
    { v: null, nombre: 'Marcela Ríos', telefono: '+54 9 297 488-9900', canal: 'WhatsApp', s: 'Centro', sector: 'Convencional', leido: false, modelo: 'Onix', forma_pago: 'A definir', presupuesto: '—', etapa: 0, prioridad: 'media', tags: [],
      thread: [['in', 'Hola, quiero info del Onix, ¿me pueden pasar precio?', haceMin(15)]] },
    { v: null, nombre: 'Diego Aguirre', telefono: '+54 9 297 499-0011', canal: 'Instagram', s: 'Norte', sector: 'Plan de ahorro', leido: false, modelo: 'S10 High Country', forma_pago: 'Plan de ahorro', presupuesto: '—', etapa: 0, prioridad: 'media', tags: [],
      thread: [['in', '¿Cómo entro al plan de ahorro? Vi la promo en Instagram', haceMin(30)]] },
    { v: 'admin', nombre: 'Claudia Núñez', telefono: '+54 9 297 400-2211', canal: 'WhatsApp', s: 'Centro', sector: 'Convencional', leido: false, modelo: '—', forma_pago: '—', presupuesto: '—', etapa: 0, prioridad: 'alta', tags: ['Reclamo de service'],
      nota: 'Reclamo derivado directamente por administración.',
      thread: [['in', 'Hola, hablé con administración por un reclamo del service, ¿me pueden ayudar?', haceMin(100)], ['out', 'Hola Claudia, sí, lo estoy viendo yo directamente. Te confirmo en el día.', haceMin(98)]] },
    { v: 'admin', nombre: 'Héctor Paz', telefono: '+54 9 297 400-3322', canal: 'WhatsApp', s: 'Centro', sector: 'Convencional', leido: true, modelo: 'Flota (3 unidades)', forma_pago: 'A cotizar', presupuesto: '—', etapa: 1, prioridad: 'media', tags: ['Cliente flota'],
      nota: 'Preparar propuesta especial de flota.',
      thread: [['in', 'Buenas, soy cliente de flota. ¿Manejan descuentos por compra de 3 unidades?', haceDias(1, 16, 0)], ['out', 'Hola Héctor, sí. Te preparo una propuesta especial para flotas.', haceDias(1, 16, 30)]] },
  ];

  const leadIds = {};
  for (const l of leadsMockup) {
    const vendedor_id = l.v === 'admin' ? admin : l.v ? vend[l.v] : null;
    const [row] = await must(sb.from('leads').insert({
      nombre: l.nombre, telefono: l.telefono, canal: l.canal, sucursal_id: suc[l.s], sector: l.sector, vendedor_id,
      modelo: l.modelo, forma_pago: l.forma_pago, presupuesto: l.presupuesto, etapa: l.etapa, prioridad: l.prioridad, tags: l.tags,
      created_at: l.thread[0][2],
    }).select('id'));
    leadIds[l.nombre] = row.id;
    await must(sb.from('mensajes').insert(l.thread.map(([direccion, texto, created_at]) => ({ lead_id: row.id, direccion, texto, created_at, autor_id: direccion === 'out' ? vendedor_id : null }))));
    await must(sb.from('leads').update({ leido: l.leido }).eq('id', row.id));
    if (l.nota) await must(sb.from('notas').insert({ lead_id: row.id, autor_id: vendedor_id ?? admin, texto: l.nota, created_at: l.thread[0][2] }));
  }

  // Cartera adicional para que el pipeline y el seguimiento tengan volumen realista.
  const nombres = ['Sofía', 'Martín', 'Lucía', 'Joaquín', 'Valentina', 'Tomás', 'Camila', 'Nicolás', 'Florencia', 'Agustín', 'Micaela', 'Facundo', 'Julieta', 'Matías', 'Carolina', 'Emiliano', 'Agustina', 'Gonzalo', 'Rocío', 'Leandro'];
  const apellidos = ['Pereyra', 'Gómez', 'Luna', 'Castro', 'Morales', 'Rojas', 'Benítez', 'Medina', 'Suárez', 'Álvarez', 'Ferreyra', 'Quiroga', 'Ramos', 'Vera', 'Ojeda', 'Sánchez', 'Correa', 'Giménez'];
  const consultas = {
    Convencional: ['Hola, ¿qué precio tiene?', '¿Tienen financiación en cuotas fijas?', '¿Toman usado como parte de pago?', 'Quisiera coordinar una prueba de manejo', '¿Hay stock para entrega inmediata?'],
    'Plan de ahorro': ['¿Cómo funciona el plan de ahorro?', '¿Cuánto es la cuota del plan?', '¿Cuándo es la próxima licitación?', 'Quiero adelantar cuotas', '¿Puedo cambiar el modelo del plan?'],
  };
  const modelos = ['Tracker Premier', 'Onix Plus', 'Onix LTZ', 'S10 High Country', 'Spark GT', 'Onix'];
  // Cantidad de leads por etapa final alcanzada (0..5), por sector.
  const distribucion = { Convencional: [9, 12, 9, 3, 3, 8], 'Plan de ahorro': [8, 9, 7, 2, 7, 7] };
  // Antigüedad del último contacto (días) — cubre los tramos de 1 semana a 18 meses.
  const antiguedades = [0, 0, 1, 2, 3, 4, 8, 10, 12, 35, 45, 60, 100, 120, 190, 200, 280, 300, 380, 400, 560];

  const extraLeads = [];
  for (const sector of Object.keys(distribucion)) {
    const delSector = vendedoresBase.filter((v) => v[2] === sector);
    distribucion[sector].forEach((cant, etapa) => {
      for (let i = 0; i < cant; i++) {
        const [vNombre, vSuc] = pick(delSector);
        const dias = pick(antiguedades);
        const creado = haceDias(dias + Math.floor(rnd() * 20), 9 + Math.floor(rnd() * 9), Math.floor(rnd() * 60));
        extraLeads.push({
          lead: {
            nombre: `${pick(nombres)} ${pick(apellidos)}`, telefono: `+54 9 297 ${400 + Math.floor(rnd() * 99)}-${1000 + Math.floor(rnd() * 8999)}`,
            canal: pick(['WhatsApp', 'WhatsApp', 'WhatsApp', 'Web', 'Instagram', 'Marketplace']), sucursal_id: suc[vSuc], sector, vendedor_id: vend[vNombre],
            modelo: pick(modelos), forma_pago: sector === 'Plan de ahorro' ? 'Plan de ahorro' : pick(['Contado', 'Financiado', 'A definir']),
            presupuesto: sector === 'Plan de ahorro' ? `Cuota N.º ${1 + Math.floor(rnd() * 6)} de 84` : `$ ${20 + Math.floor(rnd() * 30)}.000.000`,
            etapa, prioridad: pick(['alta', 'media', 'media', 'baja']), tags: [], leido: true, created_at: creado,
          },
          texto: pick(consultas[sector]),
          fecha: haceDias(dias, 9 + Math.floor(rnd() * 9), Math.floor(rnd() * 60)),
        });
      }
    });
  }
  for (const e of extraLeads) {
    const [row] = await must(sb.from('leads').insert(e.lead).select('id'));
    await must(sb.from('mensajes').insert({ lead_id: row.id, direccion: 'in', texto: e.texto, created_at: e.fecha }));
    await must(sb.from('leads').update({ leido: true, etapa_actualizada_at: e.fecha }).eq('id', row.id));
  }

  console.log('Creando ventas…');
  // Ventas del mockup + volumen para que el ranking mensual refleje el del diseño.
  const ventas = [
    { cliente: 'Romina Díaz', vehiculo: 'Chevrolet Tracker Premier', v: 'M. González', s: 'Centro', sector: 'Convencional', fecha: diaDelMes(1), monto: '$ 42.300.000', extra: [{ k: 'Forma de entrega', v: 'Retira en sucursal' }, { k: 'N° de cuadro', v: 'AR-88213' }] },
    { cliente: 'Fernando Acosta', vehiculo: 'Chevrolet Onix Plus', v: 'J. Perotti', s: 'Norte', sector: 'Convencional', fecha: diaDelMes(1), monto: '$ 28.900.000', extra: [{ k: 'Financiera', v: 'Banco Nación' }] },
    { cliente: 'Laura Sosa', vehiculo: 'Chevrolet S10 High Country', v: 'C. Ibarra', s: 'Centro', sector: 'Plan de ahorro', fecha: diaDelMes(28, -1), monto: 'Cuota N.º 1 de 84', extra: [{ k: 'N° de orden', v: '145-C' }, { k: 'Grupo', v: 'S10-2026-04' }] },
    { cliente: 'Gustavo Núñez', vehiculo: 'Chevrolet Spark GT', v: 'D. Farías', s: 'Norte', sector: 'Convencional', fecha: diaDelMes(28, -1), monto: '$ 19.500.000', extra: [] },
    { cliente: 'Paola Cabral', vehiculo: 'Chevrolet Tracker Premier', v: 'R. Salto', s: 'Centro', sector: 'Plan de ahorro', fecha: diaDelMes(27, -1), monto: 'Cuota N.º 1 de 84', extra: [{ k: 'N° de orden', v: '145-D' }] },
    { cliente: 'Ricardo Torres', vehiculo: 'Chevrolet Onix Plus', v: 'M. González', s: 'Centro', sector: 'Convencional', fecha: diaDelMes(26, -1), monto: '$ 27.100.000', extra: [{ k: 'Entrega de usado', v: 'VW Gol 2018' }] },
    { cliente: 'Marisa Funes', vehiculo: 'Chevrolet S10 High Country', v: 'J. Perotti', s: 'Norte', sector: 'Convencional', fecha: diaDelMes(25, -1), monto: '$ 52.800.000', extra: [] },
    { cliente: 'Jonathan Estevenz', vehiculo: 'Chevrolet Onix Plus', v: 'C. Ibarra', s: 'Centro', sector: 'Plan de ahorro', fecha: diaDelMes(24, -1), monto: 'Cuota N.º 3 de 84', extra: [{ k: 'N° de orden', v: '139-A' }, { k: 'Estado', v: 'Al día' }] },
  ];
  const hoyDia = Math.max(1, ahora.getDate());
  const delMesActual = (n) => ventas.filter((x) => x.v === n && x.fecha.getMonth() === ahora.getMonth()).length;
  for (const [nombre, s, sector, objetivo] of vendedoresBase) {
    for (let i = delMesActual(nombre); i < objetivo; i++) {
      ventas.push({
        cliente: `${pick(nombres)} ${pick(apellidos)}`, vehiculo: `Chevrolet ${pick(modelos)}`, v: nombre, s, sector,
        fecha: diaDelMes(1 + Math.floor(rnd() * hoyDia)),
        monto: sector === 'Plan de ahorro' ? 'Cuota N.º 1 de 84' : `$ ${20 + Math.floor(rnd() * 30)}.${100 + Math.floor(rnd() * 800)}.000`, extra: [],
      });
    }
    // Algunas ventas del mes anterior para el filtro por mes.
    for (let i = 0; i < Math.ceil(objetivo / 2); i++) {
      ventas.push({ cliente: `${pick(nombres)} ${pick(apellidos)}`, vehiculo: `Chevrolet ${pick(modelos)}`, v: nombre, s, sector, fecha: diaDelMes(1 + Math.floor(rnd() * 27), -1), monto: sector === 'Plan de ahorro' ? 'Cuota N.º 1 de 84' : '$ 30.000.000', extra: [] });
    }
  }
  await must(sb.from('ventas').insert(ventas.map((x) => ({
    cliente: x.cliente, vehiculo: x.vehiculo, vendedor_id: vend[x.v], sucursal_id: suc[x.s], sector: x.sector, fecha: iso(x.fecha), monto: x.monto, extra: x.extra,
  }))));

  console.log('Creando test drives, alertas y panel general…');
  await must(sb.from('test_drives').insert([
    { vehiculo: 'Tracker Premier', cliente: 'Romina Díaz', lead_id: leadIds['Romina Díaz'], v: 'M. González', s: 'Centro', d: 1, hora: '16:00', estado: 'pendiente' },
    { vehiculo: 'Onix Plus', cliente: 'Sofía Luna', v: 'A. Cáceres', s: 'Centro', d: 1, hora: '10:00', estado: 'aprobado' },
    { vehiculo: 'S10 High Country', cliente: 'Gustavo Núñez', lead_id: leadIds['Gustavo Núñez'], v: 'D. Farías', s: 'Norte', d: 2, hora: '11:00', estado: 'aprobado' },
    { vehiculo: 'Onix Plus', cliente: 'Laura Sosa', lead_id: leadIds['Laura Sosa'], v: 'M. González', s: 'Centro', d: -3, hora: '09:00', estado: 'hecho' },
    { vehiculo: 'Tracker Premier', cliente: 'Paola Cabral', lead_id: leadIds['Paola Cabral'], v: 'R. Salto', s: 'Centro', d: 7, hora: '14:00', estado: 'pendiente' },
    { vehiculo: 'S10 High Country', cliente: 'Ricardo Torres', lead_id: leadIds['Ricardo Torres'], v: 'C. Ibarra', s: 'Centro', d: 13, hora: '10:00', estado: 'aprobado' },
  ].map((t) => ({ vehiculo: t.vehiculo, cliente: t.cliente, lead_id: t.lead_id ?? null, vendedor_id: vend[t.v], sucursal_id: suc[t.s], fecha: iso(enDias(t.d)), hora: t.hora, estado: t.estado }))));

  const alertaEn = (d, hora) => { const x = enDias(d); const [h, m] = hora.split(':'); x.setHours(+h, +m, 0, 0); return x.toISOString(); };
  await must(sb.from('alertas').insert([
    { owner_id: vend['M. González'], lead_id: leadIds['Romina Díaz'], mensaje: 'Preguntar por seguro del vehículo', fecha: alertaEn(1, '09:00') },
    { owner_id: vend['M. González'], lead_id: leadIds['Romina Díaz'], mensaje: 'Confirmar color definitivo antes de facturar', fecha: alertaEn(3, '11:00') },
    { owner_id: vend['M. González'], lead_id: leadIds['Laura Sosa'], mensaje: 'Llamar para coordinar entrega', fecha: alertaEn(0, '15:00') },
    { owner_id: vend['M. González'], lead_id: null, mensaje: 'Revisar stock de Spark GT antes de cotizar', fecha: alertaEn(2, '10:00') },
  ]));

  await must(sb.from('comunicados').insert([
    { tag: 'CAP', texto: 'Capacitación de producto — línea Tracker 2026', detalle: 'Jueves 9:00 · Sala de reuniones' },
    { tag: 'REU', texto: 'Reunión mensual de equipo comercial', detalle: 'Lunes 8:30' },
    { tag: 'STOCK', texto: 'Llegada de stock — 6 unidades Onix Plus', detalle: 'Miércoles · Depósito Centro' },
  ]));
  await must(sb.from('giras').insert([
    { destino: 'Rada Tilly', fecha: 'Sáb · 9:00', unidades: '3 unidades' },
    { destino: 'Sarmiento', fecha: 'Mar · 8:30', unidades: '2 unidades' },
    { destino: 'Caleta Olivia', fecha: 'Vie · 9:00', unidades: 'Por confirmar' },
    { destino: 'Río Gallegos', fecha: 'Jue · 7:00', unidades: '4 unidades' },
  ]));
  await must(sb.from('entregas').insert([
    { vehiculo: 'Onix Plus', cliente: 'L. Sosa', dia: 'Jue' },
    { vehiculo: 'Tracker Premier', cliente: 'P. Cabral', dia: 'Vie' },
    { vehiculo: 'S10 High Country', cliente: 'G. Núñez', dia: 'Sáb' },
  ]));

  console.log(`\nListo. Contraseña de todos los usuarios de prueba: ${PASSWORD}`);
  console.log('  Administradora: jennifer.rossetti@akarautomotores.com.ar');
  console.log('  Supervisores:   r.medina@akarautomotores.com.ar (Centro), l.funes@akarautomotores.com.ar (Norte)');
  console.log('  Vendedor:       m.gonzalez@akarautomotores.com.ar (y el resto con el mismo formato)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
