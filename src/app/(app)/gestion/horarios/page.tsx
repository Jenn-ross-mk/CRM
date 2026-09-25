import { listarHorarios, listarSucursales, listarUsuarios } from '@/lib/datos';
import { fechaLocal } from '@/lib/fechas';
import { exigirRol } from '@/lib/sesion';
import { GestionHorarios } from './horarios';

export default async function HorariosPage() {
  await exigirRol(['admin']);
  const hoy = fechaLocal();
  const [horarios, usuarios, sucursales] = await Promise.all([listarHorarios(hoy), listarUsuarios(), listarSucursales()]);
  const vendedores = usuarios.filter((u) => u.rol === 'vendedor' && u.activo);
  return <GestionHorarios horarios={horarios} vendedores={vendedores} sucursales={sucursales} hoy={hoy} />;
}
