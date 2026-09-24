'use client';

import { useState } from 'react';
import { crearAlerta, eliminarAlerta } from '@/app/acciones/alertas';
import { actualizarDatosLead, agregarNota, agregarTag, cambiarEtapa, quitarTag, reasignarLead, usarPlantilla } from '@/app/acciones/leads';
import { ETAPA_FINAL, ETAPAS } from '@/lib/constantes';
import type { DetalleLead } from '@/lib/datos';
import { diasDesde, fechaCorta, fechaLocal, fechaTurno, horaBandeja, horaCorta, horaLocal } from '@/lib/fechas';
import { Iconos } from '../iconos';
import { Toast, useAccion, Vacio } from '../ui';
import type { PropsBandeja } from './bandeja';

type Props = PropsBandeja & { detalle: DetalleLead; nombres: Map<string, string>; sucursalNombre: Map<number, string> };

export function PanelDetalle(props: Props) {
  const [tab, setTab] = useState<'info' | 'actividad' | 'recordatorios'>('info');
  const { detalle } = props;
  return (
    <div className="detail">
      <div className="detail-tabs">
        <div className={`detail-tab${tab === 'info' ? ' active' : ''}`} onClick={() => setTab('info')}>Info</div>
        <div className={`detail-tab${tab === 'actividad' ? ' active' : ''}`} onClick={() => setTab('actividad')}>Actividad</div>
        <div className={`detail-tab${tab === 'recordatorios' ? ' active' : ''}`} onClick={() => setTab('recordatorios')}>
          Recordatorios <span className="detail-tab-badge">{detalle.alertas.length}</span>
        </div>
      </div>
      {tab === 'info' && <TabInfo {...props} />}
      {tab === 'actividad' && <TabActividad {...props} />}
      {tab === 'recordatorios' && <TabRecordatorios {...props} />}
    </div>
  );
}

function TabInfo({ detalle, modo, perfiles, yo, sucursalNombre, modelos }: Props) {
  const { lead, venta } = detalle;
  const etapas = ETAPAS[lead.sector];
  const [editando, setEditando] = useState(false);
  const [nuevoTag, setNuevoTag] = useState<string | null>(null);
  const datos = useAccion();
  const tags = useAccion();
  const etapa = useAccion();
  const reasignar = useAccion();

  const opcionesReasignar = perfiles.filter((p) =>
    p.id !== lead.vendedor_id && (p.rol === 'vendedor' || p.rol === 'administrador' || p.id === yo.id) &&
    (yo.rol === 'administrador' || p.sucursal_id === yo.sucursal_id || p.id === yo.id)
  );
  const [destino, setDestino] = useState(opcionesReasignar[0]?.id ?? '');

  const alternarEtapa = (i: number, marcado: boolean) => {
    const nueva = marcado ? i : Math.max(0, i - 1);
    if (nueva === ETAPA_FINAL && !confirm(`¿Marcar a ${lead.nombre} como "${etapas[ETAPA_FINAL]}"? Se va a registrar la venta.`)) return;
    etapa.ejecutar(() => cambiarEtapa(lead.id, nueva));
  };

  return (
    <div className="detail-pane active">
      <div className="detail-block">
        <p className="detail-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
          Datos del lead
          <button className="btn-link" style={{ fontSize: 10 }} onClick={() => setEditando(!editando)}>{editando ? 'Cancelar' : 'Editar'}</button>
        </p>
        {editando ? (
          <form action={(fd) => datos.ejecutar(() => actualizarDatosLead(lead.id, fd), (r) => r.ok && setEditando(false))}>
            <div className="fld" style={{ marginBottom: 8 }}>
              <label>Modelo de interés</label>
              <input name="modelo" list="lista-modelos" defaultValue={lead.modelo === '—' ? '' : lead.modelo} />
              <datalist id="lista-modelos">{modelos.map((m) => <option key={m} value={m.replace('Chevrolet ', '')} />)}</datalist>
            </div>
            <div className="fld" style={{ marginBottom: 8 }}><label>Forma de pago</label><input name="forma_pago" defaultValue={lead.forma_pago} /></div>
            <div className="fld" style={{ marginBottom: 10 }}><label>Presupuesto</label><input name="presupuesto" defaultValue={lead.presupuesto === '—' ? '' : lead.presupuesto} /></div>
            <button className="alert-btn" style={{ width: '100%' }} disabled={datos.pendiente}>Guardar</button>
            <Toast resultado={datos.resultado?.ok ? null : datos.resultado} />
          </form>
        ) : (
          <>
            <div className="field-row"><span className="field-key">Modelo de interés</span><span className="field-val">{lead.modelo}</span></div>
            <div className="field-row"><span className="field-key">Forma de pago</span><span className="field-val">{lead.forma_pago}</span></div>
            <div className="field-row"><span className="field-key">Presupuesto</span><span className="field-val">{lead.presupuesto}</span></div>
            <div className="field-row"><span className="field-key">Sucursal</span><span className="field-val">{lead.sucursal_id ? sucursalNombre.get(lead.sucursal_id) : '—'}</span></div>
            {modo === 'gestion' && (
              <div className="field-row"><span className="field-key">Vendedor asignado</span><span className="field-val">{lead.vendedor_id ? perfiles.find((p) => p.id === lead.vendedor_id)?.nombre : 'Sin asignar'}</span></div>
            )}
          </>
        )}
      </div>

      {modo === 'gestion' && (
        <div className="detail-block" style={{ paddingTop: 4 }}>
          <div className="fld">
            <label>{lead.vendedor_id ? 'Reasignar a' : 'Asignar a'}</label>
            <select value={destino} onChange={(e) => setDestino(e.target.value)}>
              {opcionesReasignar.map((p) => <option key={p.id} value={p.id}>{p.nombre}{p.id === yo.id ? ' (yo)' : ''}</option>)}
            </select>
          </div>
          <button className="alert-btn" style={{ width: '100%', marginTop: 9 }} disabled={reasignar.pendiente || !destino}
            onClick={() => reasignar.ejecutar(() => reasignarLead(lead.id, destino))}>
            {lead.vendedor_id ? 'Reasignar conversación' : 'Asignar conversación'}
          </button>
          <Toast resultado={reasignar.resultado} />
        </div>
      )}

      <div className="detail-block">
        <p className="detail-label">Etiquetas</p>
        <div className="tag-row">
          {lead.tags.map((t, i) => (
            <span key={t} className={`tag ${i === 0 ? 'tag-navy' : 'tag-charcoal'}`}>
              {t}
              <span className="tag-x" title="Quitar" onClick={() => tags.ejecutar(() => quitarTag(lead.id, t))}>✕</span>
            </span>
          ))}
          {nuevoTag === null ? (
            <button className="tag-add" onClick={() => setNuevoTag('')}>+ Agregar</button>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); tags.ejecutar(() => agregarTag(lead.id, nuevoTag), (r) => r.ok && setNuevoTag(null)); }}>
              <input className="tag-add-input" autoFocus value={nuevoTag} placeholder="Nueva etiqueta" onChange={(e) => setNuevoTag(e.target.value)}
                onBlur={() => !nuevoTag && setNuevoTag(null)} />
            </form>
          )}
        </div>
        <Toast resultado={tags.resultado?.ok ? null : tags.resultado} />
      </div>

      <div className="detail-block">
        <p className="detail-label">Etapa del pipeline</p>
        <p className="dcard-sub" style={{ margin: '0 0 8px' }}>
          {modo === 'vendedor' ? 'Marcá los pasos ya cumplidos con este lead' : 'Avance de este lead en el proceso'}
        </p>
        <div className="pipe-checklist">
          {etapas.map((s, i) => (
            <label key={s} className={`check-row${i < lead.etapa ? ' done' : i === lead.etapa ? ' current' : ''}`}>
              <input type="checkbox" checked={i <= lead.etapa} disabled={etapa.pendiente} onChange={(e) => alternarEtapa(i, e.target.checked)} /> {s}
            </label>
          ))}
        </div>
        {venta && <div className="toast">Venta registrada · {venta.vehiculo} · {venta.monto}</div>}
        <Toast resultado={etapa.resultado?.ok ? null : etapa.resultado} />
      </div>
    </div>
  );
}

function TabActividad({ detalle, nombres }: Props) {
  const { lead, mensajes, notas } = detalle;
  const [nota, setNota] = useState('');
  const accionNota = useAccion();
  const plantilla = useAccion();
  const primero = mensajes[0];
  const sinRespuesta = diasDesde(lead.ultimo_mensaje_at) >= 1;

  return (
    <div className="detail-pane active">
      <div className="detail-block">
        <p className="detail-label">Línea de tiempo</p>
        <div className="timeline">
          <div className="tl-item"><div className="tl-title">Primer contacto</div><div className="tl-time">{primero ? `${fechaCorta(primero.created_at)} ${horaLocal(primero.created_at)}` : '—'} · {lead.canal}</div></div>
          <div className="tl-item"><div className="tl-title">Etapa actual: {ETAPAS[lead.sector][lead.etapa]}</div><div className="tl-time">desde {horaBandeja(lead.etapa_actualizada_at)}</div></div>
          <div className="tl-item now"><div className="tl-title">Último mensaje</div><div className="tl-time">{horaBandeja(lead.ultimo_mensaje_at)} · {horaLocal(lead.ultimo_mensaje_at)}</div></div>
        </div>
        {sinRespuesta && (
          <div className="alert-card">
            <p className="alert-title">Alerta de recuperación</p>
            <p className="alert-sub">Sin nuevos mensajes desde hace {diasDesde(lead.ultimo_mensaje_at)} día(s). Corresponde enviar plantilla de seguimiento.</p>
            <button className="alert-btn" disabled={plantilla.pendiente} onClick={() => plantilla.ejecutar(() => usarPlantilla(lead.id))}>
              {plantilla.pendiente ? 'Enviando…' : 'Usar plantilla'}
            </button>
          </div>
        )}
        <Toast resultado={plantilla.resultado?.ok ? { ok: true, mensaje: 'Plantilla enviada.' } : plantilla.resultado} />
      </div>
      <div className="detail-block">
        <p className="detail-label">Notas internas</p>
        {notas.length ? notas.map((n) => (
          <div key={n.id} className="note-item">
            {n.texto}
            <div className="note-meta">{n.autor_id ? nombres.get(n.autor_id) : '—'} · {fechaCorta(n.created_at)} {horaLocal(n.created_at)}</div>
          </div>
        )) : <div className="note-box">Sin notas registradas.</div>}
        <form onSubmit={(e) => { e.preventDefault(); accionNota.ejecutar(() => agregarNota(lead.id, nota), (r) => r.ok && setNota('')); }}>
          <input className="note-input" placeholder="Agregar una nota… (Enter para guardar)" value={nota} onChange={(e) => setNota(e.target.value)} disabled={accionNota.pendiente} />
        </form>
        <Toast resultado={accionNota.resultado?.ok ? null : accionNota.resultado} />
      </div>
    </div>
  );
}

function TabRecordatorios({ detalle, yo }: Props) {
  const { lead, alertas, testDrives } = detalle;
  const [abierto, setAbierto] = useState(false);
  const [fecha, setFecha] = useState(fechaLocal());
  const [hora, setHora] = useState('10:00');
  const [mensaje, setMensaje] = useState('');
  const accion = useAccion();
  const borrar = useAccion();

  return (
    <div className="detail-pane active">
      <div className="detail-block">
        <p className="detail-label">Test drive y llamadas agendadas</p>
        {testDrives.length ? testDrives.map((t) => (
          <div key={t.id} className="agenda-item">
            <div className="agenda-icon">{Iconos.calendario}</div>
            <div>
              <div className="agenda-title">Test drive · {t.vehiculo}</div>
              <div className="agenda-sub">{fechaTurno(t.fecha)} · {horaCorta(t.hora)} · {t.estado === 'pendiente' ? 'pendiente de aprobación' : 'aprobado'}</div>
            </div>
          </div>
        )) : <Vacio>Nada agendado.</Vacio>}
      </div>
      <div className="detail-block">
        <p className="detail-label">Recordatorios de este lead</p>
        {alertas.length ? alertas.map((a) => (
          <div key={a.id} className="reminder-item">
            <div className="agenda-icon reminder-icon">{Iconos.campana}</div>
            <div style={{ flex: 1 }}>
              <div className="agenda-title">{a.mensaje}</div>
              <div className="agenda-sub">{fechaCorta(a.fecha)} · {horaLocal(a.fecha)}</div>
            </div>
            {a.owner_id === yo.id && (
              <button className="x-btn" title="Eliminar" disabled={borrar.pendiente} onClick={() => borrar.ejecutar(() => eliminarAlerta(a.id))}>✕</button>
            )}
          </div>
        )) : <Vacio>Sin recordatorios para este lead todavía.</Vacio>}
        <button className="tag-add" style={{ width: '100%', textAlign: 'center', marginTop: 6 }} onClick={() => setAbierto(!abierto)}>+ Crear recordatorio</button>
        {abierto && (
          <form style={{ marginTop: 12 }} onSubmit={(e) => {
            e.preventDefault();
            accion.ejecutar(() => crearAlerta({ fecha, hora, mensaje, leadId: lead.id }), (r) => { if (r.ok) { setMensaje(''); setAbierto(false); } });
          }}>
            <div className="form-grid" style={{ marginBottom: 9 }}>
              <div className="fld"><label>Fecha</label><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required /></div>
              <div className="fld"><label>Hora</label><input type="time" value={hora} onChange={(e) => setHora(e.target.value)} required /></div>
            </div>
            <div className="fld" style={{ marginBottom: 10 }}>
              <label>Mensaje del recordatorio</label>
              <input value={mensaje} onChange={(e) => setMensaje(e.target.value)} placeholder="Ej: llamar para confirmar entrega" required />
            </div>
            <button className="alert-btn" style={{ width: '100%' }} disabled={accion.pendiente}>Guardar recordatorio</button>
          </form>
        )}
        <Toast resultado={accion.resultado?.ok ? null : accion.resultado} />
      </div>
    </div>
  );
}
