import type { Perfil, Sector, Sucursal, Venta } from './tipos';

/** Ranking por cantidad de ventas. Incluye a todos los vendedores del sector (aunque tengan 0). */
export function calcularRanking(ventas: Venta[], perfiles: Perfil[], sucursales: Sucursal[], sector: Sector, sucursalId?: number | null) {
  const nombreSuc = new Map(sucursales.map((s) => [s.id, s.nombre]));
  const conteo = new Map<string, number>();
  for (const v of ventas) {
    if (v.sector !== sector || !v.vendedor_id) continue;
    if (sucursalId && v.sucursal_id !== sucursalId) continue;
    conteo.set(v.vendedor_id, (conteo.get(v.vendedor_id) ?? 0) + 1);
  }
  return perfiles
    .filter((p) => p.rol === 'vendedor' && p.sector === sector && (!sucursalId || p.sucursal_id === sucursalId))
    .map((p) => ({ id: p.id, nombre: p.nombre, sucursal: p.sucursal_id ? nombreSuc.get(p.sucursal_id) ?? '—' : '—', ventas: conteo.get(p.id) ?? 0 }))
    .sort((a, b) => b.ventas - a.ventas || a.nombre.localeCompare(b.nombre));
}
