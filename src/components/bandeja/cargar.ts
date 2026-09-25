import 'server-only';
import { detalleLead, listarBandeja, listarEtapas, listarEtiquetas, listarModelos, listarSucursales, listarUsuarios } from '@/lib/datos';
import type { Sesion } from '@/lib/sesion';
import type { PropsBandeja } from './bandeja';

export type ParamsBandeja = { f?: string; lead?: string; q?: string; v?: string };

/** Carga todo lo que necesita la bandeja según el rol y los parámetros de la URL. */
export async function cargarBandeja(modo: 'vendedor' | 'gestion', sesion: Sesion, params: ParamsBandeja): Promise<PropsBandeja> {
  const yo = sesion.usuario;
  const filtroLeido = params.f === 'si' ? 'si' : 'no';
  // Si la URL ya dice qué lead abrir, su detalle se busca en paralelo con la lista.
  const leadPedido = Number(params.lead) || null;
  const [leads, usuarios, sucursales, modelos, etapas, etiquetas, detallePedido] = await Promise.all([
    listarBandeja({
      vendedorId: modo === 'vendedor' ? yo.id : params.v && params.v !== '__sin__' ? Number(params.v) || null : null,
      sinAsignar: modo === 'gestion' && params.v === '__sin__',
      q: params.q,
    }),
    listarUsuarios(),
    listarSucursales(),
    listarModelos(),
    listarEtapas(),
    listarEtiquetas(),
    leadPedido ? detalleLead(leadPedido) : Promise.resolve(null),
  ]);

  let seleccionado = detallePedido;
  if (!leadPedido) {
    const primero = leads.find((l) => (filtroLeido === 'no' ? !l.leido : l.leido))?.id;
    if (primero) seleccionado = await detalleLead(primero);
  }

  return { modo, leads, filtroLeido, seleccionado, usuarios, sucursales, modelos, etapas, etiquetas, yo, misSucursales: sesion.misSucursales };
}
