'use client';

import { useMemo, useState } from 'react';
import { solicitarTurno } from '@/app/acciones/test-drives';
import { Calendario } from '@/components/calendario';
import { Toast, useAccion, Vacio } from '@/components/ui';
import { HORAS_TURNO } from '@/lib/constantes';
import { fechaLocal, fechaTexto, fechaTurno, horaLocal, tituloDia } from '@/lib/fechas';
import type { EstadoTurno, Sucursal, Turno, Usuario } from '@/lib/tipos';

const ESTADO: Record<EstadoTurno, { clase: string; texto: string }> = {
  pendiente: { clase: 'status-pendiente', texto: 'Pendiente' },
  aprobado: { clase: 'status-aprobado', texto: 'Aprobado' },
  rechazado: { clase: 'status-pendiente', texto: 'Rechazado' },
  realizado: { clase: 'status-hecho', texto: 'Realizado' },
};

export function AgendaTestDrive({ turnos, sucursales, modelos, leads, yo }: {
  turnos: Turno[];
  sucursales: Sucursal[];
  modelos: string[];
  leads: { id: number; nombre: string; telefono: string | null }[];
  yo: Usuario;
}) {
  const hoy = fechaLocal();
  const [mes, setMes] = useState(hoy.slice(0, 7));
  const [dia, setDia] = useState(hoy);
  const [sucursalId, setSucursalId] = useState(String(yo.sucursal_id ?? sucursales[0]?.id ?? ''));
  const [cliente, setCliente] = useState('');
  const [telefono, setTelefono] = useState('');
  const [leadId, setLeadId] = useState('');
  const { pendiente, resultado, ejecutar } = useAccion();

  const activos = useMemo(() => turnos.filter((t) => t.estado !== 'rechazado' && String(t.sucursal_id) === sucursalId), [turnos, sucursalId]);
  const delDia = activos.filter((t) => fechaLocal(t.fecha_hora) === dia);
  const misSolicitudes = turnos.filter((t) => t.vendedor_id === yo.id && fechaLocal(t.fecha_hora) >= hoy);
  const nombreSucursal = sucursales.find((s) => String(s.id) === sucursalId)?.nombre ?? '—';

  const elegirLead = (id: string) => {
    setLeadId(id);
    const l = leads.find((x) => String(x.id) === id);
    if (l) { setCliente(l.nombre); setTelefono(l.telefono ?? ''); }
  };

  return (
    <div className="dash">
      <div className="td-grid">
        <div className="dcard">
          <Calendario mes={mes} seleccionado={dia} conEventos={new Set(activos.map((t) => fechaLocal(t.fecha_hora)))} onSeleccionar={setDia} onCambiarMes={setMes} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="dcard">
            <h3>Turnos · {tituloDia(dia)}</h3>
            <p className="dcard-sub">Sucursal {nombreSucursal}</p>
            {delDia.length ? delDia.map((t) => (
              <div key={t.id} className="slot-row">
                <div className="slot-time">{horaLocal(t.fecha_hora)}</div>
                <div style={{ flex: 1 }}><div className="slot-veh">{t.vehiculo}</div><div className="slot-cli">{t.cliente_nombre}</div></div>
                <span className={`status-pill ${ESTADO[t.estado].clase}`}>{ESTADO[t.estado].texto}</span>
              </div>
            )) : <div className="empty-slots">Sin turnos reservados este día.</div>}
          </div>
          <div className="dcard">
            <h3>Solicitar turno</h3>
            <p className="dcard-sub">Queda pendiente de aprobación del administrador</p>
            <form action={(fd) => ejecutar(() => solicitarTurno(fd), (r) => { if (r.ok) { setCliente(''); setTelefono(''); setLeadId(''); } })}>
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
              <button className="send-btn" style={{ marginTop: 14, width: '100%', justifyContent: 'center', display: 'flex' }} disabled={pendiente || dia < hoy}>
                {dia < hoy ? 'Elegí un día a partir de hoy' : pendiente ? 'Solicitando…' : 'Solicitar turno'}
              </button>
              <Toast resultado={resultado} />
            </form>
          </div>
        </div>
      </div>
      <div className="dcard" style={{ marginTop: 18 }}>
        <h3>Mis próximas solicitudes</h3>
        <p className="dcard-sub">Estado de los turnos que pediste</p>
        {misSolicitudes.length ? misSolicitudes.map((t) => (
          <div key={t.id} className="td-req-row">
            <div className="td-req-date">{fechaTurno(fechaLocal(t.fecha_hora))}</div>
            <div className="td-req-info"><div className="td-req-veh">{t.vehiculo} · {t.cliente_nombre}</div><div className="td-req-sub">{horaLocal(t.fecha_hora)} · Sucursal {sucursales.find((s) => s.id === t.sucursal_id)?.nombre ?? '—'}</div></div>
            <span className={`status-pill ${ESTADO[t.estado].clase}`}>{ESTADO[t.estado].texto}</span>
          </div>
        )) : <Vacio>No tenés turnos próximos.</Vacio>}
      </div>
    </div>
  );
}
