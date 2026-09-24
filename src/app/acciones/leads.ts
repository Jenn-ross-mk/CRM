'use server';

import { refresh } from 'next/cache';
import { contexto, error, ok, texto } from '@/lib/acciones';
import { ETAPA_FINAL, PLANTILLA_SEGUIMIENTO } from '@/lib/constantes';
import type { Canal, Lead, Resultado, Sector } from '@/lib/tipos';

export async function enviarMensaje(leadId: number, cuerpo: string): Promise<Resultado> {
  const contenido = cuerpo.trim();
  if (!contenido) return error('Escribí un mensaje.');
  const { supabase, perfil } = await contexto();
  const { error: e } = await supabase.from('mensajes').insert({ lead_id: leadId, direccion: 'out', texto: contenido, autor_id: perfil.id });
  if (e) return error(e);
  // La primera respuesta pasa el lead de "Nuevo" a "Contactado".
  await supabase.from('leads').update({ etapa: 1 }).eq('id', leadId).eq('etapa', 0);
  refresh();
  return ok();
}

export async function usarPlantilla(leadId: number): Promise<Resultado> {
  const { supabase } = await contexto();
  const { data: lead } = await supabase.from('leads').select('nombre').eq('id', leadId).single<Pick<Lead, 'nombre'>>();
  if (!lead) return error('No se encontró el lead.');
  return enviarMensaje(leadId, PLANTILLA_SEGUIMIENTO(lead.nombre));
}

/** Marca la conversación como leída sin refrescar la vista (la lista se reordena en la próxima navegación). */
export async function marcarLeido(leadId: number): Promise<void> {
  const { supabase } = await contexto();
  await supabase.from('leads').update({ leido: true }).eq('id', leadId).eq('leido', false);
}

export async function agregarNota(leadId: number, cuerpo: string): Promise<Resultado> {
  const contenido = cuerpo.trim();
  if (!contenido) return error('La nota está vacía.');
  const { supabase, perfil } = await contexto();
  const { error: e } = await supabase.from('notas').insert({ lead_id: leadId, autor_id: perfil.id, texto: contenido });
  if (e) return error(e);
  refresh();
  return ok();
}

async function editarTags(leadId: number, cambiar: (tags: string[]) => string[]): Promise<Resultado> {
  const { supabase } = await contexto();
  const { data: lead } = await supabase.from('leads').select('tags').eq('id', leadId).single<Pick<Lead, 'tags'>>();
  if (!lead) return error('No se encontró el lead.');
  const { error: e } = await supabase.from('leads').update({ tags: cambiar(lead.tags) }).eq('id', leadId);
  if (e) return error(e);
  refresh();
  return ok();
}

export async function agregarTag(leadId: number, tag: string): Promise<Resultado> {
  const t = tag.trim();
  if (!t) return error('La etiqueta está vacía.');
  return editarTags(leadId, (tags) => (tags.includes(t) ? tags : [...tags, t]));
}

export async function quitarTag(leadId: number, tag: string): Promise<Resultado> {
  return editarTags(leadId, (tags) => tags.filter((x) => x !== tag));
}

export async function actualizarDatosLead(leadId: number, fd: FormData): Promise<Resultado> {
  const { supabase } = await contexto();
  const { error: e } = await supabase.from('leads').update({
    modelo: texto(fd, 'modelo') || '—',
    forma_pago: texto(fd, 'forma_pago') || 'A definir',
    presupuesto: texto(fd, 'presupuesto') || '—',
  }).eq('id', leadId);
  if (e) return error(e);
  refresh();
  return ok();
}

/**
 * Cambia la etapa del pipeline. Al llegar a la etapa final se registra la venta
 * automáticamente; si se desmarca, se elimina la venta generada desde el lead.
 */
export async function cambiarEtapa(leadId: number, etapa: number): Promise<Resultado> {
  if (etapa < 0 || etapa > ETAPA_FINAL) return error('Etapa inválida.');
  const { supabase, perfil } = await contexto();
  const { data: lead, error: e1 } = await supabase.from('leads').update({ etapa }).eq('id', leadId).select('*').single<Lead>();
  if (e1 || !lead) return error(e1 ?? 'No se pudo actualizar el lead.');

  if (etapa === ETAPA_FINAL) {
    const { data: existente } = await supabase.from('ventas').select('id').eq('lead_id', leadId).maybeSingle();
    if (!existente) {
      const { error: e2 } = await supabase.from('ventas').insert({
        cliente: lead.nombre,
        vehiculo: lead.modelo.startsWith('Chevrolet') || lead.modelo === '—' ? lead.modelo : `Chevrolet ${lead.modelo}`,
        vendedor_id: lead.vendedor_id ?? perfil.id,
        sucursal_id: lead.sucursal_id,
        sector: lead.sector,
        monto: lead.presupuesto,
        lead_id: lead.id,
      });
      if (e2) return error(e2);
    }
  } else {
    await supabase.from('ventas').delete().eq('lead_id', leadId);
  }
  refresh();
  return ok(etapa === ETAPA_FINAL ? 'Venta registrada.' : undefined);
}

export async function reasignarLead(leadId: number, vendedorId: string): Promise<Resultado> {
  const { supabase, esGestion } = await contexto();
  if (!esGestion) return error('No tenés permisos para reasignar conversaciones.');
  const { error: e } = await supabase.from('leads').update({ vendedor_id: vendedorId }).eq('id', leadId);
  if (e) return error(e);
  refresh();
  return ok('Conversación reasignada correctamente.');
}

export async function crearLead(fd: FormData): Promise<Resultado> {
  const { supabase, perfil, esGestion } = await contexto();
  const nombre = texto(fd, 'nombre');
  if (!nombre) return error('Ingresá el nombre del lead.');
  const sucursalId = Number(texto(fd, 'sucursal_id')) || perfil.sucursal_id;
  const vendedorElegido = texto(fd, 'vendedor_id');
  const { data: lead, error: e } = await supabase.from('leads').insert({
    nombre,
    telefono: texto(fd, 'telefono'),
    canal: (texto(fd, 'canal') || 'WhatsApp') as Canal,
    sucursal_id: sucursalId,
    sector: (texto(fd, 'sector') || perfil.sector || 'Convencional') as Sector,
    vendedor_id: esGestion ? vendedorElegido || null : perfil.id,
    modelo: texto(fd, 'modelo') || '—',
    forma_pago: texto(fd, 'forma_pago') || 'A definir',
    presupuesto: texto(fd, 'presupuesto') || '—',
    leido: true,
  }).select('id').single();
  if (e || !lead) return error(e ?? 'No se pudo crear el lead.');

  const primerMensaje = texto(fd, 'mensaje');
  if (primerMensaje) {
    await supabase.from('mensajes').insert({ lead_id: lead.id, direccion: 'in', texto: primerMensaje });
    await supabase.from('leads').update({ leido: true }).eq('id', lead.id);
  }
  refresh();
  return ok(String(lead.id));
}
