import { crearClienteServidor } from '@/lib/supabase/server';
import { listarAgendamientos, listarAlertasPropias, listarModelos, listarSucursales } from '@/lib/datos';
import { fechaHaceDias, instanteLocal } from '@/lib/fechas';
import { exigirRol } from '@/lib/sesion';
import { Agendamientos } from './agendamientos';

export default async function AgendamientosPage() {
  const { usuario } = await exigirRol(['vendedor']);
  const supabase = await crearClienteServidor();
  // Últimos 60 días en adelante: suficiente para navegar el calendario y ver el historial reciente.
  const desde = instanteLocal(fechaHaceDias(60), '00:00');
  const [turnos, sucursales, modelos, leads, alertas] = await Promise.all([
    listarAgendamientos({ desde, vendedorId: usuario.id }),
    listarSucursales(),
    listarModelos(),
    supabase.from('bandeja').select('id, nombre, telefono').eq('vendedor_id', usuario.id).neq('estado', 'cerrado').order('nombre'),
    listarAlertasPropias(usuario.id),
  ]);
  return (
    <Agendamientos
      turnos={turnos}
      alertas={alertas}
      sucursales={sucursales.filter((s) => s.activa)}
      modelos={modelos}
      leads={(leads.data ?? []) as { id: number; nombre: string; telefono: string | null }[]}
      yo={usuario}
    />
  );
}
