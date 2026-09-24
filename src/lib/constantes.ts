import type { Sector } from './tipos';

/** Etapas del pipeline por sector. El índice coincide con `leads.etapa` (0..5). */
export const ETAPAS: Record<Sector, string[]> = {
  Convencional: ['Nuevo', 'Contactado', 'Test drive agendado', 'Cotización', 'Negociación', 'Ganado'],
  'Plan de ahorro': ['Nuevo', 'Contactado', 'Explicación del sistema', 'Suscripción firmada', 'En espera de adjudicación', 'Adjudicado'],
};
export const ETAPA_FINAL = 5;

export const SECTORES: Sector[] = ['Convencional', 'Plan de ahorro'];
export const CANALES = ['WhatsApp', 'Instagram', 'Web', 'Marketplace', 'Teléfono', 'Presencial'] as const;
export const HORAS_TURNO = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];
export const HORAS_ALERTA = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '18:00'];

/** Tramos de seguimiento por tiempo sin contacto (días mínimos). */
export const TRAMOS_SEGUIMIENTO = [
  { label: '1 semana', dias: 7, color: '#E7ECF1', texto: '#0A0A0A' },
  { label: '1 mes', dias: 30, color: '#C7D3E0', texto: '#0A0A0A' },
  { label: '3 meses', dias: 90, color: '#9FB4CC', texto: '#0A0A0A' },
  { label: '6 meses', dias: 180, color: '#5A85B5', texto: '#fff' },
  { label: '9 meses', dias: 270, color: '#3D6797', texto: '#fff' },
  { label: '12 meses', dias: 365, color: '#00264D', texto: '#fff' },
  { label: '18 meses', dias: 540, color: '#001B33', texto: '#fff' },
];

export const COLORES_EMBUDO = ['#E7ECF1', '#C7D3E0', '#9FB4CC', '#5A85B5', '#3D6797', '#00264D'];
export const TEXTO_EMBUDO = ['#0A0A0A', '#0A0A0A', '#fff', '#fff', '#fff', '#fff'];

export const PLANTILLA_SEGUIMIENTO = (nombre: string) =>
  `Hola ${nombre.split(' ')[0]}, ¿cómo estás? Te escribo de Akar Automotores para saber si seguís interesado/a. ¡Quedo atento/a a cualquier consulta!`;
