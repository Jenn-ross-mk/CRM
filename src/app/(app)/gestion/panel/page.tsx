import { exigirRol } from '@/lib/sesion';
import { crearClienteServidor } from '@/lib/supabase/server';
import type { Comunicado, Entrega, Gira } from '@/lib/tipos';
import { PanelGeneral } from './panel';

export default async function PanelPage() {
  await exigirRol(['administrador', 'supervisor']);
  const supabase = await crearClienteServidor();
  const [c, g, e] = await Promise.all([
    supabase.from('comunicados').select('*').order('created_at', { ascending: false }),
    supabase.from('giras').select('*').order('created_at'),
    supabase.from('entregas').select('*').order('created_at'),
  ]);
  return <PanelGeneral comunicados={(c.data ?? []) as Comunicado[]} giras={(g.data ?? []) as Gira[]} entregas={(e.data ?? []) as Entrega[]} />;
}
