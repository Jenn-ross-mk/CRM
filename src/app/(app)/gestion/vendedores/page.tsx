import { listarPerfiles, listarSucursales } from '@/lib/datos';
import { exigirRol } from '@/lib/sesion';
import { GestionUsuarios } from './usuarios';

export default async function VendedoresPage() {
  const { perfil } = await exigirRol(['administrador']);
  const [perfiles, sucursales] = await Promise.all([listarPerfiles(), listarSucursales()]);
  // Vendedores primero (por sector y nombre), después supervisores y administradores.
  const orden = { vendedor: 0, supervisor: 1, administrador: 2 } as const;
  perfiles.sort((a, b) => orden[a.rol] - orden[b.rol] || (a.sector ?? '').localeCompare(b.sector ?? '') || a.nombre.localeCompare(b.nombre));
  return <GestionUsuarios usuarios={perfiles} sucursales={sucursales} yoId={perfil.id} />;
}
