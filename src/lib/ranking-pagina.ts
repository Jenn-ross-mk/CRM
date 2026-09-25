import 'server-only';
import { ETIQUETA_SECTOR, SECTORES_VENTA } from './constantes';
import { listarSucursales, listarUsuarios, listarVentas, rangoMes } from './datos';
import { mesClave, nombreMes } from './fechas';
import { calcularRanking } from './ranking';
import type { Sector } from './tipos';

export type ParamsRanking = { sector?: string; s?: string; mes?: string };

/** Datos comunes de las páginas de ranking (vendedor y gestión). */
export async function cargarRanking(params: ParamsRanking, sucursalForzada?: number | null) {
  const sector: Sector = SECTORES_VENTA.includes(params.sector as Sector) ? (params.sector as Sector) : 'convencional';
  const mes = params.mes === 'todos' ? null : params.mes && /^\d{4}-\d{2}$/.test(params.mes) ? params.mes : mesClave();
  const sucursalId = sucursalForzada ?? (Number(params.s) || null);
  const [ventas, usuarios, sucursales] = await Promise.all([listarVentas(mes ? rangoMes(mes) : {}), listarUsuarios(), listarSucursales()]);
  const filas = calcularRanking(ventas, usuarios, sucursales, sector, sucursalId);
  const ventasFiltradas = ventas.filter((v) => v.sector === sector && (!sucursalId || v.sucursal_id === sucursalId));

  const meses = Array.from({ length: 6 }, (_, i) => mesClave(-i));
  const opcionesMes = [
    ...meses.map((m, i) => ({ valor: i === 0 ? '' : m, etiqueta: i === 0 ? `Este mes · ${nombreMes(m, false)}` : nombreMes(m) })),
    { valor: 'todos', etiqueta: 'Todos los meses' },
  ];
  const opcionesSucursal = [{ valor: '', etiqueta: 'Todas las sucursales' }, ...sucursales.map((s) => ({ valor: String(s.id), etiqueta: `Sucursal ${s.nombre}` }))];
  const sucLabel = sucursalId ? `Sucursal ${sucursales.find((s) => s.id === sucursalId)?.nombre}` : 'todas las sucursales';
  const etiqueta = `${ETIQUETA_SECTOR[sector]} · ${sucLabel} · ${mes ? nombreMes(mes, false) : 'todos los meses'} · ${filas.length} vendedores (posiciones completas, no solo el podio)`;

  return { sector, filas, ventas: ventasFiltradas, opcionesMes, opcionesSucursal, etiqueta };
}
