import { listarPerfiles, listarSucursales } from '@/lib/datos';
import { exigirRol } from '@/lib/sesion';
import { GestionSucursales } from './sucursales';

export default async function SucursalesPage() {
  await exigirRol(['administrador']);
  const [sucursales, perfiles] = await Promise.all([listarSucursales(), listarPerfiles()]);
  const vendedoresPorSucursal: Record<number, number> = {};
  perfiles.filter((p) => p.rol === 'vendedor' && p.sucursal_id).forEach((p) => {
    vendedoresPorSucursal[p.sucursal_id!] = (vendedoresPorSucursal[p.sucursal_id!] ?? 0) + 1;
  });
  return <GestionSucursales sucursales={sucursales} vendedores={vendedoresPorSucursal} />;
}
