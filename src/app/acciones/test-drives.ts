'use server';

import { refresh } from 'next/cache';
import { contexto, error, ok, texto } from '@/lib/acciones';
import { instanteLocal } from '@/lib/fechas';
import type { EstadoTurno, Resultado } from '@/lib/tipos';

export async function solicitarTurno(fd: FormData): Promise<Resultado> {
  const { supabase, usuario } = await contexto();
  const cliente = texto(fd, 'cliente');
  const fecha = texto(fd, 'fecha');
  const hora = texto(fd, 'hora');
  const vehiculo = texto(fd, 'vehiculo');
  const sucursalId = Number(texto(fd, 'sucursal_id'));
  if (!cliente || !fecha) return error('Completá el cliente y seleccioná una fecha en el calendario.');
  if (!vehiculo || !/^\d{2}:\d{2}$/.test(hora) || !sucursalId) return error('Completá vehículo, sucursal y hora.');
  const fechaHora = instanteLocal(fecha, hora);

  // Evitar doble reserva del mismo vehículo en la misma sucursal, día y hora.
  const { data: ocupado } = await supabase.from('turnos').select('id')
    .eq('tipo', 'test_drive').eq('sucursal_id', sucursalId).eq('fecha_hora', fechaHora).eq('vehiculo', vehiculo)
    .in('estado', ['pendiente', 'aprobado']).limit(1);
  if (ocupado?.length) return error('Ese vehículo ya tiene un turno en ese horario. Elegí otro horario.');

  const { error: e } = await supabase.from('turnos').insert({
    tipo: 'test_drive',
    vehiculo,
    cliente_nombre: cliente,
    cliente_telefono: texto(fd, 'telefono') || null,
    fecha_hora: fechaHora,
    sucursal_id: sucursalId,
    vendedor_id: usuario.id,
    lead_id: Number(texto(fd, 'lead_id')) || null,
    estado: 'pendiente',
  });
  if (e) return error(e);
  refresh();
  return ok('Turno solicitado — queda pendiente de aprobación del administrador.');
}

export async function cambiarEstadoTurno(id: number, estado: EstadoTurno): Promise<Resultado> {
  const { supabase, usuario, esGestion } = await contexto();
  if (!esGestion) return error('No tenés permisos para aprobar turnos.');
  const cambios = estado === 'aprobado' ? { estado, aprobado_por: usuario.id } : { estado };
  const { error: e } = await supabase.from('turnos').update(cambios).eq('id', id);
  if (e) return error(e);
  refresh();
  return ok();
}
