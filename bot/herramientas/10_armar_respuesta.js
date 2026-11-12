// Clave que pidió el bot (puede pedir varias separadas por coma)
const normalizar = (t) => String(t ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toUpperCase().trim().replace(/\s+/g, '_');
let pedidas = String($('Gatillo').first().json.clave || '')
  .split(',').map(normalizar).filter(Boolean);

// Dirección y horario van siempre juntos: si pide uno, se mandan los dos
const esUbicacionOHorario = (p) => /^(UBICACION|DIRECCION|SUCURSAL|HORARIO)/.test(p);
if (pedidas.some(esUbicacionOHorario)) {
  pedidas = [...new Set([...pedidas, 'UBICACION', 'HORARIO'])];
}

// Lee una columna sin importar mayúsculas y convierte selecciones en texto
const campo = (fila, nombre) => {
  const clave = Object.keys(fila).find(k => k.toLowerCase() === nombre);
  const v = clave === undefined ? null : fila[clave];
  if (v && typeof v === 'object') return String(v.value ?? '').trim();
  return String(v ?? '').trim();
};

// Todas las filas de Informacion_General
const filas = $input.all().map(i => i.json)
  .filter(f => f.id)
  .map(f => ({ clave: normalizar(campo(f, 'clave')), contenido: campo(f, 'contenido') }))
  .filter(f => f.clave && f.contenido);

// Busca la clave pedida (acepta "HORARIO" o "HORARIOS", con o sin texto después)
const base = (t) => t.replace(/S$/, '');
const coincide = (clave, pedida) => clave.startsWith(base(pedida));
const encontradas = filas.filter(f => pedidas.some(p => coincide(f.clave, p)));

// Si no pidió clave o no existe, devuelve toda la información
if (!encontradas.length) {
  return [{ json: {
    respuesta: pedidas.length ? 'No se encontró esa clave. Esta es toda la información institucional de AKAR.' : 'Información institucional de AKAR.',
    informacion: filas,
  } }];
}
return [{ json: { respuesta: 'Información institucional de AKAR.', informacion: encontradas } }];
