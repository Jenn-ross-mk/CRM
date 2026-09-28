'use server';

import { refresh } from 'next/cache';
import { contexto, error, ok, texto } from '@/lib/acciones';
import { instanteLocal } from '@/lib/fechas';
import type { EstadoTurno, LeadBandeja, Resultado } from '@/lib/tipos';

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

  // Si se pide desde un lead, el test drive (y su alerta) queda a nombre del vendedor del lead.
  const leadId = Number(texto(fd, 'lead_id')) || null;
  const { data: lead } = leadId ? await supabase.from('leads').select('vendedor_id').eq('id', leadId).maybeSingle() : { data: null };

  const { error: e } = await supabase.from('turnos').insert({
    tipo: 'test_drive',
    vehiculo,
    cliente_nombre: cliente,
    cliente_telefono: texto(fd, 'telefono') || null,
    fecha_hora: fechaHora,
    sucursal_id: sucursalId,
    vendedor_id: lead?.vendedor_id ?? usuario.id,
    lead_id: leadId,
    estado: 'pendiente',
  });
  if (e) return error(e);
  refresh();
  return ok('Test drive solicitado. Queda pendiente de aprobación; la alerta se crea cuando se aprueba.');
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

/**
 * Agenda una llamada o visita para un lead (desde el chat). No necesita aprobación: queda "pendiente"
 * hasta que se marca como realizada o se cancela. La usa el Panel general (agendados / agenda vencida).
 */
export async function agendarContacto(leadId: number, datos: { tipo: string; fecha: string; hora: string }): Promise<Resultado> {
  if (datos.tipo !== 'llamada' && datos.tipo !== 'visita') return error('Elegí llamada o visita.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha) || !/^\d{2}:\d{2}$/.test(datos.hora)) return error('Completá la fecha y la hora.');
  const { supabase, usuario } = await contexto();
  const { data: lead } = await supabase.from('bandeja').select('nombre, telefono, sucursal_id, vendedor_id, vehiculo_interes')
    .eq('id', leadId).maybeSingle<Pick<LeadBandeja, 'nombre' | 'telefono' | 'sucursal_id' | 'vendedor_id' | 'vehiculo_interes'>>();
  if (!lead) return error('No se encontró el lead.');
  const { error: e } = await supabase.from('turnos').insert({
    tipo: datos.tipo,
    lead_id: leadId,
    cliente_nombre: lead.nombre,
    cliente_telefono: lead.telefono,
    vehiculo: lead.vehiculo_interes,
    sucursal_id: lead.sucursal_id,
    vendedor_id: lead.vendedor_id ?? usuario.id,
    fecha_hora: instanteLocal(datos.fecha, datos.hora),
    estado: 'pendiente',
  });
  if (e) return error(e);
  refresh();
  return ok(datos.tipo === 'llamada' ? 'Llamada agendada. Se creó la alerta para ese día.' : 'Visita agendada. Se creó la alerta para ese día.');
}

/** Marca como realizada ('hecho') o cancela ('rechazado') una llamada o visita. */
export async function cerrarAgenda(id: number, estado: 'hecho' | 'rechazado'): Promise<Resultado> {
  if (estado !== 'hecho' && estado !== 'rechazado') return error('Estado inválido.');
  const { supabase } = await contexto();
  const { data, error: e } = await supabase.from('turnos').update({ estado }).eq('id', id).neq('tipo', 'test_drive').select('id');
  if (e) return error(e);
  if (!data?.length) return error('No tenés permiso para modificar esta agenda.');
  refresh();
  return ok();
}
