'use client';

import Link from 'next/link';
import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { usarPlantilla } from '@/app/acciones/leads';
import { TRAMOS_SEGUIMIENTO } from '@/lib/constantes';
import type { PendienteSeguimiento } from '@/lib/datos';
import { Iconos } from './iconos';
import { useAccion, Vacio } from './ui';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

export function Seguimiento({ conteos, pendientes, rutaLead, nombres, sub }: {
  conteos: number[];
  pendientes: PendienteSeguimiento[];
  rutaLead: string;
  nombres?: Record<number, string>;
  sub: string;
}) {
  return (
    <div className="seg-grid">
      <div className="dcard">
        <h3>Alertas de recuperación</h3>
        <p className="dcard-sub">{sub}</p>
        <div className="chart-box">
          <Bar
            data={{
              labels: TRAMOS_SEGUIMIENTO.map((t) => t.label),
              datasets: [{ data: conteos, backgroundColor: TRAMOS_SEGUIMIENTO.map((t) => t.color), borderRadius: 5, maxBarThickness: 42 }],
            }}
            options={{
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1, font: { family: 'Montserrat', size: 10 } }, grid: { color: '#F0F1F3' } },
                x: { ticks: { font: { family: 'Montserrat', size: 9.5, weight: 600 } }, grid: { display: false } },
              },
            }}
          />
        </div>
      </div>
      <div className="dcard">
        <h3>Pendientes de seguimiento</h3>
        <p className="dcard-sub">Ordenados por urgencia · {pendientes.length} leads</p>
        <div style={{ maxHeight: 520, overflowY: 'auto' }}>
          {pendientes.length ? pendientes.map((p) => <FilaPendiente key={p.lead.id} p={p} rutaLead={rutaLead} vendedor={nombres && p.lead.vendedor_id ? nombres[p.lead.vendedor_id] : undefined} />)
            : <Vacio>No hay leads sin contacto hace más de una semana. ¡Buen trabajo!</Vacio>}
        </div>
      </div>
    </div>
  );
}

function FilaPendiente({ p, rutaLead, vendedor }: { p: PendienteSeguimiento; rutaLead: string; vendedor?: string }) {
  const tramo = TRAMOS_SEGUIMIENTO[p.tramo];
  const { pendiente, resultado, ejecutar } = useAccion();
  const enviada = resultado?.ok;
  return (
    <div className="seg-alert-row">
      <div className="agenda-icon reminder-icon">{Iconos.reloj}</div>
      <div>
        <div className="agenda-title"><Link href={`${rutaLead}?lead=${p.lead.id}&f=si`}>{p.lead.nombre}</Link></div>
        <div className="agenda-sub">Sin contacto hace {p.dias} días{vendedor ? ` · ${vendedor}` : ''}</div>
      </div>
      <span className="seg-bucket" style={{ background: tramo.color, color: tramo.texto }}>{tramo.label}</span>
      <button className="mini-btn mini-btn-approve" style={{ marginLeft: 8 }} disabled={pendiente || enviada}
        title={resultado && !resultado.ok ? resultado.error : 'Enviar plantilla de seguimiento'}
        onClick={() => ejecutar(() => usarPlantilla(p.lead.id))}>
        {enviada ? 'Enviada ✓' : pendiente ? '…' : 'Plantilla'}
      </button>
    </div>
  );
}
