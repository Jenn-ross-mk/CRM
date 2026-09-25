import type { Sector, Sucursal, Usuario, Venta } from './tipos';

/** Ranking por cantidad de ventas. Incluye a todos los vendedores activos del sector (aunque tengan 0). */
export function calcularRanking(ventas: Venta[], usuarios: Usuario[], sucursales: Sucursal[], sector: Sector, sucursalId?: number | null) {
  const nombreSuc = new Map(sucursales.map((s) => [s.id, s.nombre]));
  const conteo = new Map<number, number>();
  for (const v of ventas) {
    if (v.sector !== sector) continue;
    if (sucursalId && v.sucursal_id !== sucursalId) continue;
    conteo.set(v.vendedor_id, (conteo.get(v.vendedor_id) ?? 0) + 1);
  }
  return usuarios
    .filter((u) => u.rol === 'vendedor' && u.sector === sector && (u.activo || conteo.has(u.id)) && (!sucursalId || u.sucursal_id === sucursalId))
    .map((u) => ({ id: u.id, nombre: u.nombre, sucursal: u.sucursal_id ? nombreSuc.get(u.sucursal_id) ?? '—' : '—', ventas: conteo.get(u.id) ?? 0 }))
    .sort((a, b) => b.ventas - a.ventas || a.nombre.localeCompare(b.nombre));
}
