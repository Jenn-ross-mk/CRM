// Datos que mandó el bot (texto en formato JSON)
const g = $('Gatillo').first().json;
let d = g.datos;
if (typeof d === 'string') {
  try { d = JSON.parse(d.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()); } catch (e) { d = {}; }
}
if (!d || typeof d !== 'object' || Array.isArray(d)) d = {};

// Ayudas para limpiar los valores
const limpio = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, '_');
const texto = (v) => (v === null || v === undefined || typeof v === 'object') ? '' : String(v).trim();
const elegir = (v, opciones) => opciones[limpio(v)] || '';
const siNo = (v) => {
  if (typeof v === 'boolean') return v;
  const t = limpio(v);
  if (['si', 'true', '1'].includes(t)) return true;
  if (['no', 'false', '0'].includes(t)) return false;
  return null;
};

// Valores permitidos por el CRM
const ficha = {
  nombre_cliente: texto(d.nombre),
  localidad: texto(d.localidad),
  tipo: elegir(d.tipo, { '0km': '0km', '0_km': '0km', nuevo: '0km', usado: 'usado', usados: 'usado', promocion: 'promocion' }),
  sector: elegir(d.sector, {
    convencional: 'convencional', venta_convencional: 'convencional',
    plan_ahorro: 'plan_ahorro', plan_de_ahorro: 'plan_ahorro', plan: 'plan_ahorro',
    usados: 'usados', usado: 'usados', postventa: 'postventa', service: 'postventa', repuestos: 'repuestos',
  }),
  vehiculo_interes: texto(d.vehiculo_interes),
  marca: texto(d.marca),
  modelo_anio: texto(d.modelo_anio),
  uso: elegir(d.uso, { comercial: 'comercial', familiar: 'familiar', laboral: 'laboral', trabajo: 'laboral' }),
  forma_pago: elegir(d.forma_pago, {
    financiacion: 'financiacion', convencional: 'financiacion', venta_convencional: 'financiacion', tasa_0: 'financiacion',
    plan_ahorro: 'plan_ahorro', plan_de_ahorro: 'plan_ahorro', plan: 'plan_ahorro',
    contado: 'contado', efectivo: 'contado',
  }),
  entrega_vehiculo: siNo(d.entrega_usado),
  clasificacion: elegir(d.clasificacion, { frio: 'frio', tibio: 'tibio', caliente: 'caliente' }),
  urgencia: texto(d.urgencia),
  contexto_conversacion: texto(d.resumen),
  strike: siNo(d.pregunto_precio) === true ? '1' : '',
};

// Solo se mandan los datos que vinieron
const datos = Object.fromEntries(Object.entries(ficha).filter(([, v]) => v !== '' && v !== null));
return [{ json: { lead_id: g.lead_id, datos: JSON.stringify(datos) } }];
