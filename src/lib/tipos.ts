export type Rol = 'vendedor' | 'supervisor' | 'administrador';
export type Sector = 'Convencional' | 'Plan de ahorro';
export type Canal = 'WhatsApp' | 'Instagram' | 'Web' | 'Marketplace' | 'Teléfono' | 'Presencial';
export type EstadoTestDrive = 'pendiente' | 'aprobado' | 'rechazado' | 'hecho';
export type EstadoUsuario = 'Activo' | 'Ocupado' | 'Desconectado';

export interface Sucursal {
  id: number;
  nombre: string;
  direccion: string;
  telefono: string;
}

export interface Perfil {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  rol: Rol;
  sucursal_id: number | null;
  sector: Sector | null;
  estado: EstadoUsuario;
}

export interface Lead {
  id: number;
  nombre: string;
  telefono: string;
  canal: Canal;
  sucursal_id: number | null;
  sector: Sector;
  vendedor_id: string | null;
  modelo: string;
  forma_pago: string;
  presupuesto: string;
  etapa: number;
  etapa_actualizada_at: string;
  tags: string[];
  prioridad: 'alta' | 'media' | 'baja';
  leido: boolean;
  ultimo_mensaje_at: string;
  created_at: string;
}

export interface Mensaje {
  id: number;
  lead_id: number;
  direccion: 'in' | 'out';
  texto: string;
  autor_id: string | null;
  created_at: string;
}

export interface Nota {
  id: number;
  lead_id: number;
  autor_id: string | null;
  texto: string;
  created_at: string;
}

export interface Alerta {
  id: number;
  owner_id: string;
  lead_id: number | null;
  mensaje: string;
  fecha: string;
}

export interface TestDrive {
  id: number;
  vehiculo: string;
  sucursal_id: number | null;
  cliente: string;
  telefono: string;
  lead_id: number | null;
  vendedor_id: string | null;
  fecha: string;
  hora: string;
  estado: EstadoTestDrive;
}

export interface CampoExtra {
  k: string;
  v: string;
}

export interface Venta {
  id: number;
  cliente: string;
  vehiculo: string;
  vendedor_id: string | null;
  sucursal_id: number | null;
  sector: Sector;
  fecha: string;
  monto: string;
  extra: CampoExtra[];
  lead_id: number | null;
}

export interface Comunicado {
  id: number;
  tag: string;
  texto: string;
  detalle: string;
}

export interface Gira {
  id: number;
  destino: string;
  fecha: string;
  unidades: string;
}

export interface Entrega {
  id: number;
  vehiculo: string;
  cliente: string;
  dia: string;
  hecha: boolean;
}

/** Resultado estándar de una Server Action. */
export type Resultado = { ok: true; mensaje?: string } | { ok: false; error: string };
