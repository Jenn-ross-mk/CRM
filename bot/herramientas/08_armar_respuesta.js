// Resultado que devolvió el CRM (bot_derivar)
const entrada = $input.first().json;
let res = entrada.resultado;
if (typeof res === 'string') {
  try { res = JSON.parse(res); } catch (e) { res = null; }
}

// Si el nodo anterior falló, no hay derivación
const tipo = (entrada.error || !res || !res.resultado) ? 'error' : res.resultado;

// Qué tiene que decirle el bot al cliente en cada caso
let instruccion;
if (tipo === 'asignado' || tipo === 'prueba') {
  instruccion = 'Derivación hecha. Avisale al cliente que un asesor lo va a contactar a la brevedad. No digas el nombre del vendedor.';
} else if (tipo === 'en_cola') {
  instruccion = 'Derivación hecha, pero es fuera del horario de atención y el contacto queda en espera. Consultá el horario con info_general (clave HORARIO), recordáselo al cliente y avisale que un asesor lo va a contactar dentro de ese horario.';
} else if (tipo === 'sin_asignar' && res.causa === 'problema') {
  instruccion = 'Derivación hecha. Pedile disculpas por las molestias y avisale que un responsable lo va a contactar a la brevedad.';
} else if (tipo === 'sin_asignar') {
  instruccion = 'Derivación hecha. Avisale al cliente que un asesor lo va a contactar a la brevedad.';
} else if (tipo === 'no_contactar') {
  instruccion = 'Quedó registrado que el cliente no quiere ser contactado. Despedite con amabilidad, sin ofrecerle nada más.';
} else {
  instruccion = 'La derivación NO se pudo hacer. No le digas al cliente que un asesor lo va a contactar. Decile que en este momento no pudiste pasar sus datos y que puede volver a escribir más tarde.';
}

return [{ json: { derivacion_ok: tipo !== 'error', resultado: tipo, instruccion } }];
