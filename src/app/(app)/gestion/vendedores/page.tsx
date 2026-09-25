import { listarSucursales, listarUsuarios } from '@/lib/datos';
import { exigirRol } from '@/lib/sesion';
import { crearClienteServidor } from '@/lib/supabase/server';
import { GestionUsuarios } from './usuarios';

export default async function VendedoresPage() {
  const { usuario } = await exigirRol(['admin']);
  const supabase = await crearClienteServidor();
  const [usuarios, sucursales, { data: supervisadas }] = await Promise.all([
    listarUsuarios(),
    listarSucursales(),
    supabase.from('supervisor_sucursales').select('usuario_id, sucursal_id'),
  ]);
  // Activos primero; dentro de cada grupo, vendedores (por sector y nombre), después supervisores y administradores.
  const orden = { vendedor: 0, supervisor: 1, admin: 2 } as const;
  usuarios.sort((a, b) => Number(b.activo) - Number(a.activo) || orden[a.rol] - orden[b.rol] || (a.sector ?? '').localeCompare(b.sector ?? '') || a.nombre.localeCompare(b.nombre));
  const aCargo: Record<number, number[]> = {};
  (supervisadas ?? []).forEach((f) => { (aCargo[f.usuario_id] ??= []).push(f.sucursal_id); });
  return <GestionUsuarios usuarios={usuarios} sucursales={sucursales} aCargo={aCargo} yoId={usuario.id} />;
}
