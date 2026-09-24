import 'server-only';
import { detalleLead, listarBandeja, listarModelos, listarPerfiles, listarSucursales } from '@/lib/datos';
import type { Perfil } from '@/lib/tipos';
import type { PropsBandeja } from './bandeja';

export type ParamsBandeja = { f?: string; lead?: string; q?: string; v?: string };

/** Carga todo lo que necesita la bandeja según el rol y los parámetros de la URL. */
export async function cargarBandeja(modo: 'vendedor' | 'gestion', yo: Perfil, params: ParamsBandeja): Promise<PropsBandeja> {
  const filtroLeido = params.f === 'si' ? 'si' : 'no';
  const [leads, perfiles, sucursales, modelos] = await Promise.all([
    listarBandeja({
      vendedorId: modo === 'vendedor' ? yo.id : params.v && params.v !== '__sin__' ? params.v : null,
      sinAsignar: modo === 'gestion' && params.v === '__sin__',
      q: params.q,
    }),
    listarPerfiles(),
    listarSucursales(),
    listarModelos(),
  ]);

  let leadId = Number(params.lead) || null;
  if (!leadId) leadId = leads.find((l) => (filtroLeido === 'no' ? !l.leido : l.leido))?.id ?? null;
  const seleccionado = leadId ? await detalleLead(leadId) : null;

  return { modo, leads, filtroLeido, seleccionado, perfiles, sucursales, modelos, yo };
}
