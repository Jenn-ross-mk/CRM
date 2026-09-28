import 'server-only';
import { crearClienteServidor } from './supabase/server';
import { TRAMOS_SEGUIMIENTO, ordenEtapa, ordenFinal } from './constantes';
import { diasDesde, instanteLocal, msHaceDias } from './fechas';
import { COLUMNAS_LEAD_PANEL, type Agenda, type LeadPanel } from './panel';
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
  // Los chats cerrados no se listan: se ven en el Panel general.
  let query = supabase.from('bandeja').select('*').neq('estado', 'cerrado').order('ultimo_mensaje_en', { ascending: false }).limit(500);
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
  // Todo en paralelo: si el lead no es visible (RLS), las demás consultas vuelven vacías.
  const [{ data: lead }, mensajes, notas, alertas, turnos, etiquetas, venta] = await Promise.all([
    supabase.from('bandeja').select('*').eq('id', id).maybeSingle<LeadBandeja>(),
    supabase.from('mensajes').select('*').eq('lead_id', id).order('creado_en').order('id'),
    supabase.from('notas').select('*').eq('lead_id', id).order('creado_en'),
    supabase.from('alertas').select('*').eq('lead_id', id).order('fecha_hora'),
    supabase.from('turnos').select('*').eq('lead_id', id).in('estado', ['pendiente', 'aprobado']).order('fecha_hora'),
    supabase.from('lead_etiquetas').select('etiquetas(*)').eq('lead_id', id).order('creado_en'),
    supabase.from('ventas').select('*').eq('lead_id', id).limit(1).maybeSingle(),
  ]);
  if (!lead) return null;
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

// ---------- Panel general ----------

export interface DatosPanel {
  leads: LeadPanel[];
  agendas: Agenda[];
  ventas: Venta[];
  etapas: EtapaPipeline[];
}

/**
 * Leads del Panel general. Lo que ve cada uno lo define RLS (admin: todo; supervisor: sus sucursales; vendedor: lo suyo).
 * El período filtra los leads abiertos por fecha de ingreso, los cerrados por fecha de cierre y las ventas por fecha de venta.
 */
export async function cargarPanel(filtros: {
  rango: { desde: string; hasta: string } | null;
  vendedorId: number | null;
  /** Para las ventas, que todos pueden leer: null = todas (admin). */
  sucursales: number[] | null;
  yoId: number;
  soloPropias: boolean;
}): Promise<DatosPanel> {
  const supabase = await crearClienteServidor();
  const desde = filtros.rango && instanteLocal(filtros.rango.desde, '00:00');
  const hasta = filtros.rango && instanteLocal(filtros.rango.hasta, '00:00');

  let abiertos = supabase.from('bandeja').select(COLUMNAS_LEAD_PANEL).neq('estado', 'cerrado').order('ultimo_mensaje_en', { ascending: false }).limit(2000);
  let cerrados = supabase.from('bandeja').select(COLUMNAS_LEAD_PANEL).eq('estado', 'cerrado').order('cerrado_en', { ascending: false }).limit(1000);
  let ventas = supabase.from('ventas').select('*').order('fecha', { ascending: false }).order('id', { ascending: false }).limit(1000);
  if (desde && hasta) {
    abiertos = abiertos.gte('creado_en', desde).lt('creado_en', hasta);
    cerrados = cerrados.gte('cerrado_en', desde).lt('cerrado_en', hasta);
    ventas = ventas.gte('fecha', filtros.rango!.desde).lt('fecha', filtros.rango!.hasta);
  }
  if (filtros.vendedorId) {
    abiertos = abiertos.eq('vendedor_id', filtros.vendedorId);
    cerrados = cerrados.eq('vendedor_id', filtros.vendedorId);
    ventas = ventas.eq('vendedor_id', filtros.vendedorId);
  } else if (filtros.soloPropias) {
    ventas = ventas.eq('vendedor_id', filtros.yoId);
  } else if (filtros.sucursales) {
    ventas = ventas.or(`vendedor_id.eq.${filtros.yoId},sucursal_id.in.(${filtros.sucursales.join(',') || 0})`);
  }
  // Agendas vigentes de los últimos 6 meses en adelante (las más viejas ya cuentan como "sin respuesta").
  const agendas = supabase.from('turnos').select('id, tipo, lead_id, fecha_hora, estado, vehiculo, vendedor_id')
    .not('lead_id', 'is', null).in('estado', ['pendiente', 'aprobado']).gte('fecha_hora', new Date(msHaceDias(180)).toISOString()).order('fecha_hora');

  const [a, c, v, t, etapas] = await Promise.all([abiertos, cerrados, ventas, agendas, listarEtapas()]);
  return {
    leads: [...((a.data ?? []) as unknown as LeadPanel[]), ...((c.data ?? []) as unknown as LeadPanel[])],
    agendas: (t.data ?? []) as Agenda[],
    ventas: (v.data ?? []) as Venta[],
    etapas,
  };
}
