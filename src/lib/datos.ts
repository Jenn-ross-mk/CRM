import 'server-only';
import { crearClienteServidor } from './supabase/server';
import { TRAMOS_SEGUIMIENTO, ordenEtapa, ordenFinal } from './constantes';
import { diasDesde } from './fechas';
import type { Alerta, EtapaPipeline, Etiqueta, Horario, LeadBandeja, Mensaje, Nota, Sucursal, Turno, Usuario, Venta } from './tipos';

export interface DetalleLead {
  lead: LeadBandeja;
  mensajes: Mensaje[];
  notas: Nota[];
  alertas: Alerta[];
  turnos: Turno[];
  etiquetas: Etiqueta[];
  venta: Venta | null;
}

export async function listarUsuarios(): Promise<Usuario[]> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from('usuarios').select('*').order('nombre');
  return (data ?? []) as Usuario[];
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

export async function listarEtapas(): Promise<EtapaPipeline[]> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from('etapas_pipeline').select('*').order('sector').order('orden');
  return (data ?? []) as EtapaPipeline[];
}

export async function listarEtiquetas(): Promise<Etiqueta[]> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from('etiquetas').select('*').order('nombre');
  return (data ?? []) as Etiqueta[];
}

/** Leads visibles para el usuario (RLS), con filtros opcionales. */
export async function listarBandeja(filtros: { vendedorId?: number | null; sinAsignar?: boolean; q?: string }): Promise<LeadBandeja[]> {
  const supabase = await crearClienteServidor();
  let query = supabase.from('bandeja').select('*').order('ultimo_mensaje_en', { ascending: false }).limit(500);
  if (filtros.sinAsignar) query = query.is('vendedor_id', null);
  else if (filtros.vendedorId) query = query.eq('vendedor_id', filtros.vendedorId);
  if (filtros.q) {
    const q = filtros.q.replace(/[%,()]/g, ' ').trim();
    if (q) query = query.or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%,canal_id.ilike.%${q}%`);
  }
  const { data } = await query;
  return (data ?? []) as LeadBandeja[];
}

export async function detalleLead(id: number): Promise<DetalleLead | null> {
  const supabase = await crearClienteServidor();
  const { data: lead } = await supabase.from('bandeja').select('*').eq('id', id).maybeSingle<LeadBandeja>();
  if (!lead) return null;
  const [mensajes, notas, alertas, turnos, etiquetas, venta] = await Promise.all([
    supabase.from('mensajes').select('*').eq('lead_id', id).order('creado_en').order('id'),
    supabase.from('notas').select('*').eq('lead_id', id).order('creado_en'),
    supabase.from('alertas').select('*').eq('lead_id', id).order('fecha_hora'),
    supabase.from('turnos').select('*').eq('lead_id', id).in('estado', ['pendiente', 'aprobado']).order('fecha_hora'),
    supabase.from('lead_etiquetas').select('etiquetas(*)').eq('lead_id', id).order('creado_en'),
    supabase.from('ventas').select('*').eq('lead_id', id).limit(1).maybeSingle(),
  ]);
  return {
    lead,
    mensajes: (mensajes.data ?? []) as Mensaje[],
    notas: (notas.data ?? []) as Nota[],
    alertas: (alertas.data ?? []) as Alerta[],
    turnos: (turnos.data ?? []) as Turno[],
    etiquetas: ((etiquetas.data ?? []) as unknown as { etiquetas: Etiqueta | null }[]).map((f) => f.etiquetas).filter((e): e is Etiqueta => !!e),
    venta: (venta.data ?? null) as Venta | null,
  };
}

export async function listarAlertasPropias(usuarioId: number): Promise<Alerta[]> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from('alertas').select('*').eq('usuario_id', usuarioId).order('fecha_hora');
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

/** Turnos de test drive desde una fecha (instante ISO). */
export async function listarTurnos(filtros: { desde?: string } = {}): Promise<Turno[]> {
  const supabase = await crearClienteServidor();
  let query = supabase.from('turnos').select('*').eq('tipo', 'test_drive').order('fecha_hora');
  if (filtros.desde) query = query.gte('fecha_hora', filtros.desde);
  const { data } = await query;
  return (data ?? []) as Turno[];
}

/** Horarios de los vendedores desde una fecha 'YYYY-MM-DD'. */
export async function listarHorarios(desde: string): Promise<Horario[]> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from('horarios_vendedor').select('*').gte('fecha', desde).order('fecha').order('hora_desde');
  return (data ?? []) as Horario[];
}

/** Rango [desde, hasta) de un mes 'YYYY-MM'. */
export function rangoMes(clave: string): { desde: string; hasta: string } {
  const [y, m] = clave.split('-').map(Number);
  const sig = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  return { desde: `${clave}-01`, hasta: `${sig}-01` };
}

export interface PendienteSeguimiento {
  lead: Pick<LeadBandeja, 'id' | 'nombre' | 'vendedor_id' | 'sector' | 'ultimo_mensaje_en'>;
  tramo: number;
  dias: number;
}

/** Agrupa los leads asignados sin contacto (1 semana a 18 meses), excluyendo los ya ganados/adjudicados. */
export async function calcularSeguimiento(filtros: { vendedorId?: number; sucursales?: number[] | null }) {
  const supabase = await crearClienteServidor();
  const limite = new Date(Date.now() - 7 * 86400000).toISOString();
  let query = supabase.from('bandeja').select('id, nombre, vendedor_id, sector, etapa_id, ultimo_mensaje_en, sucursal_id')
    .not('vendedor_id', 'is', null).lt('ultimo_mensaje_en', limite).not('estado', 'in', '(no_contactar,cerrado)').order('ultimo_mensaje_en');
  if (filtros.vendedorId) query = query.eq('vendedor_id', filtros.vendedorId);
  if (filtros.sucursales) query = query.in('sucursal_id', filtros.sucursales);
  const [{ data }, etapas] = await Promise.all([query, listarEtapas()]);

  const conteos = TRAMOS_SEGUIMIENTO.map(() => 0);
  const pendientes: PendienteSeguimiento[] = [];
  for (const lead of (data ?? []) as (PendienteSeguimiento['lead'] & { etapa_id: number | null })[]) {
    const final = ordenFinal(etapas, lead.sector);
    if (final && ordenEtapa(etapas, lead.etapa_id) >= final) continue;
    const dias = diasDesde(lead.ultimo_mensaje_en);
    let tramo = -1;
    TRAMOS_SEGUIMIENTO.forEach((t, i) => { if (dias >= t.dias) tramo = i; });
    if (tramo < 0) continue;
    conteos[tramo]++;
    pendientes.push({ lead, tramo, dias });
  }
  pendientes.sort((a, b) => b.dias - a.dias);
  return { conteos, pendientes };
}
