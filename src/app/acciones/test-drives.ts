'use server';

import { refresh } from 'next/cache';
import { contexto, error, ok, texto } from '@/lib/acciones';
import type { EstadoTestDrive, Resultado } from '@/lib/tipos';

export async function solicitarTurno(fd: FormData): Promise<Resultado> {
  const { supabase, perfil } = await contexto();
  const cliente = texto(fd, 'cliente');
  const fecha = texto(fd, 'fecha');
  const hora = texto(fd, 'hora');
  const vehiculo = texto(fd, 'vehiculo').replace(/^Chevrolet /, '');
  const sucursalId = Number(texto(fd, 'sucursal_id'));
  if (!cliente || !fecha) return error('Completá el cliente y seleccioná una fecha en el calendario.');
  if (!vehiculo || !hora || !sucursalId) return error('Completá vehículo, sucursal y hora.');

  // Evitar doble reserva del mismo vehículo en la misma sucursal, día y hora.
  const { data: ocupado } = await supabase.from('test_drives').select('id')
    .eq('sucursal_id', sucursalId).eq('fecha', fecha).eq('hora', hora).eq('vehiculo', vehiculo)
    .in('estado', ['pendiente', 'aprobado']).limit(1);
  if (ocupado?.length) return error('Ese vehículo ya tiene un turno en ese horario. Elegí otro horario.');

  const leadId = Number(texto(fd, 'lead_id')) || null;
  const { error: e } = await supabase.from('test_drives').insert({
    vehiculo, cliente, telefono: texto(fd, 'telefono'), fecha, hora, sucursal_id: sucursalId,
    vendedor_id: perfil.id, lead_id: leadId, estado: 'pendiente',
  });
  if (e) return error(e);
  refresh();
  return ok('Turno solicitado — queda pendiente de aprobación del administrador.');
}

export async function cambiarEstadoTestDrive(id: number, estado: EstadoTestDrive): Promise<Resultado> {
  const { supabase, esGestion } = await contexto();
  if (!esGestion) return error('No tenés permisos para aprobar turnos.');
  const { error: e } = await supabase.from('test_drives').update({ estado }).eq('id', id);
  if (e) return error(e);
  refresh();
  return ok();
}
