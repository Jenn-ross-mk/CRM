// Respuesta que escribió la IA
const texto = String($('AI Agent').first().json.output || '');
const lead_id = $('Guardar mensaje en CRM').first().json.lead.lead_id;

// Cada bloque separado por [NM] es un mensaje aparte
let partes = texto
  .split(/\s*\[NM\]\s*/i)
  .map(p => p.replace(/\\n/g, '\n').trim())
  .filter(Boolean);

// El saludo siempre va solo, aunque la IA lo haya pegado al resto
const saludo = /^(¡?hola!?[^\n]*?gracias por (?:escribirnos|ponerte en contacto con nosotros)[.!]?)\s+([\s\S]+)$/i;
partes = partes.flatMap(p => {
  const m = p.match(saludo);
  return m ? [m[1].trim(), m[2].trim()] : [p];
});

// Si un mensaje trae una lista, la pregunta final va en un mensaje aparte
partes = partes.flatMap(p => {
  if (!/\n\s*[-•]/.test(p)) return [p];
  const m = p.match(/^([\s\S]*[.!:\n])\s*(¿[^?¿]*\?)\s*$/);
  return m ? [m[1].trim(), m[2].trim()] : [p];
});

// Una URL sola de imagen o PDF se guarda como archivo; el resto, como texto
return partes.map(p => {
  let tipo = 'texto';
  if (/^https?:\/\/\S+$/i.test(p)) {
    const limpio = p.split('?')[0].toLowerCase();
    if (/\.(jpe?g|png|webp|gif)$/.test(limpio)) tipo = 'imagen';
    else if (/\.pdf$/.test(limpio)) tipo = 'documento';
  }
  return { json: {
    lead_id,
    tipo,
    contenido: tipo === 'texto' ? p : '',
    media_url: tipo === 'texto' ? '' : p,
  } };
});
