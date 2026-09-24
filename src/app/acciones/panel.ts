'use server';

import { refresh } from 'next/cache';
import { contexto, error, ok } from '@/lib/acciones';
import type { Resultado } from '@/lib/tipos';

type Tabla = 'comunicados' | 'giras' | 'entregas';

async function gestionar(fn: (sb: Awaited<ReturnType<typeof contexto>>['supabase']) => PromiseLike<{ error: unknown }>): Promise<Resultado> {
  const { supabase, esGestion } = await contexto();
  if (!esGestion) return error('No tenés permisos para editar el panel general.');
  const { error: e } = await fn(supabase);
  if (e) return error(e);
  refresh();
  return ok();
}

// Los textos se cargan en una sola línea separando partes con "·", igual que en el mockup.
const partes = (t: string) => t.split('·').map((p) => p.trim()).filter(Boolean);

export async function agregarComunicado(textoLibre: string, tag = 'INFO'): Promise<Resultado> {
  const [texto, detalle] = partes(textoLibre);
  if (!texto) return error('Escribí el comunicado.');
  return gestionar((sb) => sb.from('comunicados').insert({ tag: tag.trim().toUpperCase().slice(0, 6) || 'INFO', texto, detalle: detalle ?? 'Agregado por administración' }));
}

export async function agregarGira(textoLibre: string): Promise<Resultado> {
  const [destino, fecha, unidades] = partes(textoLibre);
  if (!destino) return error('Escribí el destino de la gira.');
  return gestionar((sb) => sb.from('giras').insert({ destino, fecha: fecha ?? 'A confirmar', unidades: unidades ?? 'Por confirmar' }));
}

export async function agregarEntrega(textoLibre: string): Promise<Resultado> {
  const [vehiculo, cliente, dia] = partes(textoLibre);
  if (!vehiculo) return error('Escribí el vehículo a entregar.');
  return gestionar((sb) => sb.from('entregas').insert({ vehiculo, cliente: cliente ?? '—', dia: dia ?? 'Por definir' }));
}

export async function marcarEntregada(id: number): Promise<Resultado> {
  return gestionar((sb) => sb.from('entregas').update({ hecha: true }).eq('id', id));
}

export async function eliminarItemPanel(tabla: Tabla, id: number): Promise<Resultado> {
  return gestionar((sb) => sb.from(tabla).delete().eq('id', id));
}
