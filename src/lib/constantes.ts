import type { Canal, EstadoLead, EstadoTurno, EtapaPipeline, MotivoCierre, MotivoReagenda, Sector, TipoTurno } from './tipos';

// Los valores guardados en la base van en minúscula y snake_case; estas tablas dan el texto que se muestra.
export const ETIQUETA_SECTOR: Record<Sector, string> = {
  convencional: 'Convencional',
  plan_ahorro: 'Plan de ahorro',
  usados: 'Usados',
  postventa: 'Postventa',
  repuestos: 'Repuestos',
};
/** Sectores en los que trabajan los vendedores (asignación, ranking y ventas). */
export const SECTORES_VENTA: Sector[] = ['convencional', 'plan_ahorro', 'usados'];
export const etiquetaSector = (s: Sector | null | undefined) => (s ? ETIQUETA_SECTOR[s] ?? s : 'Sin sector');

export const ETIQUETA_CANAL: Record<Canal, string> = {
  whatsapp: 'WhatsApp',
  messenger: 'Messenger',
  instagram: 'Instagram',
  web: 'Web',
  marketplace: 'Marketplace',
  telefono: 'Teléfono',
  presencial: 'Presencial',
};
/** Canales que se pueden elegir al cargar un lead a mano. */
export const CANALES_MANUALES: Canal[] = ['telefono', 'presencial', 'whatsapp', 'instagram', 'messenger', 'web', 'marketplace'];

export const ETIQUETA_ESTADO_LEAD: Record<EstadoLead, string> = {
  en_conversacion: 'Hablando con el bot',
  en_cola: 'En cola (fuera de horario)',
  asignacion_manual: 'Asignación manual',
  derivado: 'Derivado',
  perdido: 'Perdido',
  recuperar: 'Para recuperar',
  no_contactar: 'No contactar',
  cerrado: 'Cerrado',
};

export const FORMAS_PAGO: { valor: string; etiqueta: string }[] = [
  { valor: 'contado', etiqueta: 'Contado' },
  { valor: 'financiacion', etiqueta: 'Financiación' },
  { valor: 'plan_ahorro', etiqueta: 'Plan de ahorro' },
];
export const etiquetaFormaPago = (v: string | null) => (v ? FORMAS_PAGO.find((f) => f.valor === v)?.etiqueta ?? v : 'A definir');

/** Motivos para cerrar un lead. "Otros" (con texto obligatorio) solo lo ve el administrador. */
export const MOTIVOS_CIERRE: { valor: MotivoCierre; etiqueta: string; soloAdmin?: boolean }[] = [
  { valor: 'falta_dinero', etiqueta: 'Falta de dinero' },
  { valor: 'credito_rechazado', etiqueta: 'Crédito rechazado' },
  { valor: 'usado_no_admitido', etiqueta: 'Usado no admitido' },
  { valor: 'compro_competencia', etiqueta: 'Compró en competencia' },
  { valor: 'otros', etiqueta: 'Otros', soloAdmin: true },
];
export const etiquetaMotivoCierre = (m: MotivoCierre | null) => (m ? MOTIVOS_CIERRE.find((x) => x.valor === m)?.etiqueta ?? m : 'Sin motivo');

/** Motivos para reagendar (obligatorio). Si no se reagenda, el agendamiento vencido pasa a Pendientes. */
export const MOTIVOS_REAGENDA: { valor: MotivoReagenda; etiqueta: string }[] = [
  { valor: 'venta_usado', etiqueta: 'Venta de su usado' },
  { valor: 'falta_dinero_entrega', etiqueta: 'Falta de dinero para la entrega' },
  { valor: 'financiacion_no_conveniente', etiqueta: 'Financiación no conveniente' },
  { valor: 'analisis_operacion', etiqueta: 'Análisis de la operación' },
  { valor: 'cambio_anio', etiqueta: 'Cambio de año' },
  { valor: 'siniestro', etiqueta: 'Siniestro' },
];
export const etiquetaMotivoReagenda = (m: MotivoReagenda) => MOTIVOS_REAGENDA.find((x) => x.valor === m)?.etiqueta ?? m;

export const TIPOS_VEHICULO = [
  { valor: '0km', etiqueta: '0 km' },
  { valor: 'usado', etiqueta: 'Usado' },
  { valor: 'promocion', etiqueta: 'Promoción' },
];
export const USOS = [
  { valor: 'familiar', etiqueta: 'Familiar' },
  { valor: 'laboral', etiqueta: 'Laboral' },
  { valor: 'comercial', etiqueta: 'Comercial' },
];
export const TEMPERATURAS = [
  { valor: 'frio', etiqueta: 'Frío' },
  { valor: 'tibio', etiqueta: 'Tibio' },
  { valor: 'caliente', etiqueta: 'Caliente' },
];
export const etiquetaDe = (lista: { valor: string; etiqueta: string }[], v: string | null) => (v ? lista.find((x) => x.valor === v)?.etiqueta ?? v : '—');

export const ETIQUETA_TIPO_TURNO: Record<TipoTurno, string> = {
  test_drive: 'Test drive',
  llamada: 'Llamada',
  visita: 'Visita',
};

export const ESTADO_TURNO_REALIZADO: EstadoTurno = 'hecho';

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

// ---------- Etapas del pipeline (vienen de la tabla etapas_pipeline) ----------

/** Etapas de un sector ordenadas por `orden` (1 = Nuevo). */
export const etapasDe = (etapas: EtapaPipeline[], sector: Sector | null) =>
  etapas.filter((e) => e.sector === sector).sort((a, b) => a.orden - b.orden);

/** Sectores que tienen pipeline cargado. */
export const sectoresConPipeline = (etapas: EtapaPipeline[]) =>
  SECTORES_VENTA.filter((s) => etapas.some((e) => e.sector === s));

/** Orden de la etapa de un lead. Un lead sin etapa cuenta como "Nuevo" (orden 1). */
export const ordenEtapa = (etapas: EtapaPipeline[], etapaId: number | null) =>
  etapas.find((e) => e.id === etapaId)?.orden ?? 1;

/** Orden de la última etapa (Ganado / Adjudicado) de un sector. */
export const ordenFinal = (etapas: EtapaPipeline[], sector: Sector | null) =>
  Math.max(0, ...etapasDe(etapas, sector).map((e) => e.orden));
