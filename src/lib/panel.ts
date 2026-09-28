// Panel general: reglas para ubicar cada lead en un bloque (en seguimiento, pendientes, cerrados, vendidos)
// y rangos de fecha del filtro día / semana / mes. Funciones puras: no consultan la base.
import { DIAS, MESES, diaSemana, fechaLocal } from './fechas';
import type { LeadBandeja, Turno } from './tipos';

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
  | { bloque: 'pendiente'; motivo: 'agenda_vencida'; agenda: Agenda }
  | { bloque: 'pendiente'; motivo: 'sin_respuesta' | 'sin_contacto'; dias: number }
  | { bloque: 'cerrado' }
  | { bloque: 'vendido' };

/**
 * Ubica un lead en su bloque. `agendas` son sus turnos vigentes (pendientes o aprobados) ordenados por fecha.
 *  1. Cerrado: el lead está en estado 'cerrado'.
 *  2. Vendido: llegó a la última etapa (Ganado / Adjudicado) o tiene una venta registrada.
 *  3. Pendiente (agenda vencida): tiene algo agendado para hoy o antes y no se le escribió desde ese día.
 *  4. En seguimiento · agendado: tiene una llamada, test drive o visita agendada para después de hoy.
 *  5. Pendiente (sin respuesta): el cliente no escribe hace 7 días o más.
 *  6. En seguimiento · activo: todo lo demás (leads nuevos y conversaciones en curso).
 */
export function clasificarLead(lead: LeadPanel, agendas: Agenda[], vendido: boolean, ahora: Date = new Date()): Clasificacion {
  if (lead.estado === 'cerrado') return { bloque: 'cerrado' };
  if (vendido) return { bloque: 'vendido' };

  const hoy = fechaLocal(ahora);
  const escritoDesde = (dia: string) => !!lead.ultimo_saliente_en && fechaLocal(lead.ultimo_saliente_en) >= dia;
  const vencida = agendas.find((a) => fechaLocal(a.fecha_hora) <= hoy && !escritoDesde(fechaLocal(a.fecha_hora)));
  if (vencida) return { bloque: 'pendiente', motivo: 'agenda_vencida', agenda: vencida };

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
