// Panel general: reglas para ubicar cada lead en un bloque (en seguimiento, pendientes, cerrados, vendidos)
// y rangos de fecha del filtro día / semana / mes. Funciones puras: no consultan la base.
import { ordenEtapa, ordenFinal } from './constantes';
import { DIAS, MESES, diaSemana, fechaLocal } from './fechas';
import type { EtapaPipeline, LeadBandeja, Turno } from './tipos';

export type Periodo = 'dia' | 'semana' | 'mes' | 'todo';
export const PERIODOS: { valor: Periodo; etiqueta: string }[] = [
  { valor: 'dia', etiqueta: 'Día' },
  { valor: 'semana', etiqueta: 'Semana' },
  { valor: 'mes', etiqueta: 'Mes' },
  { valor: 'todo', etiqueta: 'Todo' },
];

/** Días sin respuesta del cliente a partir de los cuales el lead pasa a Pendientes. */
export const DIAS_SIN_RESPUESTA = 7;

export type LeadPanel = Pick<LeadBandeja,
  'id' | 'nombre' | 'telefono' | 'canal' | 'vendedor_id' | 'sucursal_id' | 'sector' | 'estado' | 'etapa_id' | 'vehiculo_interes' |
  'forma_pago' | 'prioridad' | 'creado_en' | 'ultimo_mensaje_en' | 'ultima_interaccion' | 'ultimo_saliente_en' | 'ultimo_texto' |
  'motivo_cierre' | 'detalle_cierre' | 'cerrado_en' | 'cerrado_por'>;

export const COLUMNAS_LEAD_PANEL =
  'id, nombre, telefono, canal, vendedor_id, sucursal_id, sector, estado, etapa_id, vehiculo_interes, forma_pago, prioridad, ' +
  'creado_en, ultimo_mensaje_en, ultima_interaccion, ultimo_saliente_en, ultimo_texto, motivo_cierre, detalle_cierre, cerrado_en, cerrado_por';

export type Agenda = Pick<Turno, 'id' | 'tipo' | 'lead_id' | 'fecha_hora' | 'estado' | 'vehiculo' | 'vendedor_id'>;

export type Clasificacion =
  | { bloque: 'seguimiento'; etiqueta: 'activo' }
  | { bloque: 'seguimiento'; etiqueta: 'agendado'; agenda: Agenda }
  | { bloque: 'pendiente'; motivo: 'sin_reagendar'; agenda: Agenda }
  | { bloque: 'pendiente'; motivo: 'agenda_vencida'; agenda: Agenda }
  | { bloque: 'pendiente'; motivo: 'sin_respuesta' | 'sin_contacto'; dias: number }
  | { bloque: 'cerrado' }
  | { bloque: 'vendido' };

/**
 * Ubica un lead en su bloque. `agendas` son sus turnos vigentes (pendientes o aprobados) ordenados por fecha.
 *  1. Cerrado: el lead está en estado 'cerrado'.
 *  2. Vendido: llegó a la última etapa (Ganado / Adjudicado) o tiene una venta registrada.
 *  3. Pendiente (sin reagendar): tenía algo agendado para un día que ya pasó y no se marcó realizado ni se reagendó.
 *     Pendiente (agenda vencida): tiene algo agendado para hoy y todavía no se le escribió.
 *  4. En seguimiento · agendado: tiene una llamada, test drive o visita agendada para después de hoy.
 *  5. Pendiente (sin respuesta): el cliente no escribe hace 7 días o más.
 *  6. En seguimiento · activo: todo lo demás (leads nuevos y conversaciones en curso).
 */
export function clasificarLead(lead: LeadPanel, agendas: Agenda[], vendido: boolean, ahora: Date = new Date()): Clasificacion {
  if (lead.estado === 'cerrado') return { bloque: 'cerrado' };
  if (vendido) return { bloque: 'vendido' };

  const hoy = fechaLocal(ahora);
  const escritoDesde = (dia: string) => !!lead.ultimo_saliente_en && fechaLocal(lead.ultimo_saliente_en) >= dia;
  const pasada = agendas.find((a) => fechaLocal(a.fecha_hora) < hoy);
  if (pasada) return { bloque: 'pendiente', motivo: 'sin_reagendar', agenda: pasada };
  const deHoy = agendas.find((a) => fechaLocal(a.fecha_hora) === hoy && !escritoDesde(hoy));
  if (deHoy) return { bloque: 'pendiente', motivo: 'agenda_vencida', agenda: deHoy };

  const futura = agendas.find((a) => fechaLocal(a.fecha_hora) > hoy);
  if (futura) return { bloque: 'seguimiento', etiqueta: 'agendado', agenda: futura };

  const ultimoDelCliente = lead.ultima_interaccion ?? lead.creado_en;
  const dias = Math.floor((ahora.getTime() - Date.parse(ultimoDelCliente)) / 86400000);
  if (dias >= DIAS_SIN_RESPUESTA) {
    const leEscribimos = !!lead.ultimo_saliente_en && Date.parse(lead.ultimo_saliente_en) > Date.parse(ultimoDelCliente);
    return { bloque: 'pendiente', motivo: leEscribimos ? 'sin_respuesta' : 'sin_contacto', dias };
  }
  return { bloque: 'seguimiento', etiqueta: 'activo' };
}

export interface LeadClasificado {
  lead: LeadPanel;
  agendas: Agenda[];
  clasificacion: Clasificacion;
}

/** Agendamientos que cuentan: el test drive aprobado; la llamada o visita mientras no se hizo ni se canceló. */
export const agendaVigente = (t: Pick<Turno, 'tipo' | 'estado'>) => (t.tipo === 'test_drive' ? t.estado === 'aprobado' : t.estado === 'pendiente');

/** Clasifica una lista de leads con sus agendamientos vigentes y las ventas conocidas. */
export function clasificarLeads(leads: LeadPanel[], agendas: Agenda[], ventas: { lead_id: number | null }[], etapas: EtapaPipeline[], ahora: Date = new Date()): LeadClasificado[] {
  const porLead = new Map<number, Agenda[]>();
  for (const a of agendas) if (a.lead_id) porLead.set(a.lead_id, [...(porLead.get(a.lead_id) ?? []), a]);
  const conVenta = new Set(ventas.map((v) => v.lead_id));
  return leads.map((lead) => {
    const propias = (porLead.get(lead.id) ?? []).sort((x, y) => x.fecha_hora.localeCompare(y.fecha_hora));
    const final = ordenFinal(etapas, lead.sector);
    const vendido = conVenta.has(lead.id) || (final > 0 && ordenEtapa(etapas, lead.etapa_id) >= final);
    return { lead, agendas: propias, clasificacion: clasificarLead(lead, propias, vendido, ahora) };
  });
}

/** Nombre del bloque del Panel general y la etiqueta corta de por qué está ahí. */
export function ubicacion(c: Clasificacion): { bloque: string; etiqueta: string } {
  switch (c.bloque) {
    case 'seguimiento': return { bloque: 'En seguimiento', etiqueta: c.etiqueta === 'agendado' ? 'Agendado' : 'Activo' };
    case 'pendiente': return {
      bloque: 'Pendiente',
      etiqueta: c.motivo === 'sin_reagendar' ? 'Sin reagendar' : c.motivo === 'agenda_vencida' ? 'Agenda de hoy' : c.motivo === 'sin_respuesta' ? 'Sin respuesta' : 'Sin contacto',
    };
    case 'cerrado': return { bloque: 'Cerrado', etiqueta: 'Cerrado' };
    default: return { bloque: 'Vendido', etiqueta: 'Vendido' };
  }
}

// ---------- Filtro por período ----------

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const utc = (fecha: string) => { const [y, m, d] = fecha.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const sumarDias = (fecha: string, n: number) => { const d = utc(fecha); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };
const esFecha = (v: string | undefined): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

export const periodoValido = (v: string | undefined): Periodo => (PERIODOS.some((p) => p.valor === v) ? (v as Periodo) : 'mes');
export const fechaValida = (v: string | undefined, hoy: string = fechaLocal()) => (esFecha(v) ? v : hoy);

/** Rango [desde, hasta) en fechas locales 'YYYY-MM-DD' del período que contiene `fecha`. La semana va de lunes a domingo. */
export function rangoPeriodo(periodo: Periodo, fecha: string): { desde: string; hasta: string } | null {
  if (periodo === 'todo') return null;
  if (periodo === 'dia') return { desde: fecha, hasta: sumarDias(fecha, 1) };
  if (periodo === 'semana') {
    const lunes = sumarDias(fecha, -((diaSemana(fecha) + 6) % 7));
    return { desde: lunes, hasta: sumarDias(lunes, 7) };
  }
  const [y, m] = fecha.split('-').map(Number);
  const desde = `${y}-${String(m).padStart(2, '0')}-01`;
  return { desde, hasta: m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01` };
}

/** Fecha del período anterior (-1) o siguiente (+1). */
export function moverPeriodo(periodo: Periodo, fecha: string, sentido: 1 | -1): string {
  if (periodo === 'dia') return sumarDias(fecha, sentido);
  if (periodo === 'semana') return sumarDias(fecha, 7 * sentido);
  const [y, m] = fecha.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + sentido, 1));
  return ymd(d);
}

/** "lunes 28 de septiembre", "28/9 al 4/10", "Septiembre 2026". */
export function tituloPeriodo(periodo: Periodo, fecha: string): string {
  const rango = rangoPeriodo(periodo, fecha);
  if (!rango) return 'Todos los leads';
  const [y, m, d] = fecha.split('-').map(Number);
  if (periodo === 'dia') return `${DIAS[diaSemana(fecha)]} ${d} de ${MESES[m - 1]}`;
  if (periodo === 'mes') return `${MESES[m - 1][0].toUpperCase()}${MESES[m - 1].slice(1)} ${y}`;
  const corta = (f: string) => { const [, mm, dd] = f.split('-').map(Number); return `${dd}/${mm}`; };
  return `Semana del ${corta(rango.desde)} al ${corta(sumarDias(rango.hasta, -1))}`;
}
