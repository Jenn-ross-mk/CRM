// Tipos que reflejan el esquema real de Supabase (ver supabase/migrations).

export type Rol = 'vendedor' | 'supervisor' | 'admin';
export type Sector = 'convencional' | 'plan_ahorro' | 'usados' | 'postventa' | 'repuestos';
export type Canal = 'whatsapp' | 'messenger' | 'instagram' | 'web' | 'marketplace' | 'telefono' | 'presencial';
export type EstadoUsuario = 'activo' | 'ocupado' | 'desconectado';
export type EstadoLead = 'en_conversacion' | 'en_cola' | 'asignacion_manual' | 'derivado' | 'perdido' | 'recuperar' | 'no_contactar' | 'cerrado';
export type EstadoTurno = 'pendiente' | 'aprobado' | 'rechazado' | 'realizado';
export type Prioridad = 'alta' | 'media' | 'baja';
export type AutorTipo = 'cliente' | 'bot' | 'vendedor';

export interface Sucursal {
  id: number;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  activa: boolean;
}

export interface Usuario {
  id: number;
  auth_id: string | null;
  nombre: string;
  email: string;
  telefono: string | null;
  foto_url: string | null;
  rol: Rol;
  sucursal_id: number | null;
  sector: Sector | null;
  estado: EstadoUsuario;
  activo: boolean;
}

export interface EtapaPipeline {
  id: number;
  sector: Sector;
  orden: number;
  nombre: string;
}

export interface Etiqueta {
  id: number;
  nombre: string;
  color: string | null;
}

export interface Lead {
  id: number;
  contacto_id: number;
  modo: 'bot' | 'humano';
  estado: EstadoLead;
  sucursal_id: number | null;
  sector: Sector | null;
  vendedor_id: number | null;
  nombre_cliente: string | null;
  localidad: string | null;
  clasificacion: 'frio' | 'tibio' | 'caliente' | null;
  tipo: '0km' | 'usado' | 'promocion' | null;
  vehiculo_interes: string | null;
  marca: string | null;
  modelo_anio: string | null;
  uso: string | null;
  forma_pago: string | null;
  entrega_vehiculo: boolean | null;
  entrega_capital: boolean | null;
  monto_capital: string | null;
  urgencia: string | null;
  contexto_conversacion: string | null;
  seguimiento_n: number;
  strike_precio: number;
  ultima_interaccion: string | null;
  derivado_en: string | null;
  etapa_id: number | null;
  prioridad: Prioridad;
  leido: boolean;
  ultimo_mensaje_en: string;
  etapa_actualizada_en: string;
  creado_en: string;
  actualizado_en: string;
}

/** Fila de la vista `bandeja`: el lead + su contacto + el último mensaje. */
export interface LeadBandeja extends Lead {
  nombre: string;
  canal: Canal;
  canal_id: string;
  nombre_perfil: string | null;
  telefono: string | null;
  etapa_orden: number | null;
  ultimo_texto: string | null;
  ultimo_tipo: string | null;
  ultima_direccion: 'entrante' | 'saliente' | null;
  ultimo_autor_tipo: AutorTipo | null;
}

export interface Mensaje {
  id: number;
  lead_id: number;
  direccion: 'entrante' | 'saliente';
  autor_tipo: AutorTipo;
  autor_usuario_id: number | null;
  tipo: string;
  contenido: string | null;
  media_url: string | null;
  estado_envio: string | null;
  creado_en: string;
}

export interface Nota {
  id: number;
  lead_id: number;
  usuario_id: number;
  texto: string;
  creado_en: string;
}

export interface Alerta {
  id: number;
  usuario_id: number;
  lead_id: number | null;
  fecha_hora: string;
  mensaje: string;
  leida: boolean;
}

export interface Turno {
  id: number;
  tipo: string;
  lead_id: number | null;
  cliente_nombre: string;
  cliente_telefono: string | null;
  vehiculo: string | null;
  sucursal_id: number | null;
  vendedor_id: number;
  fecha_hora: string;
  estado: EstadoTurno;
  aprobado_por: number | null;
}

export interface CampoExtra {
  k: string;
  v: string;
}

export interface Venta {
  id: number;
  lead_id: number | null;
  cliente_nombre: string;
  vehiculo: string;
  vendedor_id: number;
  sucursal_id: number | null;
  sector: Sector;
  fecha: string;
  monto: number | null;
  datos_extra: CampoExtra[] | null;
}

export interface Comunicado {
  id: number;
  categoria: string | null;
  texto: string;
  cuando: string | null;
  sucursal_id: number | null;
  activo: boolean;
}

export interface Gira {
  id: number;
  destino: string;
  fecha_hora: string;
  unidades: string | null;
}

export interface Entrega {
  id: number;
  lead_id: number | null;
  cliente_nombre: string;
  vehiculo: string;
  fecha: string;
  entregada: boolean;
}

export interface Horario {
  id: number;
  usuario_id: number;
  fecha: string;
  hora_desde: string;
  hora_hasta: string;
}

/** Resultado estándar de una Server Action. */
export type Resultado = { ok: true; mensaje?: string } | { ok: false; error: string };
