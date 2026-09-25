import 'server-only';
import { detalleLead, listarBandeja, listarEtapas, listarEtiquetas, listarModelos, listarSucursales, listarUsuarios } from '@/lib/datos';
import type { Sesion } from '@/lib/sesion';
import type { PropsBandeja } from './bandeja';

export type ParamsBandeja = { f?: string; lead?: string; q?: string; v?: string };

/** Carga todo lo que necesita la bandeja según el rol y los parámetros de la URL. */
export async function cargarBandeja(modo: 'vendedor' | 'gestion', sesion: Sesion, params: ParamsBandeja): Promise<PropsBandeja> {
  const yo = sesion.usuario;
  const filtroLeido = params.f === 'si' ? 'si' : 'no';
  const [leads, usuarios, sucursales, modelos, etapas, etiquetas] = await Promise.all([
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
  ]);

  let leadId = Number(params.lead) || null;
  if (!leadId) leadId = leads.find((l) => (filtroLeido === 'no' ? !l.leido : l.leido))?.id ?? null;
  const seleccionado = leadId ? await detalleLead(leadId) : null;

  return { modo, leads, filtroLeido, seleccionado, usuarios, sucursales, modelos, etapas, etiquetas, yo, misSucursales: sesion.misSucursales };
}
