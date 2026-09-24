'use client';

import { fechaLocal, nombreMes } from '@/lib/fechas';

const DOW = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function sumarMes(clave: string, n: number) {
  const [y, m] = clave.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Calendario mensual (lunes a domingo) con marcas en los días que tienen eventos. */
export function Calendario({ mes, seleccionado, conEventos, onSeleccionar, onCambiarMes }: {
  mes: string;
  seleccionado: string | null;
  conEventos: Set<string>;
  onSeleccionar: (ymd: string) => void;
  onCambiarMes: (mes: string) => void;
}) {
  const [y, m] = mes.split('-').map(Number);
  const primerDow = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // 0 = lunes
  const diasMes = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const hoy = fechaLocal();

  return (
    <>
      <div className="cal-head">
        <h3 style={{ margin: 0 }}>{nombreMes(mes)}</h3>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="cal-nav-btn" aria-label="Mes anterior" onClick={() => onCambiarMes(sumarMes(mes, -1))}>‹</button>
          <button className="cal-nav-btn" aria-label="Mes siguiente" onClick={() => onCambiarMes(sumarMes(mes, 1))}>›</button>
        </div>
      </div>
      <div className="cal-grid">
        {DOW.map((d, i) => <div key={i} className="cal-dow">{d}</div>)}
        {Array.from({ length: primerDow }, (_, i) => <div key={`v${i}`} className="cal-day muted" />)}
        {Array.from({ length: diasMes }, (_, i) => {
          const ymd = `${mes}-${String(i + 1).padStart(2, '0')}`;
          const tiene = conEventos.has(ymd);
          const cls = `cal-day${tiene ? ' has-res' : ''}${ymd === seleccionado ? ' selected' : ''}${ymd === hoy ? ' today' : ''}`;
          return (
            <div key={ymd} className={cls} onClick={() => onSeleccionar(ymd)}>
              {i + 1}
              {tiene && <div className="cal-dot" />}
            </div>
          );
        })}
      </div>
    </>
  );
}
