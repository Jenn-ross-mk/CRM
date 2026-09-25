import { crearClienteServidor } from '@/lib/supabase/server';
import { listarModelos, listarSucursales, listarTurnos } from '@/lib/datos';
import { fechaHaceDias, instanteLocal } from '@/lib/fechas';
import { exigirRol } from '@/lib/sesion';
import { AgendaTestDrive } from './agenda';

export default async function TestDrivePage() {
  const { usuario } = await exigirRol(['vendedor']);
  const supabase = await crearClienteServidor();
  // Últimos 60 días en adelante: suficiente para navegar el calendario y ver el historial reciente.
  const desde = instanteLocal(fechaHaceDias(60), '00:00');
  const [turnos, sucursales, modelos, leads] = await Promise.all([
    listarTurnos({ desde }),
    listarSucursales(),
    listarModelos(),
    supabase.from('bandeja').select('id, nombre, telefono').eq('vendedor_id', usuario.id).order('nombre'),
  ]);
  return (
    <AgendaTestDrive
      turnos={turnos}
      sucursales={sucursales.filter((s) => s.activa)}
      modelos={modelos}
      leads={(leads.data ?? []) as { id: number; nombre: string; telefono: string | null }[]}
      yo={usuario}
    />
  );
}
