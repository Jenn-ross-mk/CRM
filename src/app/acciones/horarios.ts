'use server';

import { refresh } from 'next/cache';
import { contexto, error, ok, texto } from '@/lib/acciones';
import type { Resultado } from '@/lib/tipos';

const MAX_DIAS = 31;

/** Días 'YYYY-MM-DD' entre dos fechas (inclusive). */
function dias(desde: string, hasta: string): string[] {
  const out: string[] = [];
  const d = new Date(`${desde}T12:00:00Z`);
  const fin = new Date(`${hasta}T12:00:00Z`);
  while (d <= fin && out.length <= MAX_DIAS) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/**
 * Carga el horario de un vendedor para una fecha o un rango de fechas (un registro por día).
 * La asignación automática solo tiene en cuenta a los vendedores que están dentro de su horario.
 */
export async function cargarHorario(fd: FormData): Promise<Resultado> {
  const { supabase, esAdmin } = await contexto();
  if (!esAdmin) return error('Solo un administrador puede cargar horarios.');
  const usuarioId = Number(texto(fd, 'usuario_id'));
  const desde = texto(fd, 'fecha');
  const hasta = texto(fd, 'fecha_hasta') || desde;
  const horaDesde = texto(fd, 'hora_desde');
  const horaHasta = texto(fd, 'hora_hasta');
  const soloHabiles = fd.get('solo_habiles') === 'on';
  if (!usuarioId) return error('Elegí un vendedor.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta) || hasta < desde) return error('Revisá las fechas.');
  if (!/^\d{2}:\d{2}$/.test(horaDesde) || !/^\d{2}:\d{2}$/.test(horaHasta) || horaDesde >= horaHasta) return error('La hora de inicio tiene que ser anterior a la de fin.');

  let fechas = dias(desde, hasta);
  if (fechas.length > MAX_DIAS) return error(`Cargá como máximo ${MAX_DIAS} días por vez.`);
  if (soloHabiles) fechas = fechas.filter((f) => new Date(`${f}T12:00:00Z`).getUTCDay() !== 0);
  if (!fechas.length) return error('No quedó ningún día para cargar.');

  const { error: e } = await supabase.from('horarios_vendedor').insert(
    fechas.map((fecha) => ({ usuario_id: usuarioId, fecha, hora_desde: horaDesde, hora_hasta: horaHasta }))
  );
  if (e) return error(e);
  refresh();
  return ok(fechas.length === 1 ? 'Horario cargado.' : `Se cargaron ${fechas.length} días.`);
}

export async function eliminarHorario(id: number): Promise<Resultado> {
  const { supabase, esAdmin } = await contexto();
  if (!esAdmin) return error('Solo un administrador puede modificar horarios.');
  const { error: e } = await supabase.from('horarios_vendedor').delete().eq('id', id);
  if (e) return error(e);
  refresh();
  return ok();
}
