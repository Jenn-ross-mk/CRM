import 'server-only';
import { crearClienteServidor } from './supabase/server';
import { TRAMOS_SEGUIMIENTO, ETAPA_FINAL } from './constantes';
import { diasDesde } from './fechas';
import type { Alerta, Lead, Mensaje, Nota, Perfil, Sucursal, TestDrive, Venta } from './tipos';

export type LeadBandeja = Lead & { ultimo_texto: string | null; ultima_direccion: 'in' | 'out' | null };

export interface DetalleLead {
  lead: Lead;
  mensajes: Mensaje[];
  notas: Nota[];
  alertas: Alerta[];
  testDrives: TestDrive[];
  venta: Venta | null;
}

export async function listarPerfiles(): Promise<Perfil[]> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from('perfiles').select('*').order('nombre');
  return (data ?? []) as Perfil[];
}

export async function listarSucursales(): Promise<Sucursal[]> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from('sucursales').select('*').order('nombre');
  return (data ?? []) as Sucursal[];
}

export async function listarModelos(): Promise<string[]> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from('modelos').select('nombre').eq('activo', true).order('nombre');
  return (data ?? []).map((m) => m.nombre as string);
}

/** Leads visibles para el usuario (RLS), con filtros opcionales. */
export async function listarBandeja(filtros: { vendedorId?: string | null; sinAsignar?: boolean; q?: string }): Promise<LeadBandeja[]> {
  const supabase = await crearClienteServidor();
  let query = supabase.from('bandeja').select('*').order('ultimo_mensaje_at', { ascending: false }).limit(500);
  if (filtros.sinAsignar) query = query.is('vendedor_id', null);
  else if (filtros.vendedorId) query = query.eq('vendedor_id', filtros.vendedorId);
  if (filtros.q) {
    const q = filtros.q.replace(/[%,()]/g, ' ').trim();
    if (q) query = query.or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%`);
  }
  const { data } = await query;
  return (data ?? []) as LeadBandeja[];
}

export async function detalleLead(id: number): Promise<DetalleLead | null> {
  const supabase = await crearClienteServidor();
  const { data: lead } = await supabase.from('leads').select('*').eq('id', id).maybeSingle<Lead>();
  if (!lead) return null;
  const [mensajes, notas, alertas, testDrives, venta] = await Promise.all([
    supabase.from('mensajes').select('*').eq('lead_id', id).order('created_at').order('id'),
    supabase.from('notas').select('*').eq('lead_id', id).order('created_at'),
    supabase.from('alertas').select('*').eq('lead_id', id).order('fecha'),
    supabase.from('test_drives').select('*').eq('lead_id', id).in('estado', ['pendiente', 'aprobado']).order('fecha'),
    supabase.from('ventas').select('*').eq('lead_id', id).maybeSingle(),
  ]);
  return {
    lead,
    mensajes: (mensajes.data ?? []) as Mensaje[],
    notas: (notas.data ?? []) as Nota[],
    alertas: (alertas.data ?? []) as Alerta[],
    testDrives: (testDrives.data ?? []) as TestDrive[],
    venta: (venta.data ?? null) as Venta | null,
  };
}

export async function listarAlertasPropias(ownerId: string): Promise<Alerta[]> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from('alertas').select('*').eq('owner_id', ownerId).order('fecha');
  return (data ?? []) as Alerta[];
}

export async function listarVentas(filtros: { desde?: string; hasta?: string } = {}): Promise<Venta[]> {
  const supabase = await crearClienteServidor();
  let query = supabase.from('ventas').select('*').order('fecha', { ascending: false }).order('id', { ascending: false });
  if (filtros.desde) query = query.gte('fecha', filtros.desde);
  if (filtros.hasta) query = query.lt('fecha', filtros.hasta);
  const { data } = await query;
  return (data ?? []) as Venta[];
}

export async function listarTestDrives(filtros: { desde?: string; hasta?: string } = {}): Promise<TestDrive[]> {
  const supabase = await crearClienteServidor();
  let query = supabase.from('test_drives').select('*').order('fecha').order('hora');
  if (filtros.desde) query = query.gte('fecha', filtros.desde);
  if (filtros.hasta) query = query.lt('fecha', filtros.hasta);
  const { data } = await query;
  return (data ?? []) as TestDrive[];
}

/** Rango [desde, hasta) de un mes 'YYYY-MM'. */
export function rangoMes(clave: string): { desde: string; hasta: string } {
  const [y, m] = clave.split('-').map(Number);
  const sig = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  return { desde: `${clave}-01`, hasta: `${sig}-01` };
}

export interface PendienteSeguimiento {
  lead: Pick<Lead, 'id' | 'nombre' | 'vendedor_id' | 'sector' | 'ultimo_mensaje_at'>;
  tramo: number;
  dias: number;
}

/** Agrupa los leads sin contacto (1 semana a 18 meses), excluyendo los ya ganados/adjudicados. */
export async function calcularSeguimiento(filtros: { vendedorId?: string; sucursalId?: number | null }) {
  const supabase = await crearClienteServidor();
  const limite = new Date(Date.now() - 7 * 86400000).toISOString();
  let query = supabase.from('leads').select('id, nombre, vendedor_id, sector, ultimo_mensaje_at, sucursal_id')
    .lt('ultimo_mensaje_at', limite).lt('etapa', ETAPA_FINAL).order('ultimo_mensaje_at');
  if (filtros.vendedorId) query = query.eq('vendedor_id', filtros.vendedorId);
  if (filtros.sucursalId) query = query.eq('sucursal_id', filtros.sucursalId);
  const { data } = await query;

  const conteos = TRAMOS_SEGUIMIENTO.map(() => 0);
  const pendientes: PendienteSeguimiento[] = [];
  for (const lead of data ?? []) {
    const dias = diasDesde(lead.ultimo_mensaje_at);
    let tramo = -1;
    TRAMOS_SEGUIMIENTO.forEach((t, i) => { if (dias >= t.dias) tramo = i; });
    if (tramo < 0) continue;
    conteos[tramo]++;
    pendientes.push({ lead, tramo, dias });
  }
  pendientes.sort((a, b) => b.dias - a.dias);
  return { conteos, pendientes };
}
