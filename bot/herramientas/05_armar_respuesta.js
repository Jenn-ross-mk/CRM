// Datos que manda el bot
const entrada = $('Gatillo').first().json;
const buscado = String(entrada.modelo || '').trim().toLowerCase();
const consulta = String(entrada.consulta || 'stock').trim().toLowerCase();
const hoy = $now.toFormat('yyyy-MM-dd');

// Lee una columna sin importar mayúsculas (por ejemplo "Financiamiento")
const campo = (fila, nombre) => {
  const clave = Object.keys(fila).find(k => k.toLowerCase() === nombre);
  return clave === undefined ? null : fila[clave];
};

// Convierte lo que entrega Baserow en texto (selecciones, listas, vacíos)
const texto = (v) => {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.map(texto).filter(Boolean).join(', ');
  if (typeof v === 'object') return String(v.value ?? v.name ?? '').trim();
  return String(v).trim();
};

// Dirección del primer archivo de una columna de archivos
const archivo = (v) => (Array.isArray(v) && v.length && v[0].url) ? v[0].url : '';

// Fecha de Baserow (2026-10-01 o 01/10/2026) en formato 2026-10-01
const fecha = (v) => {
  const t = texto(v);
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : t.slice(0, 10);
};

// La promoción solo va si hoy está entre promo_desde y promo_hasta
const promoVigente = (fila) => {
  const promo = texto(campo(fila, 'promocion'));
  const desde = fecha(campo(fila, 'promo_desde'));
  const hasta = fecha(campo(fila, 'promo_hasta'));
  if (!promo) return '';
  if (desde && hoy < desde) return '';
  if (hasta && hoy > hasta) return '';
  return promo;
};

// Saca los datos vacíos para que el bot no los mencione
const limpiar = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== ''));

// Solo las filas marcadas como disponibles
const disponibles = $input.all().map(i => i.json)
  .filter(f => f.id && campo(f, 'disponible') === true);

// Buscar el modelo: "Onix" trae Onix y Onix Plus.
// Si el bot mandó algo más largo ("Onix RS Turbo"), busca el modelo dentro de eso.
const modeloDe = (f) => texto(campo(f, 'modelo')).toLowerCase();
let encontrados = disponibles.filter(f => !buscado || modeloDe(f).includes(buscado));
if (!encontrados.length) {
  encontrados = disponibles.filter(f => modeloDe(f) && buscado.includes(modeloDe(f)));
}

// No se encontró el modelo: devolver la lista de todo lo disponible
if (!encontrados.length) {
  return [{ json: {
    respuesta: 'Estos son los vehículos disponibles. No se encontró el modelo pedido con ese nombre.',
    vehiculos: disponibles.map(f => `${texto(campo(f, 'modelo'))} ${texto(campo(f, 'version'))}`),
  } }];
}

// Datos de cada versión (con 'detalle' se agregan ficha, link y foto)
const esDetalle = consulta !== 'stock';
const vehiculos = encontrados.map(f => limpiar({
  modelo: texto(campo(f, 'modelo')),
  version: texto(campo(f, 'version')),
  categorias: texto(campo(f, 'categorias')),
  segmento: texto(campo(f, 'segmento')),
  transmision: texto(campo(f, 'transmision')),
  combustible: texto(campo(f, 'combustible')),
  puntos_fuertes: texto(campo(f, 'puntos_fuertes')),
  opciones_de_pago: texto(campo(f, 'financiamiento')),
  promocion: promoVigente(f),
  ...(esDetalle ? {
    ficha_tecnica: archivo(campo(f, 'ficha_tecnica')),
    url_web: texto(campo(f, 'link_web')),
    img_url: archivo(campo(f, 'foto')),
  } : {}),
}));

return [{ json: {
  respuesta: esDetalle ? 'Detalle de las versiones encontradas' : 'Versiones disponibles',
  marca: 'Chevrolet',
  vehiculos,
} }];
