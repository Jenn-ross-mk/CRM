'use client';

import { useState } from 'react';
import { cerrarAgenda, marcarTurnoRealizado, reagendarTurno } from '@/app/acciones/test-drives';
import { HORAS_TURNO, MOTIVOS_REAGENDA } from '@/lib/constantes';
import { fechaLocal, fechaMasDias, horaLocal } from '@/lib/fechas';
import type { Turno } from '@/lib/tipos';
import { Toast, useAccion } from './ui';

/**
 * Acciones sobre un agendamiento vigente: marcarlo realizado, reagendarlo (con motivo obligatorio) o cancelarlo.
 * El test drive pendiente de aprobación solo se puede reagendar; cancelarlo es tarea del supervisor.
 */
export function AccionesAgenda({ turno, compacto }: { turno: Turno; compacto?: boolean }) {
  const [reagendando, setReagendando] = useState(false);
  const accion = useAccion();
  if (turno.estado !== 'pendiente' && turno.estado !== 'aprobado') return null;
  const esTestDrive = turno.tipo === 'test_drive';
  const puedeRealizar = esTestDrive ? turno.estado === 'aprobado' : true;
  const estilo = { fontSize: compacto ? 10.5 : 11.5 };

  return (
    <div className="acciones-agenda">
      {!reagendando && (
        <div className="acciones-agenda-botones">
          {puedeRealizar && <button className="btn-link" style={estilo} disabled={accion.pendiente} onClick={() => accion.ejecutar(() => marcarTurnoRealizado(turno.id))}>Marcar realizado</button>}
          <button className="btn-link" style={estilo} onClick={() => { setReagendando(true); accion.limpiar(); }}>Reagendar</button>
          {!esTestDrive && <button className="btn-link" style={{ ...estilo, color: 'var(--slate)' }} disabled={accion.pendiente} onClick={() => accion.ejecutar(() => cerrarAgenda(turno.id, 'rechazado'))}>Cancelar</button>}
        </div>
      )}
      {reagendando && <FormReagendar turno={turno} onListo={() => setReagendando(false)} />}
      <Toast resultado={accion.resultado?.ok ? null : accion.resultado} />
    </div>
  );
}

function FormReagendar({ turno, onListo }: { turno: Turno; onListo: () => void }) {
  const esTestDrive = turno.tipo === 'test_drive';
  const hoy = fechaLocal();
  const [motivo, setMotivo] = useState('');
  const [fecha, setFecha] = useState(fechaLocal(turno.fecha_hora) > hoy ? fechaLocal(turno.fecha_hora) : fechaMasDias(hoy, 1));
  const [hora, setHora] = useState(esTestDrive ? (HORAS_TURNO.includes(horaLocal(turno.fecha_hora)) ? horaLocal(turno.fecha_hora) : HORAS_TURNO[0]) : horaLocal(turno.fecha_hora));
  const accion = useAccion();

  return (
    <form className="form-reagendar" onSubmit={(e) => {
      e.preventDefault();
      accion.ejecutar(() => reagendarTurno(turno.id, { fecha, hora, motivo }), (r) => r.ok && onListo());
    }}>
      <div className="fld">
        <label>Motivo del reagendamiento</label>
        <select value={motivo} onChange={(e) => setMotivo(e.target.value)} required>
          <option value="" disabled>Elegí un motivo</option>
          {MOTIVOS_REAGENDA.map((m) => <option key={m.valor} value={m.valor}>{m.etiqueta}</option>)}
        </select>
      </div>
      <div className="form-grid" style={{ marginTop: 8 }}>
        <div className="fld"><label>Nueva fecha</label><input type="date" value={fecha} min={hoy} onChange={(e) => setFecha(e.target.value)} required /></div>
        <div className="fld"><label>Hora</label>
          {esTestDrive
            ? <select value={hora} onChange={(e) => setHora(e.target.value)}>{HORAS_TURNO.map((h) => <option key={h}>{h}</option>)}</select>
            : <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} required />}
        </div>
      </div>
      {esTestDrive && <p className="dcard-sub" style={{ margin: '8px 0 0' }}>El test drive vuelve a quedar pendiente de aprobación.</p>}
      <div className="acciones-agenda-botones" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
        <button type="button" className="btn-link" onClick={onListo}>Cancelar</button>
        <button className="alert-btn" disabled={accion.pendiente || !motivo}>{accion.pendiente ? 'Reagendando…' : 'Reagendar'}</button>
      </div>
      <Toast resultado={accion.resultado?.ok ? null : accion.resultado} />
    </form>
  );
}
