'use client';

import { useState } from 'react';
import { crearAlerta, eliminarAlerta } from '@/app/acciones/alertas';
import { actualizarDatosLead, agregarEtiqueta, agregarNota, cambiarEtapa, quitarEtiqueta, reasignarLead, usarPlantilla } from '@/app/acciones/leads';
import { ETIQUETA_CANAL, FORMAS_PAGO, etapasDe, etiquetaFormaPago, ordenEtapa, ordenFinal } from '@/lib/constantes';
import type { DetalleLead } from '@/lib/datos';
import { diasDesde, fechaCorta, fechaLocal, fechaTurno, horaBandeja, horaLocal } from '@/lib/fechas';
import type { Usuario } from '@/lib/tipos';
import { Iconos } from '../iconos';
import { Toast, useAccion, Vacio } from '../ui';
import type { PropsBandeja } from './bandeja';

type Props = PropsBandeja & { detalle: DetalleLead; porId: Map<number, Usuario>; sucursalNombre: Map<number, string>; onVolver?: () => void };

export function PanelDetalle(props: Props) {
  const [tab, setTab] = useState<'info' | 'actividad' | 'recordatorios'>('info');
  const { detalle } = props;
  return (
    <div className="detail">
      <button className="movil-volver-chat solo-tablet" onClick={props.onVolver}>‹ Volver al chat</button>
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

const Campo = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="field-row"><span className="field-key">{k}</span><span className="field-val">{v}</span></div>
);

function TabInfo({ detalle, modo, usuarios, yo, misSucursales, sucursalNombre, modelos, etapas: todasLasEtapas, etiquetas: catalogo, porId }: Props) {
  const { lead, venta, etiquetas } = detalle;
  const etapas = etapasDe(todasLasEtapas, lead.sector);
  const actual = ordenEtapa(todasLasEtapas, lead.etapa_id);
  const final = ordenFinal(todasLasEtapas, lead.sector);
  const [editando, setEditando] = useState(false);
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState<string | null>(null);
  const datos = useAccion();
  const tags = useAccion();
  const etapa = useAccion();
  const reasignar = useAccion();
  const esAdmin = yo.rol === 'admin';

  const opcionesReasignar = usuarios.filter((u) =>
    u.activo && u.id !== lead.vendedor_id && (u.rol === 'vendedor' || u.rol === 'admin' || u.id === yo.id) &&
    (esAdmin || u.id === yo.id || (u.sucursal_id !== null && misSucursales.includes(u.sucursal_id)))
  );
  const [destino, setDestino] = useState(String(opcionesReasignar[0]?.id ?? ''));
  const disponibles = catalogo.filter((c) => !etiquetas.some((e) => e.id === c.id));

  const alternarEtapa = (orden: number, marcado: boolean) => {
    const nueva = marcado ? orden : Math.max(1, orden - 1);
    const nombre = etapas.find((x) => x.orden === final)?.nombre;
    if (nueva === final && !confirm(`¿Marcar a ${lead.nombre} como "${nombre}"? Se va a registrar la venta.`)) return;
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
            <div className="fld" style={{ marginBottom: 8 }}><label>Nombre del cliente</label><input name="nombre_cliente" defaultValue={lead.nombre_cliente ?? ''} placeholder={lead.nombre} /></div>
            <div className="fld" style={{ marginBottom: 8 }}>
              <label>Vehículo de interés</label>
              <input name="vehiculo_interes" list="lista-modelos" defaultValue={lead.vehiculo_interes ?? ''} />
              <datalist id="lista-modelos">{modelos.map((m) => <option key={m} value={m} />)}</datalist>
            </div>
            <div className="fld" style={{ marginBottom: 8 }}><label>Forma de pago</label>
              <select name="forma_pago" defaultValue={lead.forma_pago ?? ''}><option value="">A definir</option>{FORMAS_PAGO.map((f) => <option key={f.valor} value={f.valor}>{f.etiqueta}</option>)}</select>
            </div>
            <div className="fld" style={{ marginBottom: 8 }}><label>Monto / capital</label><input name="monto_capital" defaultValue={lead.monto_capital ?? ''} /></div>
            <div className="fld" style={{ marginBottom: 10 }}><label>Prioridad</label>
              <select name="prioridad" defaultValue={lead.prioridad}><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></select>
            </div>
            <button className="alert-btn" style={{ width: '100%' }} disabled={datos.pendiente}>Guardar</button>
            <Toast resultado={datos.resultado?.ok ? null : datos.resultado} />
          </form>
        ) : (
          <>
            <Campo k="Vehículo de interés" v={lead.vehiculo_interes ?? '—'} />
            <Campo k="Forma de pago" v={etiquetaFormaPago(lead.forma_pago)} />
            <Campo k="Monto / capital" v={lead.monto_capital ?? '—'} />
            {lead.clasificacion && <Campo k="Temperatura" v={lead.clasificacion} />}
            {lead.localidad && <Campo k="Localidad" v={lead.localidad} />}
            <Campo k="Sucursal" v={lead.sucursal_id ? sucursalNombre.get(lead.sucursal_id) : '—'} />
            {modo === 'gestion' && <Campo k="Vendedor asignado" v={lead.vendedor_id ? porId.get(lead.vendedor_id)?.nombre : 'Sin asignar'} />}
            {lead.contexto_conversacion && <p className="dcard-sub" style={{ margin: '8px 0 0' }}>{lead.contexto_conversacion}</p>}
          </>
        )}
      </div>

      {modo === 'gestion' && (
        <div className="detail-block" style={{ paddingTop: 4 }}>
          <div className="fld">
            <label>{lead.vendedor_id ? 'Reasignar a' : 'Asignar a'}</label>
            <select value={destino} onChange={(e) => setDestino(e.target.value)}>
              {opcionesReasignar.map((u) => <option key={u.id} value={u.id}>{u.nombre}{u.id === yo.id ? ' (yo)' : ''}</option>)}
            </select>
          </div>
          <button className="alert-btn" style={{ width: '100%', marginTop: 9 }} disabled={reasignar.pendiente || !destino}
            onClick={() => reasignar.ejecutar(() => reasignarLead(lead.id, Number(destino)))}>
            {lead.vendedor_id ? 'Reasignar conversación' : 'Asignar conversación'}
          </button>
          {lead.modo === 'bot' && <p className="dcard-sub" style={{ margin: '6px 0 0' }}>Al asignarla, el bot deja de responder en esta conversación.</p>}
          <Toast resultado={reasignar.resultado} />
        </div>
      )}

      <div className="detail-block">
        <p className="detail-label">Etiquetas</p>
        <div className="tag-row">
          {etiquetas.map((t, i) => (
            <span key={t.id} className={`tag ${i === 0 ? 'tag-navy' : 'tag-charcoal'}`} style={t.color ? { background: t.color } : undefined}>
              {t.nombre}
              <span className="tag-x" title="Quitar" onClick={() => tags.ejecutar(() => quitarEtiqueta(lead.id, t.id))}>✕</span>
            </span>
          ))}
          {nuevaEtiqueta === null ? (
            <button className="tag-add" onClick={() => setNuevaEtiqueta('')}>+ Agregar</button>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); tags.ejecutar(() => agregarEtiqueta(lead.id, nuevaEtiqueta), (r) => r.ok && setNuevaEtiqueta(null)); }}>
              <input className="tag-add-input" autoFocus list="lista-etiquetas" value={nuevaEtiqueta}
                placeholder={esAdmin ? 'Elegir o crear' : 'Elegir etiqueta'} onChange={(e) => setNuevaEtiqueta(e.target.value)}
                onBlur={() => !nuevaEtiqueta && setNuevaEtiqueta(null)} />
              <datalist id="lista-etiquetas">{disponibles.map((c) => <option key={c.id} value={c.nombre} />)}</datalist>
            </form>
          )}
        </div>
        <Toast resultado={tags.resultado?.ok ? null : tags.resultado} />
      </div>

      <div className="detail-block">
        <p className="detail-label">Etapa del pipeline</p>
        {etapas.length ? (
          <>
            <p className="dcard-sub" style={{ margin: '0 0 8px' }}>
              {modo === 'vendedor' ? 'Marcá los pasos ya cumplidos con este lead' : 'Avance de este lead en el proceso'}
            </p>
            <div className="pipe-checklist">
              {etapas.map((s) => (
                <label key={s.id} className={`check-row${s.orden < actual ? ' done' : s.orden === actual ? ' current' : ''}`}>
                  <input type="checkbox" checked={s.orden <= actual} disabled={etapa.pendiente || s.orden === 1} onChange={(e) => alternarEtapa(s.orden, e.target.checked)} /> {s.nombre}
                </label>
              ))}
            </div>
          </>
        ) : <Vacio>Este sector todavía no tiene etapas cargadas.</Vacio>}
        {venta && <div className="toast">Venta registrada · {venta.vehiculo}</div>}
        <Toast resultado={etapa.resultado?.ok ? null : etapa.resultado} />
      </div>
    </div>
  );
}

function TabActividad({ detalle, porId, etapas }: Props) {
  const { lead, mensajes, notas } = detalle;
  const [nota, setNota] = useState('');
  const accionNota = useAccion();
  const plantilla = useAccion();
  const primero = mensajes[0];
  const sinRespuesta = lead.vendedor_id !== null && diasDesde(lead.ultimo_mensaje_en) >= 1;
  const etapaActual = etapas.find((e) => e.id === lead.etapa_id)?.nombre ?? 'Nuevo';

  return (
    <div className="detail-pane active">
      <div className="detail-block">
        <p className="detail-label">Línea de tiempo</p>
        <div className="timeline">
          <div className="tl-item"><div className="tl-title">Primer contacto</div><div className="tl-time">{primero ? `${fechaCorta(primero.creado_en)} ${horaLocal(primero.creado_en)}` : '—'} · {ETIQUETA_CANAL[lead.canal] ?? lead.canal}</div></div>
          {lead.derivado_en && <div className="tl-item"><div className="tl-title">Derivado a un vendedor</div><div className="tl-time">{fechaCorta(lead.derivado_en)} {horaLocal(lead.derivado_en)}</div></div>}
          <div className="tl-item"><div className="tl-title">Etapa actual: {etapaActual}</div><div className="tl-time">desde {horaBandeja(lead.etapa_actualizada_en)}</div></div>
          <div className="tl-item now"><div className="tl-title">Último mensaje</div><div className="tl-time">{horaBandeja(lead.ultimo_mensaje_en)} · {horaLocal(lead.ultimo_mensaje_en)}</div></div>
        </div>
        {sinRespuesta && (
          <div className="alert-card">
            <p className="alert-title">Alerta de recuperación</p>
            <p className="alert-sub">Sin nuevos mensajes desde hace {diasDesde(lead.ultimo_mensaje_en)} día(s). Corresponde enviar plantilla de seguimiento.</p>
            <button className="alert-btn" disabled={plantilla.pendiente} onClick={() => plantilla.ejecutar(() => usarPlantilla(lead.id))}>
              {plantilla.pendiente ? 'Enviando…' : 'Usar plantilla'}
            </button>
          </div>
        )}
        <Toast resultado={plantilla.resultado?.ok ? { ok: true, mensaje: 'Plantilla registrada (pendiente de envío).' } : plantilla.resultado} />
      </div>
      <div className="detail-block">
        <p className="detail-label">Notas internas</p>
        {notas.length ? notas.map((n) => (
          <div key={n.id} className="note-item">
            {n.texto}
            <div className="note-meta">{porId.get(n.usuario_id)?.nombre ?? '—'} · {fechaCorta(n.creado_en)} {horaLocal(n.creado_en)}</div>
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
  const { lead, alertas, turnos } = detalle;
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
        {turnos.length ? turnos.map((t) => (
          <div key={t.id} className="agenda-item">
            <div className="agenda-icon">{Iconos.calendario}</div>
            <div>
              <div className="agenda-title">Test drive · {t.vehiculo}</div>
              <div className="agenda-sub">{fechaTurno(fechaLocal(t.fecha_hora))} · {horaLocal(t.fecha_hora)} · {t.estado === 'pendiente' ? 'pendiente de aprobación' : 'aprobado'}</div>
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
              <div className="agenda-sub">{fechaCorta(a.fecha_hora)} · {horaLocal(a.fecha_hora)}</div>
            </div>
            {a.usuario_id === yo.id && (
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
