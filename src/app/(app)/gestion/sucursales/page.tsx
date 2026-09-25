import { listarSucursales, listarUsuarios } from '@/lib/datos';
import { exigirRol } from '@/lib/sesion';
import { GestionSucursales } from './sucursales';

export default async function SucursalesPage() {
  await exigirRol(['admin']);
  const [sucursales, usuarios] = await Promise.all([listarSucursales(), listarUsuarios()]);
  const vendedoresPorSucursal: Record<number, number> = {};
  usuarios.filter((u) => u.rol === 'vendedor' && u.activo && u.sucursal_id).forEach((u) => {
    vendedoresPorSucursal[u.sucursal_id!] = (vendedoresPorSucursal[u.sucursal_id!] ?? 0) + 1;
  });
  return <GestionSucursales sucursales={sucursales} vendedores={vendedoresPorSucursal} />;
}
