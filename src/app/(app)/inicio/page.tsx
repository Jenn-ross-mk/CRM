import { crearClienteServidor } from '@/lib/supabase/server';
import { listarAlertasPropias, listarPerfiles, listarSucursales, listarVentas, rangoMes } from '@/lib/datos';
import { mesClave, nombreMes } from '@/lib/fechas';
import { calcularRanking } from '@/lib/ranking';
import { exigirRol } from '@/lib/sesion';
import type { Comunicado, Entrega, Gira } from '@/lib/tipos';
import { Inicio } from './inicio';

export default async function InicioPage() {
  const { perfil } = await exigirRol(['vendedor']);
  const supabase = await crearClienteServidor();
  const mes = mesClave();
  const [comunicados, giras, entregas, leads, alertas, ventas, perfiles, sucursales] = await Promise.all([
    supabase.from('comunicados').select('*').order('created_at', { ascending: false }),
    supabase.from('giras').select('*').order('created_at'),
    supabase.from('entregas').select('*').order('created_at'),
    supabase.from('leads').select('id, nombre').eq('vendedor_id', perfil.id).order('nombre'),
    listarAlertasPropias(perfil.id),
    listarVentas(rangoMes(mes)),
    listarPerfiles(),
    listarSucursales(),
  ]);

  const top = (sector: 'Convencional' | 'Plan de ahorro') => calcularRanking(ventas, perfiles, sucursales, sector).slice(0, 3);

  return (
    <Inicio
      mes={nombreMes(mes, false)}
      comunicados={(comunicados.data ?? []) as Comunicado[]}
      giras={(giras.data ?? []) as Gira[]}
      entregas={(entregas.data ?? []) as Entrega[]}
      rankingConv={top('Convencional')}
      rankingPlan={top('Plan de ahorro')}
      alertas={alertas}
      leads={(leads.data ?? []) as { id: number; nombre: string }[]}
    />
  );
}
