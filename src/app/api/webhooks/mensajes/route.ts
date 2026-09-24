import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { CANALES } from '@/lib/constantes';
import { crearClienteAdmin } from '@/lib/supabase/server';

/**
 * Punto de entrada para mensajes entrantes de cualquier canal (WhatsApp, Instagram, formulario web…).
 * Un integrador (Make, n8n, la API de Meta, etc.) hace POST con el header `x-webhook-secret`.
 *
 * Body JSON: { telefono, nombre?, canal?, texto, sucursal?, sector?, modelo? }
 * Si ya existe un lead con ese teléfono se agrega el mensaje a su conversación; si no, se crea el lead sin asignar.
 */
export async function POST(request: NextRequest) {
  const secreto = process.env.WEBHOOK_SECRET;
  const recibido = request.headers.get('x-webhook-secret') ?? '';
  if (!secreto || recibido.length !== secreto.length || !timingSafeEqual(Buffer.from(recibido), Buffer.from(secreto))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const telefono = String(body.telefono ?? '').trim();
  const texto = String(body.texto ?? '').trim();
  if (!telefono || !texto) return NextResponse.json({ error: 'Faltan telefono o texto' }, { status: 400 });

  const canal = CANALES.includes(body.canal as (typeof CANALES)[number]) ? (body.canal as string) : 'WhatsApp';
  const sector = body.sector === 'Plan de ahorro' ? 'Plan de ahorro' : 'Convencional';
  const supabase = crearClienteAdmin();

  let { data: lead } = await supabase.from('leads').select('id').eq('telefono', telefono).order('created_at', { ascending: false }).limit(1).maybeSingle();
  let creado = false;
  if (!lead) {
    let sucursalId: number | null = null;
    if (body.sucursal) {
      const { data: s } = await supabase.from('sucursales').select('id').ilike('nombre', String(body.sucursal)).maybeSingle();
      sucursalId = s?.id ?? null;
    }
    const { data, error } = await supabase.from('leads').insert({
      nombre: String(body.nombre ?? '').trim() || telefono,
      telefono,
      canal,
      sector,
      sucursal_id: sucursalId,
      modelo: String(body.modelo ?? '').trim() || '—',
    }).select('id').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    lead = data;
    creado = true;
  }

  const { error } = await supabase.from('mensajes').insert({ lead_id: lead.id, direccion: 'in', texto });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, lead_id: lead.id, lead_nuevo: creado });
}
