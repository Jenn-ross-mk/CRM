'use client';

import { useMemo, useState } from 'react';
import { marcarAlertaHecha } from '@/app/acciones/alertas';
import { agendarContacto, cerrarAgenda, solicitarTurno } from '@/app/acciones/test-drives';
import { Calendario } from '@/components/calendario';
import { Toast, useAccion, Vacio } from '@/components/ui';
import { ETIQUETA_TIPO_TURNO, HORAS_TURNO } from '@/lib/constantes';
import type { AlertaHoy } from '@/lib/datos';
import { fechaLocal, fechaTexto, fechaTurno, horaLocal, tituloDia } from '@/lib/fechas';
import type { EstadoTurno, Sucursal, TipoTurno, Turno, Usuario } from '@/lib/tipos';

const ESTADO: Record<EstadoTurno, { clase: string; texto: string }> = {
  pendiente: { clase: 'status-pendiente', texto: 'Pendiente' },
  aprobado: { clase: 'status-aprobado', texto: 'Aprobado' },
  rechazado: { clase: 'status-pendiente', texto: 'Rechazado' },
  hecho: { clase: 'status-hecho', texto: 'Realizado' },
};
/** Llamadas y visitas no se aprueban: mientras están "pendiente" están agendadas; "rechazado" es cancelada. */
const estadoDe = (t: Turno) =>
  t.tipo === 'test_drive' ? ESTADO[t.estado]
    : t.estado === 'pendiente' ? { clase: 'status-aprobado', texto: 'Agendada' }
    : t.estado === 'rechazado' ? { clase: 'status-pendiente', texto: 'Cancelada' } : ESTADO.hecho;

type Lead = { id: number; nombre: string; telefono: string | null };

export function Agendamientos({ turnos, alertasHoy, sucursales, modelos, leads, yo }: {
  turnos: Turno[];
  alertasHoy: AlertaHoy[];
  sucursales: Sucursal[];
  modelos: string[];
  leads: Lead[];
  yo: Usuario;
}) {
  const hoy = fechaLocal();
  const [mes, setMes] = useState(hoy.slice(0, 7));
  const [dia, setDia] = useState(hoy);
  const [tipo, setTipo] = useState<TipoTurno>('test_drive');
  const [sucursalId, setSucursalId] = useState(String(yo.sucursal_id ?? sucursales[0]?.id ?? ''));
  const accion = useAccion();

  // Test drives de la sucursal elegida (de todos, para ver qué horarios están tomados) + mis llamadas y visitas.
  const visibles = useMemo(() => turnos.filter((t) => t.estado !== 'rechazado' &&
    (t.tipo === 'test_drive' ? String(t.sucursal_id) === sucursalId : t.vendedor_id === yo.id)), [turnos, sucursalId, yo.id]);
  const delDia = visibles.filter((t) => fechaLocal(t.fecha_hora) === dia);
  const misProximos = turnos.filter((t) => t.vendedor_id === yo.id && fechaLocal(t.fecha_hora) >= hoy);
  const nombreSucursal = sucursales.find((s) => String(s.id) === sucursalId)?.nombre ?? '—';

  return (
    <div className="dash">
      {alertasHoy.length > 0 && <AlertasHoy alertas={alertasHoy} />}
      <div className="td-grid">
        <div className="dcard">
          <Calendario mes={mes} seleccionado={dia} conEventos={new Set(visibles.map((t) => fechaLocal(t.fecha_hora)))} onSeleccionar={setDia} onCambiarMes={setMes} />
          <div className="fld" style={{ marginTop: 14 }}>
            <label>Sucursal (test drives)</label>
            <select value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
              {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="dcard">
            <h3>Agenda · {tituloDia(dia)}</h3>
            <p className="dcard-sub">Test drives de la sucursal {nombreSucursal} y tus llamadas y visitas</p>
            {delDia.length ? delDia.map((t) => (
              <div key={t.id} className="slot-row">
                <div className="slot-time">{horaLocal(t.fecha_hora)}</div>
                <div style={{ flex: 1 }}>
                  <div className="slot-veh"><span className={`tipo-agenda tipo-${t.tipo}`}>{ETIQUETA_TIPO_TURNO[t.tipo]}</span>{t.tipo === 'test_drive' ? t.vehiculo : t.cliente_nombre}</div>
                  {t.tipo === 'test_drive' && <div className="slot-cli">{t.cliente_nombre}</div>}
                </div>
                <span className={`status-pill ${estadoDe(t).clase}`}>{estadoDe(t).texto}</span>
              </div>
            )) : <div className="empty-slots">Nada agendado este día.</div>}
          </div>

          <div className="dcard">
            <h3>Nuevo agendamiento</h3>
            <div className="rank-toggle" style={{ margin: '4px 0 12px' }} role="radiogroup" aria-label="Tipo de agendamiento">
              {(['test_drive', 'llamada', 'visita'] as TipoTurno[]).map((t) => (
                <div key={t} role="radio" aria-checked={tipo === t} tabIndex={0} className={`rtog${tipo === t ? ' active' : ''}`}
                  onClick={() => { setTipo(t); accion.limpiar(); }} onKeyDown={(e) => e.key === 'Enter' && setTipo(t)}>{ETIQUETA_TIPO_TURNO[t]}</div>
              ))}
            </div>
            {tipo === 'test_drive'
              ? <FormTestDrive dia={dia} hoy={hoy} sucursalId={sucursalId} setSucursalId={setSucursalId} sucursales={sucursales} modelos={modelos} leads={leads} accion={accion} />
              : <FormContacto key={tipo} tipo={tipo} dia={dia} hoy={hoy} leads={leads} accion={accion} />}
          </div>
        </div>
      </div>

      <div className="dcard" style={{ marginTop: 18 }}>
        <h3>Mis próximos agendamientos</h3>
        <p className="dcard-sub">Cada uno genera una alerta para ese día (el test drive, cuando se aprueba)</p>
        {misProximos.length ? misProximos.map((t) => <FilaAgendamiento key={t.id} t={t} sucursales={sucursales} />) : <Vacio>No tenés agendamientos próximos.</Vacio>}
      </div>
    </div>
  );
}

type Accion = ReturnType<typeof useAccion>;

function FormTestDrive({ dia, hoy, sucursalId, setSucursalId, sucursales, modelos, leads, accion }: {
  dia: string; hoy: string; sucursalId: string; setSucursalId: (v: string) => void; sucursales: Sucursal[]; modelos: string[]; leads: Lead[]; accion: Accion;
}) {
  const [cliente, setCliente] = useState('');
  const [telefono, setTelefono] = useState('');
  const [leadId, setLeadId] = useState('');
  const elegirLead = (id: string) => {
    setLeadId(id);
    const l = leads.find((x) => String(x.id) === id);
    if (l) { setCliente(l.nombre); setTelefono(l.telefono ?? ''); }
  };
  return (
    <form action={(fd) => accion.ejecutar(() => solicitarTurno(fd), (r) => { if (r.ok) { setCliente(''); setTelefono(''); setLeadId(''); } })}>
      <p className="dcard-sub" style={{ marginTop: 0 }}>Queda pendiente de aprobación. La alerta se crea cuando se aprueba.</p>
      <input type="hidden" name="fecha" value={dia} />
      <input type="hidden" name="lead_id" value={leadId} />
      <div className="form-grid">
        <div className="fld"><label>Vehículo</label><select name="vehiculo">{modelos.map((m) => <option key={m}>{m}</option>)}</select></div>
        <div className="fld"><label>Sucursal</label>
          <select name="sucursal_id" value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
            {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <div className="fld" style={{ gridColumn: '1/-1' }}><label>Lead (opcional)</label>
          <select value={leadId} onChange={(e) => elegirLead(e.target.value)}>
            <option value="">Cliente sin lead en el CRM</option>
            {leads.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
          </select>
        </div>
        <div className="fld"><label>Cliente</label><input name="cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nombre del cliente" /></div>
        <div className="fld"><label>Teléfono</label><input name="telefono" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Ej: 2974123456" /></div>
        <div className="fld"><label>Fecha</label><input readOnly value={fechaTexto(dia)} /></div>
        <div className="fld"><label>Hora</label><select name="hora">{HORAS_TURNO.map((h) => <option key={h}>{h}</option>)}</select></div>
      </div>
      <button className="send-btn" style={{ marginTop: 14, width: '100%', justifyContent: 'center', display: 'flex' }} disabled={accion.pendiente || dia < hoy}>
        {dia < hoy ? 'Elegí un día a partir de hoy' : accion.pendiente ? 'Solicitando…' : 'Solicitar test drive'}
      </button>
      <Toast resultado={accion.resultado} />
    </form>
  );
}

function FormContacto({ tipo, dia, hoy, leads, accion }: { tipo: TipoTurno; dia: string; hoy: string; leads: Lead[]; accion: Accion }) {
  const [leadId, setLeadId] = useState('');
  const [hora, setHora] = useState('10:00');
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      accion.ejecutar(() => agendarContacto(Number(leadId), { tipo, fecha: dia, hora }), (r) => r.ok && setLeadId(''));
    }}>
      <p className="dcard-sub" style={{ marginTop: 0 }}>No necesita aprobación. Se crea una alerta para ese día.</p>
      <div className="form-grid">
        <div className="fld" style={{ gridColumn: '1/-1' }}><label>Lead</label>
          <select value={leadId} onChange={(e) => setLeadId(e.target.value)} required>
            <option value="" disabled>Elegí el lead</option>
            {leads.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
          </select>
        </div>
        <div className="fld"><label>Fecha</label><input readOnly value={fechaTexto(dia)} /></div>
        <div className="fld"><label>Hora</label><input type="time" value={hora} onChange={(e) => setHora(e.target.value)} required /></div>
      </div>
      <button className="send-btn" style={{ marginTop: 14, width: '100%', justifyContent: 'center', display: 'flex' }} disabled={accion.pendiente || dia < hoy || !leadId}>
        {dia < hoy ? 'Elegí un día a partir de hoy' : accion.pendiente ? 'Agendando…' : `Agendar ${ETIQUETA_TIPO_TURNO[tipo].toLowerCase()}`}
      </button>
      <Toast resultado={accion.resultado} />
    </form>
  );
}

function FilaAgendamiento({ t, sucursales }: { t: Turno; sucursales: Sucursal[] }) {
  const marcar = useAccion();
  const estado = estadoDe(t);
  const detalle = t.tipo === 'test_drive' ? ` · Sucursal ${sucursales.find((s) => s.id === t.sucursal_id)?.nombre ?? '—'}` : '';
  return (
    <div className="td-req-row">
      <div className="td-req-date">{fechaTurno(fechaLocal(t.fecha_hora))}</div>
      <div className="td-req-info">
        <div className="td-req-veh"><span className={`tipo-agenda tipo-${t.tipo}`}>{ETIQUETA_TIPO_TURNO[t.tipo]}</span>{t.tipo === 'test_drive' ? `${t.vehiculo} · ` : ''}{t.cliente_nombre}</div>
        <div className="td-req-sub">{horaLocal(t.fecha_hora)}{detalle}</div>
        {t.tipo !== 'test_drive' && t.estado === 'pendiente' && (
          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            <button className="btn-link" style={{ fontSize: 10.5 }} disabled={marcar.pendiente} onClick={() => marcar.ejecutar(() => cerrarAgenda(t.id, 'hecho'))}>Marcar realizada</button>
            <button className="btn-link" style={{ fontSize: 10.5, color: 'var(--slate)' }} disabled={marcar.pendiente} onClick={() => marcar.ejecutar(() => cerrarAgenda(t.id, 'rechazado'))}>Cancelar</button>
          </div>
        )}
        <Toast resultado={marcar.resultado?.ok ? null : marcar.resultado} />
      </div>
      <span className={`status-pill ${estado.clase}`}>{estado.texto}</span>
    </div>
  );
}

/** Alertas de hoy sin resolver: lo mismo que cuenta el ícono rojo de la pestaña. */
function AlertasHoy({ alertas }: { alertas: AlertaHoy[] }) {
  const accion = useAccion();
  const listo = (a: AlertaHoy) =>
    a.turno_id && a.turno && a.turno.tipo !== 'test_drive' ? cerrarAgenda(a.turno_id, 'hecho') : marcarAlertaHecha(a.id);
  return (
    <div className="dcard alertas-hoy" style={{ marginBottom: 18 }}>
      <h3><span className="punto-rojo" aria-hidden="true" />Para hoy · {alertas.length}</h3>
      <p className="dcard-sub">Marcalas cuando las resuelvas: el ícono rojo de la pestaña se apaga cuando no queda ninguna.</p>
      {alertas.map((a) => (
        <div key={a.id} className="slot-row">
          <div className="slot-time">{horaLocal(a.fecha_hora)}</div>
          <div style={{ flex: 1 }}><div className="slot-veh">{a.mensaje}</div></div>
          <button className="mini-btn mini-btn-approve" disabled={accion.pendiente} onClick={() => accion.ejecutar(() => listo(a))}>Listo</button>
        </div>
      ))}
      <Toast resultado={accion.resultado?.ok ? null : accion.resultado} />
    </div>
  );
}
