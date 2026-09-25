'use server';

import { refresh } from 'next/cache';
import { contexto, error, ok } from '@/lib/acciones';
import { instanteLocal } from '@/lib/fechas';
import type { Resultado } from '@/lib/tipos';

/** Crea una alerta/recordatorio. `fecha` 'YYYY-MM-DD' y `hora` 'HH:MM' en hora local. */
export async function crearAlerta(datos: { fecha: string; hora: string; mensaje: string; leadId: number | null }): Promise<Resultado> {
  const mensaje = datos.mensaje.trim();
  if (!datos.fecha || !datos.hora || !mensaje) return error('Completá la fecha, la hora y el mensaje.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha) || !/^\d{2}:\d{2}$/.test(datos.hora)) return error('Fecha u hora inválida.');
  const { supabase, usuario } = await contexto();
  const { error: e } = await supabase.from('alertas').insert({
    usuario_id: usuario.id,
    lead_id: datos.leadId,
    mensaje,
    fecha_hora: instanteLocal(datos.fecha, datos.hora),
  });
  if (e) return error(e);
  refresh();
  return ok();
}

export async function eliminarAlerta(id: number): Promise<Resultado> {
  const { supabase } = await contexto();
  const { error: e } = await supabase.from('alertas').delete().eq('id', id);
  if (e) return error(e);
  refresh();
  return ok();
}
