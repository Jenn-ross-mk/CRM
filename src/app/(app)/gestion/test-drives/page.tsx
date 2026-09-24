import { listarPerfiles, listarSucursales, listarTestDrives } from '@/lib/datos';
import { fechaHaceDias } from '@/lib/fechas';
import { exigirRol } from '@/lib/sesion';
import { AprobacionTestDrives } from './aprobacion';

export default async function TestDrivesGestionPage() {
  const { perfil } = await exigirRol(['administrador', 'supervisor']);
  const desde = fechaHaceDias(30);
  const [turnos, perfiles, sucursales] = await Promise.all([listarTestDrives({ desde }), listarPerfiles(), listarSucursales()]);
  const visibles = perfil.rol === 'supervisor' ? turnos.filter((t) => t.sucursal_id === perfil.sucursal_id) : turnos;
  return (
    <AprobacionTestDrives
      turnos={visibles}
      nombres={Object.fromEntries(perfiles.map((p) => [p.id, p.nombre]))}
      sucursales={Object.fromEntries(sucursales.map((s) => [s.id, s.nombre]))}
    />
  );
}
