import type { Rol } from '@/lib/tipos';

export type IconoNav = 'inicio' | 'mensajes' | 'calendario' | 'reloj' | 'trofeo' | 'embudo' | 'personas' | 'ubicacion' | 'documento' | 'megafono' | 'horario';

export interface ItemNav {
  href: string;
  titulo: string;
  icono: IconoNav;
}

const VENDEDOR: ItemNav[] = [
  { href: '/inicio', titulo: 'Inicio', icono: 'inicio' },
  { href: '/bandeja', titulo: 'Bandeja', icono: 'mensajes' },
  { href: '/test-drive', titulo: 'Test drive', icono: 'calendario' },
  { href: '/seguimiento', titulo: 'Seguimiento', icono: 'reloj' },
  { href: '/ranking', titulo: 'Ranking', icono: 'trofeo' },
];

const GESTION: (ItemNav & { soloAdmin?: boolean })[] = [
  { href: '/gestion/mensajes', titulo: 'Mensajes', icono: 'mensajes' },
  { href: '/gestion/pipeline', titulo: 'Pipeline', icono: 'embudo' },
  { href: '/gestion/seguimiento', titulo: 'Seguimiento', icono: 'reloj' },
  { href: '/gestion/vendedores', titulo: 'Vendedores', icono: 'personas', soloAdmin: true },
  { href: '/gestion/horarios', titulo: 'Horarios', icono: 'horario', soloAdmin: true },
  { href: '/gestion/sucursales', titulo: 'Sucursales', icono: 'ubicacion', soloAdmin: true },
  { href: '/gestion/ranking', titulo: 'Ranking', icono: 'trofeo' },
  { href: '/gestion/test-drives', titulo: 'Test drives', icono: 'calendario' },
  { href: '/gestion/ventas', titulo: 'Ventas', icono: 'documento' },
  { href: '/gestion/panel', titulo: 'Panel general', icono: 'megafono' },
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
