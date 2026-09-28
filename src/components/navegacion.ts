import type { Rol } from '@/lib/tipos';

export type IconoNav = 'inicio' | 'mensajes' | 'calendario' | 'reloj' | 'trofeo' | 'embudo' | 'personas' | 'ubicacion' | 'documento' | 'megafono' | 'horario' | 'tablero';

export interface ItemNav {
  href: string;
  titulo: string;
  icono: IconoNav;
}

// El Panel general es la primera pantalla de todos los roles.
const PANEL: ItemNav = { href: '/panel', titulo: 'Panel general', icono: 'tablero' };

const VENDEDOR: ItemNav[] = [
  PANEL,
  { href: '/inicio', titulo: 'Inicio', icono: 'inicio' },
  { href: '/bandeja', titulo: 'Bandeja', icono: 'mensajes' },
  { href: '/agendamientos', titulo: 'Agendamientos', icono: 'calendario' },
  { href: '/seguimiento', titulo: 'Seguimiento', icono: 'reloj' },
  { href: '/ranking', titulo: 'Ranking', icono: 'trofeo' },
];

const GESTION: (ItemNav & { soloAdmin?: boolean })[] = [
  PANEL,
  { href: '/gestion/mensajes', titulo: 'Mensajes', icono: 'mensajes' },
  { href: '/gestion/pipeline', titulo: 'Pipeline', icono: 'embudo' },
  { href: '/gestion/seguimiento', titulo: 'Seguimiento', icono: 'reloj' },
  { href: '/gestion/vendedores', titulo: 'Vendedores', icono: 'personas', soloAdmin: true },
  { href: '/gestion/horarios', titulo: 'Horarios', icono: 'horario', soloAdmin: true },
  { href: '/gestion/sucursales', titulo: 'Sucursales', icono: 'ubicacion', soloAdmin: true },
  { href: '/gestion/ranking', titulo: 'Ranking', icono: 'trofeo' },
  { href: '/gestion/test-drives', titulo: 'Test drives', icono: 'calendario' },
  { href: '/gestion/ventas', titulo: 'Ventas', icono: 'documento' },
  { href: '/gestion/comunicados', titulo: 'Comunicados', icono: 'megafono' },
];

export function itemsPorRol(rol: Rol): ItemNav[] {
  if (rol === 'vendedor') return VENDEDOR;
  return GESTION.filter((i) => rol === 'admin' || !i.soloAdmin);
}

export const ETIQUETA_ROL: Record<Rol, string> = {
  vendedor: 'Vendedor',
  supervisor: 'Supervisor',
  admin: 'Administrador',
};
