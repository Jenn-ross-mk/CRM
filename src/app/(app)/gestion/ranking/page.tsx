import { FiltroSelect, ToggleSector } from '@/components/filtros';
import { RankingVista } from '@/components/ranking-vista';
import { cargarRanking, type ParamsRanking } from '@/lib/ranking-pagina';
import { exigirRol } from '@/lib/sesion';

export default async function RankingGestionPage({ searchParams }: { searchParams: Promise<ParamsRanking> }) {
  await exigirRol(['administrador', 'supervisor']);
  const params = await searchParams;
  const r = await cargarRanking(params);
  return (
    <div className="dash" style={{ position: 'relative' }}>
      <div className="pipe-filters">
        <FiltroSelect param="s" valor={params.s ?? ''} opciones={r.opcionesSucursal} />
        <FiltroSelect param="mes" valor={params.mes ?? ''} opciones={r.opcionesMes} />
        <span className="pipe-filters-note">Ranking completo de todas las sucursales — hacé clic en un vendedor para ver el detalle de sus ventas</span>
      </div>
      <ToggleSector valor={r.sector} />
      <RankingVista filas={r.filas} etiqueta={r.etiqueta} ventas={r.ventas} rutaVentas="/gestion/ventas" />
    </div>
  );
}
