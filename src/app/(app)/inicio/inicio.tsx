'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { crearAlerta, eliminarAlerta } from '@/app/acciones/alertas';
import { Calendario } from '@/components/calendario';
import { Iconos } from '@/components/iconos';
import type { FilaRanking } from '@/components/ranking';
import { Toast, useAccion, Vacio } from '@/components/ui';
import { HORAS_ALERTA } from '@/lib/constantes';
import { fechaCorta, fechaLocal, fechaTexto, horaLocal, tituloDia } from '@/lib/fechas';
import type { Alerta, Comunicado, Entrega, Gira } from '@/lib/tipos';

interface Props {
  mes: string;
  comunicados: Comunicado[];
  giras: Gira[];
  entregas: Entrega[];
  rankingConv: FilaRanking[];
  rankingPlan: FilaRanking[];
  alertas: Alerta[];
  leads: { id: number; nombre: string }[];
}

export function Inicio(props: Props) {
  const [tab, setTab] = useState<'resumen' | 'alertas'>('resumen');
  return (
    <div className="dash">
      <div className="subtabs">
        <div className={`subtab${tab === 'resumen' ? ' active' : ''}`} onClick={() => setTab('resumen')}>Resumen</div>
        <div className={`subtab${tab === 'alertas' ? ' active' : ''}`} onClick={() => setTab('alertas')}>
          Mis alertas <span className="subtab-badge">{props.alertas.length}</span>
        </div>
      </div>
      {tab === 'resumen' ? <Resumen {...props} /> : <MisAlertas {...props} />}
    </div>
  );
}

function Resumen({ mes, comunicados, giras, entregas, rankingConv, rankingPlan }: Props) {
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
              <span className="td-slot">{g.fecha}</span>
              <span className={`td-status ${g.unidades === 'Por confirmar' ? 'td-libre' : 'td-reservado'}`}>{g.unidades}</span>
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
              <span className="announce-tag">{c.tag}</span>
              <div><div className="announce-text">{c.texto}</div><div className="announce-date">{c.detalle}</div></div>
            </div>
          )) : <Vacio>Sin comunicados.</Vacio>}
        </div>
        <div className="dcard">
          <h3>Entregas de la semana</h3>
          {entregas.length ? (
            <table className="deliv-table">
              <thead><tr><th>Vehículo</th><th>Cliente</th><th>Fecha</th></tr></thead>
              <tbody>
                {entregas.map((e) => (
                  <tr key={e.id}><td className="deliv-veh">{e.vehiculo}</td><td>{e.cliente}</td><td><span className="deliv-day">{e.hecha ? 'Entregado' : e.dia}</span></td></tr>
                ))}
              </tbody>
            </table>
          ) : <Vacio>No hay entregas programadas.</Vacio>}
        </div>
      </div>
    </div>
  );
}

function MisAlertas({ alertas, leads }: Props) {
  const hoy = fechaLocal();
  const [mes, setMes] = useState(hoy.slice(0, 7));
  const [dia, setDia] = useState(hoy);
  const [hora, setHora] = useState('09:00');
  const [leadId, setLeadId] = useState('');
  const [mensaje, setMensaje] = useState('');
  const crear = useAccion();
  const borrar = useAccion();

  const nombreLead = useMemo(() => new Map(leads.map((l) => [l.id, l.nombre])), [leads]);
  const porDia = useMemo(() => {
    const m = new Map<string, Alerta[]>();
    alertas.forEach((a) => { const d = fechaLocal(a.fecha); m.set(d, [...(m.get(d) ?? []), a]); });
    return m;
  }, [alertas]);
  const delDia = porDia.get(dia) ?? [];

  const etiquetaLead = (a: Alerta) => <span className="reminder-lead-tag">{a.lead_id ? nombreLead.get(a.lead_id) ?? 'Lead' : 'General'}</span>;
  const botonBorrar = (a: Alerta) => (
    <button className="x-btn" style={{ marginLeft: 'auto' }} title="Eliminar alerta" disabled={borrar.pendiente} onClick={() => borrar.ejecutar(() => eliminarAlerta(a.id))}>✕</button>
  );

  return (
    <>
      <div className="td-grid">
        <div className="dcard">
          <Calendario mes={mes} seleccionado={dia} conEventos={new Set(porDia.keys())} onSeleccionar={setDia} onCambiarMes={setMes} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="dcard">
            <h3>Alertas · {tituloDia(dia)}</h3>
            <p className="dcard-sub">Creadas manualmente o desde un chat</p>
            {delDia.length ? delDia.map((a) => (
              <div key={a.id} className="reminder-item">
                <div className="agenda-icon reminder-icon">{Iconos.campana}</div>
                <div><div className="agenda-title">{a.mensaje}</div><div className="agenda-sub">{horaLocal(a.fecha)} · {etiquetaLead(a)}</div></div>
                {botonBorrar(a)}
              </div>
            )) : <div className="empty-slots">Sin alertas este día.</div>}
          </div>
          <div className="dcard">
            <h3>Crear alerta</h3>
            <p className="dcard-sub">Para el día seleccionado en el calendario</p>
            <form onSubmit={(e) => {
              e.preventDefault();
              crear.ejecutar(() => crearAlerta({ fecha: dia, hora, mensaje, leadId: Number(leadId) || null }), (r) => { if (r.ok) { setMensaje(''); setLeadId(''); } });
            }}>
              <div className="form-grid">
                <div className="fld"><label>Fecha</label><input readOnly value={fechaTexto(dia)} /></div>
                <div className="fld"><label>Hora</label>
                  <select value={hora} onChange={(e) => setHora(e.target.value)}>{HORAS_ALERTA.map((h) => <option key={h}>{h}</option>)}</select>
                </div>
                <div className="fld" style={{ gridColumn: '1/-1' }}><label>Lead (opcional)</label>
                  <select value={leadId} onChange={(e) => setLeadId(e.target.value)}>
                    <option value="">Sin lead asociado</option>
                    {leads.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                  </select>
                </div>
                <div className="fld" style={{ gridColumn: '1/-1' }}><label>Mensaje</label>
                  <input value={mensaje} onChange={(e) => setMensaje(e.target.value)} placeholder="Ej: llamar para confirmar entrega" />
                </div>
              </div>
              <button className="alert-btn" style={{ width: '100%', marginTop: 12 }} disabled={crear.pendiente}>Guardar alerta</button>
              <Toast resultado={crear.resultado?.ok ? null : crear.resultado} />
            </form>
          </div>
        </div>
      </div>
      <div className="dcard" style={{ marginTop: 18 }}>
        <h3>Todas mis alertas</h3>
        <p className="dcard-sub">Orden cronológico completo</p>
        {alertas.length ? alertas.map((a) => (
          <div key={a.id} className="alert-list-row">
            <div className="agenda-icon reminder-icon">{Iconos.campana}</div>
            <div><div className="alert-msg">{a.mensaje}</div><div className="alert-when">{fechaCorta(a.fecha)} · {horaLocal(a.fecha)} · {etiquetaLead(a)}</div></div>
            {botonBorrar(a)}
          </div>
        )) : <Vacio>No tenés alertas creadas.</Vacio>}
      </div>
    </>
  );
}
