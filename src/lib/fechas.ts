// Todas las fechas se muestran en hora de Argentina (UTC-3, sin horario de verano).
export const TZ = 'America/Argentina/Buenos_Aires';
const OFFSET = '-03:00';

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** Fecha 'YYYY-MM-DD' en Argentina para un instante dado. */
export function fechaLocal(d: Date | string = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d));
}

export function horaLocal(d: Date | string): string {
  return new Intl.DateTimeFormat('es-AR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(d));
}

/** Construye un instante ISO a partir de fecha local 'YYYY-MM-DD' y hora 'HH:MM'. */
export function instanteLocal(fecha: string, hora: string): string {
  return new Date(`${fecha}T${hora}:00${OFFSET}`).toISOString();
}

/** Diferencia en días calendario (hoy - fecha) en hora local. */
export function diasDesde(d: Date | string, ahora: Date = new Date()): number {
  const a = Date.parse(fechaLocal(ahora));
  const b = Date.parse(fechaLocal(d));
  return Math.round((a - b) / 86400000);
}

/** Hora corta estilo bandeja: "09:41", "ayer", "lun", "12/08". */
export function horaBandeja(d: string, ahora: Date = new Date()): string {
  const dias = diasDesde(d, ahora);
  if (dias <= 0) return horaLocal(d);
  if (dias === 1) return 'ayer';
  if (dias < 7) return DIAS_CORTOS[diaSemana(fechaLocal(d))];
  return fechaCorta(d);
}

export function fechaCorta(d: string): string {
  const [, m, dd] = fechaLocal(d).split('-');
  return `${dd}/${m}`;
}

/** 'YYYY-MM-DD' -> 'DD/MM/YYYY' */
export function fechaLarga(ymd: string): string {
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

/** Día de la semana (0=domingo) de una fecha 'YYYY-MM-DD'. */
export function diaSemana(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** "viernes 4" */
export function tituloDia(ymd: string): string {
  return `${DIAS[diaSemana(ymd)]} ${Number(ymd.split('-')[2])}`;
}

/** "4 de septiembre, 2026" */
export function fechaTexto(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return `${d} de ${MESES[m - 1]}, ${y}`;
}

/** "Vie 4/9" */
export function fechaTurno(ymd: string): string {
  const [, m, d] = ymd.split('-').map(Number);
  const dia = DIAS_CORTOS[diaSemana(ymd)];
  return `${dia[0].toUpperCase()}${dia.slice(1)} ${d}/${m}`;
}

/** "YYYY-MM" del mes actual en Argentina, con desplazamiento opcional. */
export function mesClave(offset = 0, base: Date = new Date()): string {
  const [y, m] = fechaLocal(base).split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offset, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function nombreMes(clave: string, conAnio = true): string {
  const [y, m] = clave.split('-').map(Number);
  const nombre = MESES[m - 1];
  return conAnio ? `${nombre[0].toUpperCase()}${nombre.slice(1)} ${y}` : nombre;
}

/** Hora 'HH:MM:SS' -> 'HH:MM' */
export const horaCorta = (h: string) => h.slice(0, 5);

/** Fecha local 'YYYY-MM-DD' de hace `n` días. */
export function fechaHaceDias(n: number): string {
  return fechaLocal(new Date(Date.now() - n * 86400000));
}

/** Timestamp (ms) de hace `n` días. */
export const msHaceDias = (n: number) => Date.now() - n * 86400000;
