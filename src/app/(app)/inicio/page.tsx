import { crearClienteServidor } from '@/lib/supabase/server';
import { listarSucursales, listarUsuarios, listarVentas, rangoMes } from '@/lib/datos';
import { mesClave, nombreMes } from '@/lib/fechas';
import { calcularRanking } from '@/lib/ranking';
import { exigirRol } from '@/lib/sesion';
import type { Comunicado, Gira, Sector } from '@/lib/tipos';
import { Inicio } from './inicio';

export default async function InicioPage() {
  const { sucursal } = await exigirRol(['vendedor']);
  const supabase = await crearClienteServidor();
  const mes = mesClave();
  const [comunicados, giras, ventas, usuarios, sucursales] = await Promise.all([
    supabase.from('comunicados').select('*').eq('activo', true).order('creado_en', { ascending: false }),
    supabase.from('giras_plan_ahorro').select('*').gte('fecha_hora', new Date().toISOString()).order('fecha_hora'),
    listarVentas(rangoMes(mes)),
    listarUsuarios(),
    listarSucursales(),
  ]);

  // Comunicados generales o de la sucursal del vendedor.
  const visibles = ((comunicados.data ?? []) as Comunicado[]).filter((c) => !c.sucursal_id || c.sucursal_id === sucursal?.id);
  const top = (sector: Sector) => calcularRanking(ventas, usuarios, sucursales, sector).slice(0, 3);

  return (
    <Inicio
      mes={nombreMes(mes, false)}
      comunicados={visibles}
      giras={(giras.data ?? []) as Gira[]}
      rankingConv={top('convencional')}
      rankingPlan={top('plan_ahorro')}
    />
  );
}
