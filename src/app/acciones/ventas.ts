'use server';

import { refresh } from 'next/cache';
import { contexto, error, ok, texto } from '@/lib/acciones';
import type { CampoExtra, Resultado, Sector } from '@/lib/tipos';

export async function crearVenta(fd: FormData): Promise<Resultado> {
  const { supabase, esGestion } = await contexto();
  if (!esGestion) return error('No tenés permisos para registrar ventas.');
  const cliente = texto(fd, 'cliente');
  const vehiculo = texto(fd, 'vehiculo');
  const vendedorId = texto(fd, 'vendedor_id');
  if (!cliente || !vehiculo || !vendedorId) return error('Completá cliente, vehículo y vendedor.');

  const { data: vendedor } = await supabase.from('perfiles').select('sucursal_id, sector').eq('id', vendedorId).single();
  const { error: e } = await supabase.from('ventas').insert({
    cliente,
    vehiculo,
    vendedor_id: vendedorId,
    sucursal_id: Number(texto(fd, 'sucursal_id')) || vendedor?.sucursal_id || null,
    sector: (texto(fd, 'sector') || vendedor?.sector || 'Convencional') as Sector,
    fecha: texto(fd, 'fecha') || undefined,
    monto: texto(fd, 'monto') || '—',
  });
  if (e) return error(e);
  refresh();
  return ok('Venta registrada.');
}

export async function agregarCampoExtra(ventaId: number, campo: CampoExtra): Promise<Resultado> {
  const k = campo.k.trim();
  const v = campo.v.trim();
  if (!k || !v) return error('Completá el campo y el valor.');
  const { supabase } = await contexto();
  const { data: venta } = await supabase.from('ventas').select('extra').eq('id', ventaId).single<{ extra: CampoExtra[] }>();
  if (!venta) return error('No se encontró la venta.');
  const { error: e } = await supabase.from('ventas').update({ extra: [...venta.extra, { k, v }] }).eq('id', ventaId);
  if (e) return error(e);
  refresh();
  return ok();
}
