import { FiltroSelect } from '@/components/filtros';
import { COLORES_EMBUDO, ETIQUETA_SECTOR, TEXTO_EMBUDO, etapasDe, ordenEtapa, ordenFinal, sectoresConPipeline } from '@/lib/constantes';
import { listarEtapas, listarSucursales, rangoMes } from '@/lib/datos';
import { instanteLocal, mesClave, msHaceDias, nombreMes } from '@/lib/fechas';
import { exigirRol } from '@/lib/sesion';
import { crearClienteServidor } from '@/lib/supabase/server';
import type { Lead, Sector } from '@/lib/tipos';

type LeadPipe = Pick<Lead, 'sector' | 'etapa_id' | 'creado_en' | 'etapa_actualizada_en'>;

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ s?: string; mes?: string }> }) {
  const { usuario, misSucursales } = await exigirRol(['admin', 'supervisor']);
  const params = await searchParams;
  const esAdmin = usuario.rol === 'admin';
  // El supervisor puede elegir entre sus sucursales; el admin, entre todas.
  const sucursalId = Number(params.s) || null;
  const mes = params.mes === 'todos' ? null : params.mes && /^\d{4}-\d{2}$/.test(params.mes) ? params.mes : mesClave();

  const supabase = await crearClienteServidor();
  let query = supabase.from('leads').select('sector, etapa_id, creado_en, etapa_actualizada_en').not('sector', 'is', null).limit(10000);
  if (sucursalId) query = query.eq('sucursal_id', sucursalId);
  const [{ data }, todasLasSucursales, etapas] = await Promise.all([query, listarSucursales(), listarEtapas()]);
  const sucursales = esAdmin ? todasLasSucursales : todasLasSucursales.filter((x) => misSucursales.includes(x.id));
  const SECTORES = sectoresConPipeline(etapas);
  const todos = ((data ?? []) as LeadPipe[]).filter((l) => SECTORES.includes(l.sector!));

  const rango = mes ? rangoMes(mes) : null;
  const delPeriodo = rango
    ? todos.filter((l) => {
        const t = Date.parse(l.creado_en);
        return t >= Date.parse(instanteLocal(rango.desde, '00:00')) && t < Date.parse(instanteLocal(rango.hasta, '00:00'));
      })
    : todos;
  const semana = msHaceDias(7);
  const nuevosSemana = todos.filter((l) => Date.parse(l.creado_en) >= semana).length;
  const nuevosSemanaAnterior = todos.filter((l) => Date.parse(l.creado_en) >= semana - 7 * 86400000 && Date.parse(l.creado_en) < semana).length;
  const estancados = todos.filter((l) => ordenEtapa(etapas, l.etapa_id) < ordenFinal(etapas, l.sector) && Date.parse(l.etapa_actualizada_en) < semana).length;

  const embudo = (sector: Sector) => {
    const delSector = delPeriodo.filter((l) => l.sector === sector);
    return etapasDe(etapas, sector).map((e) => ({ label: e.nombre, count: delSector.filter((l) => ordenEtapa(etapas, l.etapa_id) >= e.orden).length }));
  };
  const embudos = Object.fromEntries(SECTORES.map((s) => [s, embudo(s)])) as Record<Sector, { label: string; count: number }[]>;

  // Cuello de botella: la mayor caída porcentual entre dos etapas consecutivas.
  let peor = { caida: 0, sector: '', de: '', a: '', desde: 0, hasta: 0 };
  for (const s of SECTORES) {
    const e = embudos[s];
    for (let i = 1; i < e.length; i++) {
      if (!e[i - 1].count) continue;
      const caida = 1 - e[i].count / e[i - 1].count;
      if (caida > peor.caida) peor = { caida, sector: ETIQUETA_SECTOR[s], de: e[i - 1].label, a: e[i].label, desde: e[i - 1].count, hasta: e[i].count };
    }
  }

  const meses = Array.from({ length: 6 }, (_, i) => mesClave(-i));
  const ingresados = SECTORES.map((s) => ({ sector: s, total: embudos[s][0]?.count ?? 0 }));
  const diferencia = nuevosSemana - nuevosSemanaAnterior;

  return (
    <div className="dash">
      <div className="pipe-filters">
        {sucursales.length > 1 && (
          <FiltroSelect param="s" valor={params.s ?? ''} opciones={[{ valor: '', etiqueta: esAdmin ? 'Todas las sucursales' : 'Todas mis sucursales' }, ...sucursales.map((x) => ({ valor: String(x.id), etiqueta: `Sucursal ${x.nombre}` }))]} />
        )}
        <FiltroSelect param="mes" valor={params.mes ?? ''} opciones={[
          ...meses.map((m, i) => ({ valor: i === 0 ? '' : m, etiqueta: i === 0 ? `Este mes · ${nombreMes(m, false)}` : nombreMes(m) })),
          { valor: 'todos', etiqueta: 'Todo el historial' },
        ]} />
        <span className="pipe-filters-note">Leads que ingresaron en el período, agrupados por la última etapa alcanzada.</span>
      </div>
      <div className="pipe-summary">
        <div className="stat-card"><div className="stat-label">Leads que ingresaron</div><div className="stat-value">{ingresados.reduce((a, x) => a + x.total, 0)}</div><div className="stat-foot">{ingresados.map((x) => `${x.total} ${ETIQUETA_SECTOR[x.sector].toLowerCase()}`).join(' · ')}</div></div>
        <div className="stat-card"><div className="stat-label">Nuevos esta semana</div><div className="stat-value">{nuevosSemana}</div><div className="stat-foot">{diferencia >= 0 ? '+' : ''}{diferencia} vs. la semana anterior</div></div>
        <div className="stat-card"><div className="stat-label">Estancados +7 días</div><div className="stat-value">{estancados}</div><div className="stat-foot">sin cambio de etapa esta semana</div></div>
        <div className="stat-card stat-card-alert">
          <div className="stat-label">Cuello de botella</div>
          <div className="stat-value" style={{ fontSize: 17 }}>{peor.sector ? `-${Math.round(peor.caida * 100)}%` : '—'}</div>
          <div className="stat-foot">{peor.sector ? `${peor.sector} · ${peor.de} → ${peor.a} (${peor.desde} a ${peor.hasta})` : 'Sin datos suficientes en el período'}</div>
        </div>
      </div>
      <div className="pipe-grid">
        {SECTORES.map((s) => {
          const e = embudos[s];
          const max = e[0]?.count || 1;
          return (
            <div key={s} className="dcard">
              <h3>{ETIQUETA_SECTOR[s]}</h3>
              <p className="dcard-sub">{e[0]?.count ?? 0} leads ingresados · % sobre el total de la etapa &quot;Nuevo&quot;</p>
              {e.map((etapa, i) => {
                const pct = Math.round((etapa.count / max) * 100);
                return (
                  <div key={etapa.label} className="funnel-row">
                    <div className="funnel-label">{etapa.label}</div>
                    <div className="funnel-track">
                      <div className="funnel-fill" style={{ width: `${Math.max(pct, etapa.count ? 12 : 0)}%`, background: COLORES_EMBUDO[i] }}>
                        {etapa.count > 0 && <span style={{ color: TEXTO_EMBUDO[i] }}>{etapa.count} · {pct}%</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
