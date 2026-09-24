import { crearClienteServidor } from '@/lib/supabase/server';
import { listarModelos, listarSucursales, listarTestDrives } from '@/lib/datos';
import { fechaHaceDias } from '@/lib/fechas';
import { exigirRol } from '@/lib/sesion';
import { AgendaTestDrive } from './agenda';

export default async function TestDrivePage() {
  const { perfil } = await exigirRol(['vendedor']);
  const supabase = await crearClienteServidor();
  // Últimos 60 días en adelante: suficiente para navegar el calendario y ver el historial reciente.
  const desde = fechaHaceDias(60);
  const [turnos, sucursales, modelos, leads] = await Promise.all([
    listarTestDrives({ desde }),
    listarSucursales(),
    listarModelos(),
    supabase.from('leads').select('id, nombre, telefono').eq('vendedor_id', perfil.id).order('nombre'),
  ]);
  return (
    <AgendaTestDrive
      turnos={turnos}
      sucursales={sucursales}
      modelos={modelos}
      leads={(leads.data ?? []) as { id: number; nombre: string; telefono: string }[]}
      yo={perfil}
    />
  );
}
