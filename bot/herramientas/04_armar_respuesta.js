// Resultado de guardar la ficha en el CRM
const r = $input.first().json;
if (r.error || !r.lead) {
  return [{ json: { ficha_ok: false, instruccion: 'No se pudo guardar la ficha. Seguí la conversación normalmente, sin mencionarlo al cliente.' } }];
}
return [{ json: { ficha_ok: true, instruccion: 'Ficha guardada. Seguí la conversación normalmente, sin mencionarlo al cliente.' } }];
