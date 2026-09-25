import { exigirRol } from '@/lib/sesion';
import { crearClienteServidor } from '@/lib/supabase/server';
import type { Comunicado, Entrega, Gira } from '@/lib/tipos';
import { PanelGeneral } from './panel';

export default async function PanelPage() {
  await exigirRol(['admin', 'supervisor']);
  const supabase = await crearClienteServidor();
  const [c, g, e] = await Promise.all([
    supabase.from('comunicados').select('*').eq('activo', true).order('creado_en', { ascending: false }),
    supabase.from('giras_plan_ahorro').select('*').order('fecha_hora'),
    supabase.from('entregas').select('*').order('fecha'),
  ]);
  return <PanelGeneral comunicados={(c.data ?? []) as Comunicado[]} giras={(g.data ?? []) as Gira[]} entregas={(e.data ?? []) as Entrega[]} />;
}
