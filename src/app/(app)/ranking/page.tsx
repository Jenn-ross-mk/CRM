import { FiltroSelect, ToggleSector } from '@/components/filtros';
import { RankingVista } from '@/components/ranking-vista';
import { cargarRanking, type ParamsRanking } from '@/lib/ranking-pagina';
import { exigirRol } from '@/lib/sesion';

export default async function RankingPage({ searchParams }: { searchParams: Promise<ParamsRanking> }) {
  const { usuario } = await exigirRol(['vendedor']);
  const params = await searchParams;
  if (!params.sector && usuario.sector) params.sector = usuario.sector;
  const r = await cargarRanking(params);
  return (
    <div className="dash" style={{ position: 'relative' }}>
      <div className="pipe-filters">
        <FiltroSelect param="s" valor={params.s ?? ''} opciones={r.opcionesSucursal} />
        <FiltroSelect param="mes" valor={params.mes ?? ''} opciones={r.opcionesMes} />
      </div>
      <ToggleSector valor={r.sector} />
      <RankingVista filas={r.filas} etiqueta={r.etiqueta} />
    </div>
  );
}
