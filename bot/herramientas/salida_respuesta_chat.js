// Junta los mensajes para mostrarlos en el chat de prueba de n8n
const partes = $('Separar mensajes').all().map(i => i.json.contenido || i.json.media_url);
return [{ json: { output: partes.join('\n\n') } }];
