'use server';

import { refresh } from 'next/cache';
import { contexto, error, ok, texto } from '@/lib/acciones';
import { SECTORES_VENTA } from '@/lib/constantes';
import type { CampoExtra, Resultado, Sector } from '@/lib/tipos';

/** "$ 30.000.000,50" -> 30000000.5 (formato argentino). Vacío o inválido -> null. */
function monto(valor: string): number | null {
  const limpio = valor.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(limpio);
  return limpio && Number.isFinite(n) ? n : null;
}

export async function crearVenta(fd: FormData): Promise<Resultado> {
  const { supabase, esGestion } = await contexto();
  if (!esGestion) return error('No tenés permisos para registrar ventas.');
  const cliente = texto(fd, 'cliente');
  const vehiculo = texto(fd, 'vehiculo');
  const vendedorId = Number(texto(fd, 'vendedor_id'));
  if (!cliente || !vehiculo || !vendedorId) return error('Completá cliente, vehículo y vendedor.');

  const { data: vendedor } = await supabase.from('usuarios').select('sucursal_id, sector').eq('id', vendedorId).single();
  const sectorElegido = texto(fd, 'sector') as Sector;
  const sector = SECTORES_VENTA.includes(sectorElegido) ? sectorElegido : SECTORES_VENTA.includes(vendedor?.sector) ? vendedor?.sector : 'convencional';
  const { error: e } = await supabase.from('ventas').insert({
    cliente_nombre: cliente,
    vehiculo,
    vendedor_id: vendedorId,
    sucursal_id: Number(texto(fd, 'sucursal_id')) || vendedor?.sucursal_id || null,
    sector,
    fecha: texto(fd, 'fecha') || undefined,
    monto: monto(texto(fd, 'monto')),
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
  const { data: venta } = await supabase.from('ventas').select('datos_extra').eq('id', ventaId).single<{ datos_extra: CampoExtra[] | null }>();
  if (!venta) return error('No se encontró la venta.');
  const { error: e } = await supabase.from('ventas').update({ datos_extra: [...(venta.datos_extra ?? []), { k, v }] }).eq('id', ventaId);
  if (e) return error(e);
  refresh();
  return ok();
}
