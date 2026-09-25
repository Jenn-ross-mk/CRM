import { listarSucursales, listarTurnos, listarUsuarios } from '@/lib/datos';
import { fechaHaceDias, instanteLocal } from '@/lib/fechas';
import { exigirRol } from '@/lib/sesion';
import { AprobacionTestDrives } from './aprobacion';

export default async function TestDrivesGestionPage() {
  const { usuario, misSucursales } = await exigirRol(['admin', 'supervisor']);
  const desde = instanteLocal(fechaHaceDias(30), '00:00');
  const [turnos, usuarios, sucursales] = await Promise.all([listarTurnos({ desde }), listarUsuarios(), listarSucursales()]);
  const visibles = usuario.rol === 'supervisor' ? turnos.filter((t) => t.sucursal_id !== null && misSucursales.includes(t.sucursal_id)) : turnos;
  return (
    <AprobacionTestDrives
      turnos={visibles}
      nombres={Object.fromEntries(usuarios.map((u) => [u.id, u.nombre]))}
      sucursales={Object.fromEntries(sucursales.map((s) => [s.id, s.nombre]))}
    />
  );
}
