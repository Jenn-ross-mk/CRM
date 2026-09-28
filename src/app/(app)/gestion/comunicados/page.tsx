import { exigirRol } from '@/lib/sesion';
import { crearClienteServidor } from '@/lib/supabase/server';
import type { Comunicado, Gira } from '@/lib/tipos';
import { PanelComunicados } from './panel';

export default async function ComunicadosPage() {
  await exigirRol(['admin', 'supervisor']);
  const supabase = await crearClienteServidor();
  const [c, g] = await Promise.all([
    supabase.from('comunicados').select('*').eq('activo', true).order('creado_en', { ascending: false }),
    supabase.from('giras_plan_ahorro').select('*').order('fecha_hora'),
  ]);
  return <PanelComunicados comunicados={(c.data ?? []) as Comunicado[]} giras={(g.data ?? []) as Gira[]} />;
}
