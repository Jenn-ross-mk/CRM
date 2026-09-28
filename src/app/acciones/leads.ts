'use server';

import { refresh } from 'next/cache';
import { contexto, error, ok, texto } from '@/lib/acciones';
import { CANALES_MANUALES, FORMAS_PAGO, MOTIVOS_CIERRE, PLANTILLA_SEGUIMIENTO, SECTORES_VENTA, etiquetaMotivoCierre, ordenFinal } from '@/lib/constantes';
import { crearClienteAdmin } from '@/lib/supabase/server';
import type { Canal, EtapaPipeline, Lead, MotivoCierre, Prioridad, Resultado, Sector } from '@/lib/tipos';

type Supabase = Awaited<ReturnType<typeof contexto>>['supabase'];

async function etapasDelSector(supabase: Supabase, sector: Sector | null): Promise<EtapaPipeline[]> {
  if (!sector) return [];
  const { data } = await supabase.from('etapas_pipeline').select('*').eq('sector', sector).order('orden');
  return (data ?? []) as EtapaPipeline[];
}

/**
 * Mensaje escrito por el vendedor. Queda con estado_envio = 'pendiente': el CRM no lo manda a
 * WhatsApp/Meta; lo envía n8n. Al guardarse, el trigger pasa el lead a modo 'humano' (el bot deja de responder).
 */
export async function enviarMensaje(leadId: number, cuerpo: string): Promise<Resultado> {
  const contenido = cuerpo.trim();
  if (!contenido) return error('Escribí un mensaje.');
  const { supabase, usuario } = await contexto();
  const { error: e } = await supabase.from('mensajes').insert({
    lead_id: leadId,
    direccion: 'saliente',
    autor_tipo: 'vendedor',
    autor_usuario_id: usuario.id,
    tipo: 'texto',
    contenido,
    estado_envio: 'pendiente',
  });
  if (e) return error(e);

  // La primera respuesta pasa el lead de "Nuevo" a "Contactado".
  const { data: lead } = await supabase.from('leads').select('sector, etapa_id').eq('id', leadId).single<Pick<Lead, 'sector' | 'etapa_id'>>();
  if (lead) {
    const etapas = await etapasDelSector(supabase, lead.sector);
    const actual = etapas.find((x) => x.id === lead.etapa_id)?.orden ?? 1;
    const contactado = etapas.find((x) => x.orden === 2);
    if (actual <= 1 && contactado) await supabase.from('leads').update({ etapa_id: contactado.id }).eq('id', leadId);
  }
  refresh();
  return ok();
}

export async function usarPlantilla(leadId: number): Promise<Resultado> {
  const { supabase } = await contexto();
  const { data: lead } = await supabase.from('bandeja').select('nombre').eq('id', leadId).single<{ nombre: string }>();
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
  const { supabase, usuario } = await contexto();
  const { error: e } = await supabase.from('notas').insert({ lead_id: leadId, usuario_id: usuario.id, texto: contenido });
  if (e) return error(e);
  refresh();
  return ok();
}

/** Agrega una etiqueta al lead. Las etiquetas son un catálogo: solo el admin puede crear una nueva. */
export async function agregarEtiqueta(leadId: number, nombre: string): Promise<Resultado> {
  const n = nombre.trim();
  if (!n) return error('La etiqueta está vacía.');
  const { supabase, esAdmin } = await contexto();
  let { data: etiqueta } = await supabase.from('etiquetas').select('id').ilike('nombre', n.replace(/[%_\\]/g, '\\$&')).maybeSingle();
  if (!etiqueta) {
    if (!esAdmin) return error('Esa etiqueta no existe. Elegí una de la lista o pedile a un administrador que la cree.');
    const { data, error: e } = await supabase.from('etiquetas').insert({ nombre: n }).select('id').single();
    if (e) return error(e);
    etiqueta = data;
  }
  const { error: e } = await supabase.from('lead_etiquetas').upsert({ lead_id: leadId, etiqueta_id: etiqueta.id }, { onConflict: 'lead_id,etiqueta_id', ignoreDuplicates: true });
  if (e) return error(e);
  refresh();
  return ok();
}

export async function quitarEtiqueta(leadId: number, etiquetaId: number): Promise<Resultado> {
  const { supabase } = await contexto();
  const { error: e } = await supabase.from('lead_etiquetas').delete().eq('lead_id', leadId).eq('etiqueta_id', etiquetaId);
  if (e) return error(e);
  refresh();
  return ok();
}

const formaPago = (v: string) => (FORMAS_PAGO.some((f) => f.valor === v) ? v : null);
const prioridad = (v: string): Prioridad => (v === 'alta' || v === 'baja' ? v : 'media');

export async function actualizarDatosLead(leadId: number, fd: FormData): Promise<Resultado> {
  const { supabase } = await contexto();
  const { error: e } = await supabase.from('leads').update({
    nombre_cliente: texto(fd, 'nombre_cliente') || null,
    vehiculo_interes: texto(fd, 'vehiculo_interes') || null,
    forma_pago: formaPago(texto(fd, 'forma_pago')),
    monto_capital: texto(fd, 'monto_capital') || null,
    prioridad: prioridad(texto(fd, 'prioridad')),
  }).eq('id', leadId);
  if (e) return error(e);
  refresh();
  return ok();
}

const opcion = (v: string, validos: string[]) => (validos.includes(v) ? v : null);
const siNo = (v: string) => (v === 'si' ? true : v === 'no' ? false : null);

/** Datos del perfil del cliente. Todos son opcionales: lo que queda vacío se guarda vacío. */
export async function actualizarPerfilCliente(leadId: number, fd: FormData): Promise<Resultado> {
  const { supabase } = await contexto();
  const email = texto(fd, 'email');
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return error('El email no parece válido.');
  const { error: e } = await supabase.from('leads').update({
    nombre_cliente: texto(fd, 'nombre_cliente') || null,
    email: email || null,
    localidad: texto(fd, 'localidad') || null,
    vehiculo_interes: texto(fd, 'vehiculo_interes') || null,
    tipo: opcion(texto(fd, 'tipo'), ['0km', 'usado', 'promocion']),
    forma_pago: formaPago(texto(fd, 'forma_pago')),
    monto_capital: texto(fd, 'monto_capital') || null,
    entrega_vehiculo: siNo(texto(fd, 'entrega_vehiculo')),
    usado_descripcion: texto(fd, 'usado_descripcion') || null,
    uso: opcion(texto(fd, 'uso'), ['familiar', 'laboral', 'comercial']),
    urgencia: texto(fd, 'urgencia') || null,
    clasificacion: opcion(texto(fd, 'clasificacion'), ['frio', 'tibio', 'caliente']),
    prioridad: prioridad(texto(fd, 'prioridad')),
    preferencias: texto(fd, 'preferencias') || null,
  }).eq('id', leadId);
  if (e) return error(e);
  refresh();
  return ok('Datos guardados.');
}

/**
 * Cambia la etapa del pipeline (orden 1..N del sector del lead). Al llegar a la última etapa se
 * registra la venta automáticamente; si se desmarca, se elimina la venta generada desde el lead.
 */
export async function cambiarEtapa(leadId: number, orden: number): Promise<Resultado> {
  const { supabase, usuario } = await contexto();
  const { data: lead } = await supabase.from('bandeja').select('*').eq('id', leadId).single();
  if (!lead) return error('No se encontró el lead.');
  const etapas = await etapasDelSector(supabase, lead.sector);
  const etapa = etapas.find((x) => x.orden === orden);
  if (!etapa) return error('Este lead no tiene un sector con pipeline (convencional o plan de ahorro).');

  const { error: e1 } = await supabase.from('leads').update({ etapa_id: etapa.id }).eq('id', leadId);
  if (e1) return error(e1);

  const esFinal = orden === ordenFinal(etapas, lead.sector);
  if (esFinal) {
    const { data: existente } = await supabase.from('ventas').select('id').eq('lead_id', leadId).limit(1).maybeSingle();
    if (!existente) {
      const { error: e2 } = await supabase.from('ventas').insert({
        cliente_nombre: lead.nombre,
        vehiculo: lead.vehiculo_interes || 'A definir',
        vendedor_id: lead.vendedor_id ?? usuario.id,
        sucursal_id: lead.sucursal_id,
        sector: lead.sector,
        lead_id: lead.id,
      });
      if (e2) return error(e2);
    }
  } else {
    await supabase.from('ventas').delete().eq('lead_id', leadId);
  }
  refresh();
  return ok(esFinal ? 'Venta registrada.' : undefined);
}

/** Asigna o reasigna un lead a mano (admin o supervisor). Queda registrado en asignaciones e historial. */
export async function reasignarLead(leadId: number, vendedorId: number): Promise<Resultado> {
  const { supabase, usuario, esGestion } = await contexto();
  if (!esGestion) return error('No tenés permisos para reasignar conversaciones.');
  const [{ data: lead }, { data: destino }] = await Promise.all([
    supabase.from('leads').select('vendedor_id, estado, derivado_en').eq('id', leadId).single<Pick<Lead, 'vendedor_id' | 'estado' | 'derivado_en'>>(),
    supabase.from('usuarios').select('nombre, activo').eq('id', vendedorId).single<{ nombre: string; activo: boolean }>(),
  ]);
  if (!lead) return error('No se encontró el lead.');
  if (!destino?.activo) return error('Ese usuario no está activo.');

  const pendienteDeAsignar = ['en_conversacion', 'en_cola', 'asignacion_manual'].includes(lead.estado);
  const { error: e } = await supabase.from('leads').update({
    vendedor_id: vendedorId,
    ...(pendienteDeAsignar ? { estado: 'derivado' } : {}),
    ...(lead.derivado_en ? {} : { derivado_en: new Date().toISOString() }),
  }).eq('id', leadId);
  if (e) return error(e);

  await supabase.from('asignaciones').insert({ lead_id: leadId, vendedor_id: vendedorId, motivo: lead.vendedor_id ? 'reasignacion' : 'manual' });
  await supabase.from('lead_historial').insert({
    lead_id: leadId,
    tipo: 'asignacion',
    descripcion: `${lead.vendedor_id ? 'Reasignado' : 'Asignado'} a ${destino.nombre} por ${usuario.nombre}`,
    usuario_id: usuario.id,
  });
  refresh();
  return ok('Conversación asignada correctamente.');
}

/**
 * Alta manual de un lead (llamado, visita, etc.). Crea el contacto y el lead desde el servidor,
 * después de validar los permisos (los leads normalmente los crea n8n). Queda en modo 'humano'.
 */
export async function crearLead(fd: FormData): Promise<Resultado> {
  const { usuario, misSucursales, esAdmin, esGestion } = await contexto();
  const nombre = texto(fd, 'nombre');
  if (!nombre) return error('Ingresá el nombre del lead.');
  const canal = (CANALES_MANUALES.includes(texto(fd, 'canal') as Canal) ? texto(fd, 'canal') : 'telefono') as Canal;
  const sector = (SECTORES_VENTA.includes(texto(fd, 'sector') as Sector) ? texto(fd, 'sector') : usuario.sector ?? 'convencional') as Sector;
  const telefono = texto(fd, 'telefono');
  const digitos = telefono.replace(/\D/g, '');

  const sucursalId = esGestion ? Number(texto(fd, 'sucursal_id')) || null : usuario.sucursal_id;
  if (!sucursalId) return error('Elegí una sucursal.');
  if (!esAdmin && !misSucursales.includes(sucursalId)) return error('No podés cargar leads en esa sucursal.');
  const vendedorId = esGestion ? Number(texto(fd, 'vendedor_id')) || null : usuario.id;

  const admin = crearClienteAdmin();
  if (vendedorId && esGestion) {
    const { data: v } = await admin.from('usuarios').select('sucursal_id, activo').eq('id', vendedorId).single();
    if (!v?.activo || (!esAdmin && !misSucursales.includes(v.sucursal_id))) return error('No podés asignarle leads a ese vendedor.');
  }

  // El contacto se identifica por canal + id en ese canal. Sin teléfono se genera un id propio del CRM.
  const canalId = digitos || `crm-${Date.now()}`;
  const { data: existente } = await admin.from('contactos').select('id').eq('canal', canal).eq('canal_id', canalId).maybeSingle();
  let contactoId = existente?.id as number | undefined;
  if (contactoId) {
    const { data: previo } = await admin.from('leads').select('id').eq('contacto_id', contactoId).limit(1).maybeSingle();
    if (previo) return error(`Ya existe una conversación con ese contacto (lead N.º ${previo.id}).`);
  } else {
    const { data: c, error: ec } = await admin.from('contactos')
      .insert({ canal, canal_id: canalId, nombre_perfil: nombre, telefono: telefono || null }).select('id').single();
    if (ec || !c) return error(ec ?? 'No se pudo crear el contacto.');
    contactoId = c.id;
  }

  const ahora = new Date().toISOString();
  const { data: lead, error: e } = await admin.from('leads').insert({
    contacto_id: contactoId,
    modo: 'humano',
    estado: vendedorId ? 'derivado' : 'asignacion_manual',
    nombre_cliente: nombre,
    sucursal_id: sucursalId,
    sector,
    vendedor_id: vendedorId,
    derivado_en: vendedorId ? ahora : null,
    vehiculo_interes: texto(fd, 'vehiculo_interes') || null,
    forma_pago: formaPago(texto(fd, 'forma_pago')),
    monto_capital: texto(fd, 'monto_capital') || null,
    leido: true,
  }).select('id').single();
  if (e || !lead) return error(e ?? 'No se pudo crear el lead.');

  if (vendedorId) await admin.from('asignaciones').insert({ lead_id: lead.id, vendedor_id: vendedorId, motivo: 'manual' });
  await admin.from('lead_historial').insert({ lead_id: lead.id, tipo: 'asignacion', descripcion: `Lead cargado a mano por ${usuario.nombre}`, usuario_id: usuario.id });

  const primerMensaje = texto(fd, 'mensaje');
  if (primerMensaje) {
    await admin.from('mensajes').insert({ lead_id: lead.id, direccion: 'entrante', autor_tipo: 'cliente', tipo: 'texto', contenido: primerMensaje });
    await admin.from('leads').update({ leido: true }).eq('id', lead.id);
  }
  refresh();
  return ok(String(lead.id));
}

/**
 * Cierra el chat con un motivo obligatorio: deja de verse en la bandeja y pasa al bloque "Cerrados" del Panel general.
 * El motivo "otros" (con texto) es solo para administradores; la base lo vuelve a controlar.
 */
export async function cerrarLead(leadId: number, motivo: string, detalle: string): Promise<Resultado> {
  const { supabase, usuario, esAdmin } = await contexto();
  const elegido = MOTIVOS_CIERRE.find((m) => m.valor === motivo);
  if (!elegido) return error('Elegí un motivo de cierre.');
  if (elegido.soloAdmin && !esAdmin) return error('Solo un administrador puede cerrar con el motivo "Otros".');
  const texto = detalle.trim();
  if (elegido.valor === 'otros' && !texto) return error('Escribí el motivo del cierre.');

  const { data, error: e } = await supabase.from('leads').update({
    estado: 'cerrado',
    motivo_cierre: elegido.valor,
    detalle_cierre: elegido.valor === 'otros' ? texto : null,
    cerrado_en: new Date().toISOString(),
    cerrado_por: usuario.id,
  }).eq('id', leadId).neq('estado', 'cerrado').select('id');
  if (e) return error(e);
  if (!data?.length) return error('Este chat ya estaba cerrado o no tenés permiso para cerrarlo.');

  await supabase.from('lead_historial').insert({
    lead_id: leadId,
    tipo: 'sistema',
    descripcion: `Chat cerrado por ${usuario.nombre}: ${etiquetaMotivoCierre(elegido.valor as MotivoCierre)}${elegido.valor === 'otros' ? ` (${texto})` : ''}`,
    usuario_id: usuario.id,
  });
  refresh();
  return ok('Chat cerrado.');
}

/** Reabre un chat cerrado (admin o supervisor): vuelve a la bandeja y la base borra los datos del cierre. */
export async function reabrirLead(leadId: number): Promise<Resultado> {
  const { supabase, usuario, esGestion } = await contexto();
  if (!esGestion) return error('Solo un administrador o supervisor puede reabrir un chat.');
  const { data: lead } = await supabase.from('leads').select('vendedor_id').eq('id', leadId).maybeSingle<Pick<Lead, 'vendedor_id'>>();
  if (!lead) return error('No se encontró el lead.');
  const { data, error: e } = await supabase.from('leads').update({ estado: lead.vendedor_id ? 'derivado' : 'asignacion_manual' })
    .eq('id', leadId).eq('estado', 'cerrado').select('id');
  if (e) return error(e);
  if (!data?.length) return error('Este chat no está cerrado o no tenés permiso para reabrirlo.');
  await supabase.from('lead_historial').insert({ lead_id: leadId, tipo: 'sistema', descripcion: `Chat reabierto por ${usuario.nombre}`, usuario_id: usuario.id });
  refresh();
  return ok('Chat reabierto.');
}
