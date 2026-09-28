'use client';

import Link from 'next/link';
import type { FilaRanking } from '@/components/ranking';
import { Vacio } from '@/components/ui';
import { fechaLocal, fechaTurno, horaLocal } from '@/lib/fechas';
import type { Comunicado, Gira } from '@/lib/tipos';

interface Props {
  mes: string;
  comunicados: Comunicado[];
  giras: Gira[];
  rankingConv: FilaRanking[];
  rankingPlan: FilaRanking[];
}

export function Inicio(props: Props) {
  return (
    <div className="dash">
      <Resumen {...props} />
    </div>
  );
}

function Resumen({ mes, comunicados, giras, rankingConv, rankingPlan }: Props) {
  const columna = (titulo: string, filas: FilaRanking[]) => {
    const max = filas[0]?.ventas || 1;
    return (
      <div className="rank-col">
        <div className="rank-col-title">{titulo}</div>
        {filas.map((v, i) => (
          <div key={v.id} className={`rank-row${i === 0 ? ' n1' : ''}`}>
            <div className="rank-num">{i + 1}</div>
            <div className="rank-info">
              <div className="rank-name">{v.nombre}</div>
              <div className="rank-bar-bg"><div className="rank-bar-fill" style={{ width: `${Math.round((v.ventas / max) * 100)}%` }} /></div>
            </div>
            <div className="rank-count">{v.ventas}</div>
          </div>
        ))}
        {!filas.length && <Vacio>Sin ventas todavía.</Vacio>}
      </div>
    );
  };

  return (
    <div className="dash-grid">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="dcard">
          <h3>Giras de Plan de Ahorro</h3>
          <p className="dcard-sub">Viajes de entrega/adjudicación agendados</p>
          {giras.length ? giras.map((g) => (
            <div key={g.id} className="td-row">
              <span className="td-model">{g.destino}</span>
              <span className="td-slot">{fechaTurno(fechaLocal(g.fecha_hora))} {horaLocal(g.fecha_hora)}</span>
              <span className={`td-status ${g.unidades ? 'td-reservado' : 'td-libre'}`}>{g.unidades ?? 'Por confirmar'}</span>
            </div>
          )) : <Vacio>No hay giras agendadas.</Vacio>}
        </div>
        <div className="dcard">
          <h3>Ranking mensual</h3>
          <p className="dcard-sub">Ventas concretadas · {mes} · <Link href="/ranking" className="btn-link" style={{ fontSize: 11 }}>ver completo</Link></p>
          <div className="rank-cols">{columna('Convencional', rankingConv)}{columna('Plan de ahorro', rankingPlan)}</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="dcard">
          <h3>Comunicados</h3>
          <p className="dcard-sub">Novedades del área</p>
          {comunicados.length ? comunicados.map((c) => (
            <div key={c.id} className="announce-item">
              <span className="announce-tag">{c.categoria ?? 'INFO'}</span>
              <div><div className="announce-text">{c.texto}</div><div className="announce-date">{c.cuando ?? ''}</div></div>
            </div>
          )) : <Vacio>Sin comunicados.</Vacio>}
        </div>
      </div>
    </div>
  );
}
