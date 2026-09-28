'use client';

import { useMemo, useState } from 'react';
import { crearAlerta, eliminarAlerta, marcarAlertaHecha } from '@/app/acciones/alertas';
import { agendarContacto, solicitarTurno } from '@/app/acciones/test-drives';
import { AccionesAgenda } from '@/components/acciones-agenda';
import { Calendario } from '@/components/calendario';
import { Toast, useAccion, Vacio } from '@/components/ui';
import { ETIQUETA_TIPO_TURNO, HORAS_TURNO } from '@/lib/constantes';
import { fechaLocal, fechaTexto, fechaTurno, horaLocal, tituloDia } from '@/lib/fechas';
import type { Alerta, Sucursal, TipoTurno, Turno, Usuario } from '@/lib/tipos';

type Lead = { id: number; nombre: string; telefono: string | null };
type Tipo = TipoTurno | 'nota';

const ETIQUETA: Record<Tipo, string> = { nota: 'Nota', ...ETIQUETA_TIPO_TURNO };
const TIPOS_FORM: { valor: Tipo; etiqueta: string }[] = [
  { valor: 'nota', etiqueta: 'Nota libre' },
  { valor: 'test_drive', etiqueta: 'Test drive' },
  { valor: 'llamada', etiqueta: 'Llamada' },
  { valor: 'visita', etiqueta: 'Visita' },
];

/** Un renglón de la agenda: un agendamiento (test drive, llamada, visita) o una nota libre. */
interface Item {
  clave: string;
  fechaHora: string;
  tipo: Tipo;
  titulo: string;
  detalle: string | null;
  estado: { clase: string; texto: string } | null;
  /** Alerta sin resolver de ese renglón (la que cuenta en el ícono rojo cuando es de hoy). */
  alertaPendiente: Alerta | null;
  turno: Turno | null;
  nota: Alerta | null;
}

function estadoTurno(t: Turno): Item['estado'] {
  if (t.tipo === 'test_drive') {
    return t.estado === 'aprobado' ? { clase: 'status-aprobado', texto: 'Aprobado' }
      : t.estado === 'hecho' ? { clase: 'status-hecho', texto: 'Realizado' }
      : { clase: 'status-pendiente', texto: 'Pendiente de aprobación' };
  }
  return t.estado === 'hecho' ? { clase: 'status-hecho', texto: 'Realizada' } : { clase: 'status-aprobado', texto: 'Agendada' };
}
const vencido = (t: Turno, hoy: string) => (t.estado === 'pendiente' || t.estado === 'aprobado') && fechaLocal(t.fecha_hora) < hoy;

export function Agendamientos({ turnos, alertas, sucursales, modelos, leads, yo }: {
  turnos: Turno[];
  alertas: Alerta[];
  sucursales: Sucursal[];
  modelos: string[];
  leads: Lead[];
  yo: Usuario;
}) {
  const hoy = fechaLocal();
  const [mes, setMes] = useState(hoy.slice(0, 7));
  const [dia, setDia] = useState(hoy);
  const [tipo, setTipo] = useState<Tipo>('nota');
  const accion = useAccion();
  const nombreLead = useMemo(() => new Map(leads.map((l) => [l.id, l.nombre])), [leads]);

  // Todo lo propio en una sola lista: agendamientos vigentes y notas libres (las alertas que no nacen de un agendamiento).
  const items = useMemo<Item[]>(() => {
    const porTurno = new Map(alertas.filter((a) => a.turno_id).map((a) => [a.turno_id!, a]));
    const deTurnos = turnos.filter((t) => t.vendedor_id === yo.id && t.estado !== 'rechazado').map((t): Item => {
      const alerta = porTurno.get(t.id);
      return {
        clave: `t${t.id}`, fechaHora: t.fecha_hora, tipo: t.tipo, turno: t, nota: null,
        titulo: t.tipo === 'test_drive' ? `${t.vehiculo ?? 'Test drive'} · ${t.cliente_nombre}` : t.cliente_nombre,
        detalle: t.tipo === 'test_drive' ? `Sucursal ${sucursales.find((s) => s.id === t.sucursal_id)?.nombre ?? '—'}` : null,
        estado: estadoTurno(t),
        alertaPendiente: alerta && !alerta.leida ? alerta : null,
      };
    });
    const notas = alertas.filter((a) => !a.turno_id).map((a): Item => ({
      clave: `a${a.id}`, fechaHora: a.fecha_hora, tipo: 'nota', turno: null, nota: a,
      titulo: a.mensaje,
      detalle: a.lead_id ? nombreLead.get(a.lead_id) ?? 'Lead' : null,
      estado: a.leida ? { clase: 'status-hecho', texto: 'Hecha' } : null,
      alertaPendiente: a.leida ? null : a,
    }));
    return [...deTurnos, ...notas].sort((x, y) => x.fechaHora.localeCompare(y.fechaHora));
  }, [turnos, alertas, yo.id, sucursales, nombreLead]);

  const delDia = items.filter((i) => fechaLocal(i.fechaHora) === dia);
  const pendientesHoy = items.filter((i) => fechaLocal(i.fechaHora) === hoy && i.alertaPendiente).length;
  const proximos = items.filter((i) => fechaLocal(i.fechaHora) > hoy);
  const proximosPorDia = proximos.reduce<Map<string, Item[]>>((m, i) => m.set(fechaLocal(i.fechaHora), [...(m.get(fechaLocal(i.fechaHora)) ?? []), i]), new Map());
  const esHoy = dia === hoy;
  // Agendamientos cuya fecha ya pasó y siguen abiertos: hay que marcarlos realizados o reagendarlos (si no, el cliente queda en Pendientes).
  const paraReagendar = items.filter((i) => i.turno && vencido(i.turno, hoy));

  return (
    <div className="dash">
      {paraReagendar.length > 0 && (
        <div className="dcard alertas-hoy" style={{ marginBottom: 18 }}>
          <h3><span className="punto-rojo" aria-hidden="true" />Para reagendar · {paraReagendar.length}</h3>
          <p className="dcard-sub">Ya pasó la fecha y no se marcaron realizados. Mientras no se reagenden, el cliente queda en Pendientes del Panel general.</p>
          {paraReagendar.map((i) => (
            <div key={i.clave} className="agenda-grupo">
              <span className="agenda-grupo-dia" style={{ cursor: 'default' }}>{fechaTurno(fechaLocal(i.fechaHora))}</span>
              <div style={{ flex: 1, minWidth: 0 }}><Renglon item={i} hoy={hoy} /></div>
            </div>
          ))}
        </div>
      )}
      <div className="td-grid">
        <div className="dcard">
          <Calendario mes={mes} seleccionado={dia} conEventos={new Set(items.map((i) => fechaLocal(i.fechaHora)))} onSeleccionar={setDia} onCambiarMes={setMes} />
          <div className="agenda-leyenda">
            {(['nota', 'test_drive', 'llamada', 'visita'] as Tipo[]).map((t) => (
              <span key={t}><i className={`leyenda-color tipo-${t}`} />{ETIQUETA[t]}</span>
            ))}
          </div>
        </div>

        <div className="dcard">
          <h3>
            {esHoy && pendientesHoy > 0 && <span className="punto-rojo" aria-hidden="true" />}
            {esHoy ? 'Hoy' : 'Tu día'} · {tituloDia(dia)}
          </h3>
          <p className="dcard-sub">
            {esHoy
              ? pendientesHoy ? `${pendientesHoy} sin resolver. Marcalos con "Listo": el ícono rojo de la pestaña se apaga cuando no queda ninguno.` : 'Todo lo de hoy está resuelto.'
              : 'Todo lo que tenés ese día, ordenado por hora.'}
          </p>
          {delDia.length ? delDia.map((i) => <Renglon key={i.clave} item={i} hoy={hoy} />) : <div className="empty-slots">Nada para este día. Agregá una nota o un agendamiento abajo.</div>}
        </div>
      </div>

      <div className="dcard" style={{ marginTop: 18 }}>
        <h3>Agregar al {tituloDia(dia)}</h3>
        <p className="dcard-sub">Elegí el día en el calendario y qué querés agendar. Todo genera una alerta para ese día.</p>
        <div className="rank-toggle" style={{ margin: '0 0 14px' }} role="radiogroup" aria-label="Qué agendar">
          {TIPOS_FORM.map((t) => (
            <div key={t.valor} role="radio" aria-checked={tipo === t.valor} tabIndex={0} className={`rtog${tipo === t.valor ? ' active' : ''}`}
              onClick={() => { setTipo(t.valor); accion.limpiar(); }} onKeyDown={(e) => e.key === 'Enter' && setTipo(t.valor)}>{t.etiqueta}</div>
          ))}
        </div>
        {dia < hoy ? <Vacio>Elegí un día a partir de hoy para agendar.</Vacio>
          : tipo === 'nota' ? <FormNota dia={dia} leads={leads} accion={accion} />
          : tipo === 'test_drive' ? <FormTestDrive dia={dia} turnos={turnos} yo={yo} sucursales={sucursales} modelos={modelos} leads={leads} accion={accion} />
          : <FormContacto key={tipo} tipo={tipo} dia={dia} leads={leads} accion={accion} />}
      </div>

      <div className="dcard" style={{ marginTop: 18 }}>
        <h3>Próximos</h3>
        <p className="dcard-sub">Lo que tenés agendado a partir de mañana, día por día</p>
        {proximos.length ? [...proximosPorDia].map(([d, lista]) => (
          <div key={d} className="agenda-grupo">
            <button className="agenda-grupo-dia" onClick={() => { setDia(d); setMes(d.slice(0, 7)); }}>{fechaTurno(d)}</button>
            <div style={{ flex: 1, minWidth: 0 }}>{lista.map((i) => <Renglon key={i.clave} item={i} hoy={hoy} />)}</div>
          </div>
        )) : <Vacio>No tenés nada agendado para los próximos días.</Vacio>}
      </div>
    </div>
  );
}

function Renglon({ item, hoy }: { item: Item; hoy: string }) {
  const accion = useAccion();
  const { turno, nota, alertaPendiente } = item;
  const vigente = turno && (turno.estado === 'pendiente' || turno.estado === 'aprobado');
  const esDeHoy = fechaLocal(item.fechaHora) === hoy;

  return (
    <div className={`agenda-renglon tipo-borde-${item.tipo}`}>
      <div className="slot-time">{horaLocal(item.fechaHora)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="slot-veh"><span className={`tipo-agenda tipo-${item.tipo}`}>{ETIQUETA[item.tipo]}</span>{item.titulo}</div>
        {item.detalle && <div className="slot-cli">{item.detalle}</div>}
        {vigente && <AccionesAgenda turno={turno} compacto />}
        {nota && !esDeHoy && (
          <button className="btn-link" style={{ fontSize: 10.5, color: 'var(--slate)', marginTop: 3 }} disabled={accion.pendiente} onClick={() => accion.ejecutar(() => eliminarAlerta(nota.id))}>Borrar</button>
        )}
        <Toast resultado={accion.resultado?.ok ? null : accion.resultado} />
      </div>
      {nota && esDeHoy && alertaPendiente
        ? <button className="mini-btn mini-btn-approve" disabled={accion.pendiente} onClick={() => accion.ejecutar(() => marcarAlertaHecha(alertaPendiente.id))}>Listo</button>
        : item.estado && <span className={`status-pill ${item.estado.clase}`}>{item.estado.texto}</span>}
    </div>
  );
}

type Accion = ReturnType<typeof useAccion>;

function FormNota({ dia, leads, accion }: { dia: string; leads: Lead[]; accion: Accion }) {
  const [mensaje, setMensaje] = useState('');
  const [hora, setHora] = useState('09:00');
  const [leadId, setLeadId] = useState('');
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      accion.ejecutar(() => crearAlerta({ fecha: dia, hora, mensaje, leadId: Number(leadId) || null }), (r) => { if (r.ok) { setMensaje(''); setLeadId(''); } });
    }}>
      <div className="form-grid">
        <div className="fld" style={{ gridColumn: '1/-1' }}><label>¿Qué tenés que hacer?</label>
          <input value={mensaje} onChange={(e) => setMensaje(e.target.value)} placeholder="Ej: preparar la documentación de la entrega" required />
        </div>
        <div className="fld"><label>Hora</label><input type="time" value={hora} onChange={(e) => setHora(e.target.value)} required /></div>
        <div className="fld"><label>Lead (opcional)</label>
          <select value={leadId} onChange={(e) => setLeadId(e.target.value)}>
            <option value="">Sin lead asociado</option>
            {leads.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
          </select>
        </div>
      </div>
      <button className="send-btn boton-agendar" disabled={accion.pendiente || !mensaje.trim()}>{accion.pendiente ? 'Guardando…' : 'Guardar nota'}</button>
      <Toast resultado={accion.resultado?.ok ? { ok: true, mensaje: 'Nota guardada. Te va a aparecer como alerta ese día.' } : accion.resultado} />
    </form>
  );
}

function FormTestDrive({ dia, turnos, yo, sucursales, modelos, leads, accion }: {
  dia: string; turnos: Turno[]; yo: Usuario; sucursales: Sucursal[]; modelos: string[]; leads: Lead[]; accion: Accion;
}) {
  const [sucursalId, setSucursalId] = useState(String(yo.sucursal_id ?? sucursales[0]?.id ?? ''));
  const [cliente, setCliente] = useState('');
  const [telefono, setTelefono] = useState('');
  const [leadId, setLeadId] = useState('');
  // Turnos ya tomados ese día en la sucursal (de cualquier vendedor), para no pedir un horario ocupado.
  const ocupados = turnos.filter((t) => t.tipo === 'test_drive' && t.estado !== 'rechazado' && String(t.sucursal_id) === sucursalId && fechaLocal(t.fecha_hora) === dia);
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
      <p className="ocupados">
        {ocupados.length
          ? <>Ya reservados ese día en la sucursal: {ocupados.map((t) => `${horaLocal(t.fecha_hora)} ${t.vehiculo ?? ''}`.trim()).join(' · ')}</>
          : 'No hay test drives reservados ese día en la sucursal.'}
      </p>
      <button className="send-btn boton-agendar" disabled={accion.pendiente}>{accion.pendiente ? 'Solicitando…' : 'Solicitar test drive'}</button>
      <Toast resultado={accion.resultado} />
    </form>
  );
}

function FormContacto({ tipo, dia, leads, accion }: { tipo: TipoTurno; dia: string; leads: Lead[]; accion: Accion }) {
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
      <button className="send-btn boton-agendar" disabled={accion.pendiente || !leadId}>
        {accion.pendiente ? 'Agendando…' : `Agendar ${ETIQUETA_TIPO_TURNO[tipo].toLowerCase()}`}
      </button>
      <Toast resultado={accion.resultado} />
    </form>
  );
}
