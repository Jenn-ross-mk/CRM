'use server';

import { refresh } from 'next/cache';
import { contexto, error, ok } from '@/lib/acciones';
import { instanteLocal } from '@/lib/fechas';
import type { Resultado } from '@/lib/tipos';

async function gestionar(fn: (sb: Awaited<ReturnType<typeof contexto>>['supabase']) => PromiseLike<{ error: unknown }>): Promise<Resultado> {
  const { supabase, esGestion } = await contexto();
  if (!esGestion) return error('No tenés permisos para editar el panel general.');
  const { error: e } = await fn(supabase);
  if (e) return error(e);
  refresh();
  return ok();
}

const esFecha = (f: string) => /^\d{4}-\d{2}-\d{2}$/.test(f);

// El comunicado se carga en una línea: "texto · cuándo" (igual que en el mockup).
export async function agregarComunicado(textoLibre: string, categoria = 'INFO'): Promise<Resultado> {
  const [texto, cuando] = textoLibre.split('·').map((p) => p.trim()).filter(Boolean);
  if (!texto) return error('Escribí el comunicado.');
  return gestionar((sb) => sb.from('comunicados').insert({ categoria: categoria.trim().toUpperCase().slice(0, 6) || 'INFO', texto, cuando: cuando ?? null }));
}

/** Los comunicados no se borran: se ocultan (activo = false). */
export async function ocultarComunicado(id: number): Promise<Resultado> {
  return gestionar((sb) => sb.from('comunicados').update({ activo: false }).eq('id', id));
}

export async function agregarGira(datos: { destino: string; fecha: string; hora: string; unidades: string }): Promise<Resultado> {
  const destino = datos.destino.trim();
  if (!destino) return error('Escribí el destino de la gira.');
  if (!esFecha(datos.fecha) || !/^\d{2}:\d{2}$/.test(datos.hora)) return error('Elegí la fecha y la hora de la gira.');
  return gestionar((sb) => sb.from('giras_plan_ahorro').insert({ destino, fecha_hora: instanteLocal(datos.fecha, datos.hora), unidades: datos.unidades.trim() || null }));
}

export async function agregarEntrega(datos: { vehiculo: string; cliente: string; fecha: string }): Promise<Resultado> {
  const vehiculo = datos.vehiculo.trim();
  const cliente = datos.cliente.trim();
  if (!vehiculo || !cliente) return error('Completá el vehículo y el cliente.');
  if (!esFecha(datos.fecha)) return error('Elegí la fecha de entrega.');
  return gestionar((sb) => sb.from('entregas').insert({ vehiculo, cliente_nombre: cliente, fecha: datos.fecha }));
}

export async function marcarEntregada(id: number): Promise<Resultado> {
  return gestionar((sb) => sb.from('entregas').update({ entregada: true }).eq('id', id));
}

export async function eliminarItemPanel(tabla: 'giras_plan_ahorro' | 'entregas', id: number): Promise<Resultado> {
  return gestionar((sb) => sb.from(tabla).delete().eq('id', id));
}
