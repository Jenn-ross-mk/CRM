'use client';

import Link from 'next/link';
import { useState } from 'react';
import { actualizarPerfilCliente, agregarNota } from '@/app/acciones/leads';
import { AccionesAgenda } from '@/components/acciones-agenda';
import { Toast, useAccion, Vacio } from '@/components/ui';
import {
  ETIQUETA_CANAL, ETIQUETA_TIPO_TURNO, FORMAS_PAGO, TEMPERATURAS, TIPOS_VEHICULO, USOS,
  etapasDe, etiquetaDe, etiquetaFormaPago, etiquetaMotivoCierre, etiquetaMotivoReagenda, etiquetaSector, ordenEtapa,
} from '@/lib/constantes';
import type { PerfilCliente } from '@/lib/datos';
import { fechaCorta, fechaLarga, fechaLocal, fechaTurno, horaLocal } from '@/lib/fechas';
import { type Clasificacion, ubicacion } from '@/lib/panel';
import type { EtapaPipeline, Rol, Turno } from '@/lib/tipos';

type Props = {
  perfil: PerfilCliente;
  clasificacion: Clasificacion;
  etapas: EtapaPipeline[];
  modelos: string[];
  nombres: Record<number, string>;
  sucursales: Record<number, string>;
  yo: { id: number; rol: Rol };
};

const cuando = (d: string | null) => (d ? `${fechaCorta(d)} ${horaLocal(d)}` : '—');
const agendaTexto = (t: Pick<Turno, 'tipo' | 'fecha_hora'>) => `${ETIQUETA_TIPO_TURNO[t.tipo]} del ${fechaTurno(fechaLocal(t.fecha_hora))} a las ${horaLocal(t.fecha_hora)}`;

/** Explicación en palabras de por qué el cliente está en ese bloque del Panel general. */
function porQue(c: Clasificacion, perfil: PerfilCliente): string {
  const { lead } = perfil;
  switch (c.bloque) {
    case 'seguimiento': return c.etiqueta === 'agendado' ? `Tiene ${agendaTexto(c.agenda).toLowerCase()}.` : 'Es un lead nuevo o tiene una conversación en curso.';
    case 'pendiente':
      if (c.motivo === 'sin_reagendar') return `La ${agendaTexto(c.agenda).toLowerCase()} ya pasó y no se marcó realizada ni se reagendó.`;
      if (c.motivo === 'agenda_vencida') return `Tiene ${agendaTexto(c.agenda).toLowerCase()} y todavía no se le escribió hoy.`;
      return c.motivo === 'sin_respuesta' ? `Se le escribió y no responde hace ${c.dias} días.` : `El cliente no tiene respuesta del vendedor hace ${c.dias} días.`;
    case 'cerrado': return `Chat cerrado: ${etiquetaMotivoCierre(lead.motivo_cierre)}${lead.detalle_cierre ? ` (${lead.detalle_cierre})` : ''}.`;
    default: return perfil.venta ? `Compró: ${perfil.venta.vehiculo}, el ${fechaLarga(perfil.venta.fecha)}.` : 'Llegó a la última etapa del pipeline.';
  }
}

export function Perfil(props: Props) {
  const { perfil, clasificacion, yo } = props;
  const { lead } = perfil;
  const u = ubicacion(clasificacion);
  const rutaChat = `${yo.rol === 'vendedor' ? '/bandeja' : '/gestion/mensajes'}?lead=${lead.id}`;

  return (
    <div className="dash">
      <Link href="/clientes" className="btn-link" style={{ display: 'inline-block', marginBottom: 12 }}>‹ Clientes</Link>
      <div className="dcard perfil-cabecera">
        <div style={{ minWidth: 0 }}>
          <h2 className="perfil-nombre">{lead.nombre}</h2>
          <div className="perfil-sub">
            {lead.telefono ?? 'Sin teléfono'} · {ETIQUETA_CANAL[lead.canal] ?? lead.canal}{lead.localidad ? ` · ${lead.localidad}` : ''}{lead.email ? ` · ${lead.email}` : ''}
          </div>
          <div className="tag-row" style={{ marginTop: 10 }}>
            <span className={`ptag ptag-bloque-${clasificacion.bloque}`}>{u.bloque}</span>
            {u.etiqueta !== u.bloque && <span className="ptag ptag-etiqueta">{u.etiqueta}</span>}
            <span className="pill pill-outline">{etiquetaSector(lead.sector)}</span>
            {perfil.etiquetas.map((t) => <span key={t.id} className="pill pill-outline">{t.nombre}</span>)}
          </div>
        </div>
        <Link className="alert-btn perfil-chat" href={rutaChat}>Abrir chat</Link>
      </div>

      <div className="perfil-grid">
        <div className="perfil-col">
          <DondeEsta {...props} />
          <DatosCliente {...props} />
        </div>
        <div className="perfil-col">
          <PrimerMensaje {...props} />
          <Agendamientos {...props} />
          <Notas {...props} />
          <Historial {...props} />
        </div>
      </div>
    </div>
  );
}

const Campo = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="field-row"><span className="field-key">{k}</span><span className="field-val">{v || '—'}</span></div>
);

function DondeEsta({ perfil, clasificacion, etapas: todas, nombres, sucursales }: Props) {
  const { lead } = perfil;
  const etapas = etapasDe(todas, lead.sector);
  const actual = ordenEtapa(todas, lead.etapa_id);
  return (
    <div className="dcard">
      <h3>Dónde está hoy</h3>
      <p className={`perfil-porque porque-${clasificacion.bloque}`}>{porQue(clasificacion, perfil)}</p>
      {etapas.length > 0 && (
        <div className="perfil-etapas" aria-label="Etapa del pipeline">
          {etapas.map((e) => <span key={e.id} className={`perfil-etapa${e.orden < actual ? ' hecha' : e.orden === actual ? ' actual' : ''}`}>{e.nombre}</span>)}
        </div>
      )}
      <Campo k="Vendedor" v={lead.vendedor_id ? nombres[lead.vendedor_id] ?? '—' : 'Sin asignar'} />
      <Campo k="Sucursal" v={lead.sucursal_id ? sucursales[lead.sucursal_id] ?? '—' : '—'} />
      <Campo k="Ingresó" v={cuando(lead.creado_en)} />
      <Campo k="Último mensaje del cliente" v={cuando(lead.ultima_interaccion)} />
      <Campo k="Último mensaje enviado" v={cuando(lead.ultimo_saliente_en)} />
    </div>
  );
}

function DatosCliente({ perfil, modelos }: Props) {
  const { lead } = perfil;
  const [editando, setEditando] = useState(false);
  const accion = useAccion();
  const entrega = lead.entrega_vehiculo === null ? '' : lead.entrega_vehiculo ? 'si' : 'no';

  return (
    <div className="dcard">
      <div className="perfil-titulo">
        <h3>Datos del cliente</h3>
        <button className="btn-link" onClick={() => { setEditando(!editando); accion.limpiar(); }}>{editando ? 'Cancelar' : 'Editar'}</button>
      </div>
      <p className="dcard-sub">Ninguno es obligatorio: completá lo que sepas.</p>
      {editando ? (
        <form action={(fd) => accion.ejecutar(() => actualizarPerfilCliente(lead.id, fd), (r) => r.ok && setEditando(false))}>
          <p className="perfil-grupo">Contacto</p>
          <div className="form-grid">
            <div className="fld"><label>Nombre</label><input name="nombre_cliente" defaultValue={lead.nombre_cliente ?? ''} placeholder={lead.nombre} /></div>
            <div className="fld"><label>Email</label><input name="email" type="email" defaultValue={lead.email ?? ''} /></div>
            <div className="fld" style={{ gridColumn: '1/-1' }}><label>Localidad</label><input name="localidad" defaultValue={lead.localidad ?? ''} /></div>
          </div>
          <p className="perfil-grupo">Qué busca</p>
          <div className="form-grid">
            <div className="fld"><label>Modelo de interés</label>
              <input name="vehiculo_interes" list="perfil-modelos" defaultValue={lead.vehiculo_interes ?? ''} />
              <datalist id="perfil-modelos">{modelos.map((m) => <option key={m} value={m} />)}</datalist>
            </div>
            <div className="fld"><label>0 km o usado</label>
              <select name="tipo" defaultValue={lead.tipo ?? ''}><option value="">—</option>{TIPOS_VEHICULO.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}</select>
            </div>
            <div className="fld"><label>Uso</label>
              <select name="uso" defaultValue={lead.uso ?? ''}><option value="">—</option>{USOS.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}</select>
            </div>
            <div className="fld"><label>¿Para cuándo?</label><input name="urgencia" defaultValue={lead.urgencia ?? ''} placeholder="Ej: antes de fin de año" /></div>
            <div className="fld" style={{ gridColumn: '1/-1' }}><label>Preferencias</label>
              <textarea name="preferencias" defaultValue={lead.preferencias ?? ''} placeholder="Color, versión, equipamiento, horarios para contactarlo…" />
            </div>
          </div>
          <p className="perfil-grupo">Cómo paga</p>
          <div className="form-grid">
            <div className="fld"><label>Financiación o plan</label>
              <select name="forma_pago" defaultValue={lead.forma_pago ?? ''}><option value="">A definir</option>{FORMAS_PAGO.map((f) => <option key={f.valor} value={f.valor}>{f.etiqueta}</option>)}</select>
            </div>
            <div className="fld"><label>Monto / capital</label><input name="monto_capital" defaultValue={lead.monto_capital ?? ''} /></div>
            <div className="fld"><label>¿Entrega un usado?</label>
              <select name="entrega_vehiculo" defaultValue={entrega}><option value="">—</option><option value="si">Sí</option><option value="no">No</option></select>
            </div>
            <div className="fld"><label>Usado que entrega</label><input name="usado_descripcion" defaultValue={lead.usado_descripcion ?? ''} placeholder="Marca, modelo, año, km" /></div>
          </div>
          <p className="perfil-grupo">Seguimiento</p>
          <div className="form-grid">
            <div className="fld"><label>Temperatura</label>
              <select name="clasificacion" defaultValue={lead.clasificacion ?? ''}><option value="">—</option>{TEMPERATURAS.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}</select>
            </div>
            <div className="fld"><label>Prioridad</label>
              <select name="prioridad" defaultValue={lead.prioridad}><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></select>
            </div>
          </div>
          <button className="alert-btn" style={{ width: '100%', marginTop: 14, padding: '9px 12px' }} disabled={accion.pendiente}>{accion.pendiente ? 'Guardando…' : 'Guardar datos'}</button>
          <Toast resultado={accion.resultado?.ok ? null : accion.resultado} />
        </form>
      ) : (
        <>
          <p className="perfil-grupo">Qué busca</p>
          <Campo k="Modelo de interés" v={lead.vehiculo_interes} />
          <Campo k="0 km o usado" v={etiquetaDe(TIPOS_VEHICULO, lead.tipo)} />
          <Campo k="Uso" v={etiquetaDe(USOS, lead.uso)} />
          <Campo k="¿Para cuándo?" v={lead.urgencia} />
          <Campo k="Preferencias" v={lead.preferencias} />
          <p className="perfil-grupo">Cómo paga</p>
          <Campo k="Financiación o plan" v={etiquetaFormaPago(lead.forma_pago)} />
          <Campo k="Monto / capital" v={lead.monto_capital} />
          <Campo k="¿Entrega un usado?" v={lead.entrega_vehiculo === null ? null : lead.entrega_vehiculo ? 'Sí' : 'No'} />
          <Campo k="Usado que entrega" v={lead.usado_descripcion} />
          <p className="perfil-grupo">Seguimiento</p>
          <Campo k="Temperatura" v={etiquetaDe(TEMPERATURAS, lead.clasificacion)} />
          <Campo k="Prioridad" v={lead.prioridad[0].toUpperCase() + lead.prioridad.slice(1)} />
          {lead.contexto_conversacion && <><p className="perfil-grupo">Resumen del bot</p><p className="dcard-sub" style={{ margin: 0 }}>{lead.contexto_conversacion}</p></>}
          <Toast resultado={accion.resultado} />
        </>
      )}
    </div>
  );
}

function PrimerMensaje({ perfil }: Props) {
  const m = perfil.primerMensaje;
  return (
    <div className="dcard">
      <h3>Primer mensaje</h3>
      {m ? (
        <>
          <p className="dcard-sub">{cuando(m.creado_en)} · {ETIQUETA_CANAL[perfil.lead.canal] ?? perfil.lead.canal}{m.autor_tipo !== 'cliente' ? ` · escrito por ${m.autor_tipo === 'bot' ? 'el bot' : 'el vendedor'}` : ''}</p>
          <blockquote className="perfil-cita">{m.contenido || `[${m.tipo}]`}</blockquote>
        </>
      ) : <Vacio>Este cliente todavía no tiene mensajes.</Vacio>}
    </div>
  );
}

function Agendamientos({ perfil, nombres }: Props) {
  const vigentes = perfil.turnos.filter((t) => t.estado === 'pendiente' || t.estado === 'aprobado').sort((a, b) => a.fecha_hora.localeCompare(b.fecha_hora));
  const anteriores = perfil.turnos.filter((t) => t.estado === 'hecho' || t.estado === 'rechazado');
  const hoy = fechaLocal();
  const estado = (t: Turno) =>
    t.tipo === 'test_drive' && t.estado === 'pendiente' ? 'Pendiente de aprobación'
      : fechaLocal(t.fecha_hora) < hoy ? 'Vencido: marcalo realizado o reagendalo'
      : t.tipo === 'test_drive' ? 'Aprobado' : 'Agendado';

  return (
    <div className="dcard">
      <h3>Agendamientos</h3>
      <p className="dcard-sub">Para reagendar hay que elegir el motivo. Si pasa la fecha sin reagendar ni marcarlo realizado, el cliente pasa a Pendientes.</p>
      {vigentes.length ? vigentes.map((t) => (
        <div key={t.id} className={`perfil-agenda${fechaLocal(t.fecha_hora) < hoy ? ' vencida' : ''}`}>
          <div className="perfil-agenda-top">
            <span className={`tipo-agenda tipo-${t.tipo}`}>{ETIQUETA_TIPO_TURNO[t.tipo]}</span>
            <strong>{fechaTurno(fechaLocal(t.fecha_hora))} · {horaLocal(t.fecha_hora)}</strong>
            {t.tipo === 'test_drive' && t.vehiculo && <span>· {t.vehiculo}</span>}
          </div>
          <div className="perfil-agenda-estado">{estado(t)}</div>
          <AccionesAgenda turno={t} />
        </div>
      )) : <Vacio>No tiene nada agendado. Se agenda desde el chat o desde Agendamientos.</Vacio>}

      {perfil.reagendamientos.length > 0 && (
        <>
          <p className="perfil-grupo">Reagendamientos</p>
          {perfil.reagendamientos.map((r) => (
            <div key={r.id} className="perfil-reagenda">
              <span className="perfil-reagenda-motivo">{etiquetaMotivoReagenda(r.motivo)}</span>
              <span>{fechaCorta(r.fecha_anterior)} → {fechaCorta(r.fecha_nueva)} {horaLocal(r.fecha_nueva)}</span>
              <span className="perfil-reagenda-quien">{r.usuario_id ? nombres[r.usuario_id] ?? '' : ''} · {fechaCorta(r.creado_en)}</span>
            </div>
          ))}
        </>
      )}

      {anteriores.length > 0 && (
        <>
          <p className="perfil-grupo">Anteriores</p>
          {anteriores.map((t) => (
            <div key={t.id} className="field-row">
              <span className="field-key">{ETIQUETA_TIPO_TURNO[t.tipo]} · {fechaCorta(t.fecha_hora)}</span>
              <span className="field-val">{t.estado === 'hecho' ? 'Realizado' : t.tipo === 'test_drive' ? 'Rechazado' : 'Cancelado'}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function Notas({ perfil, nombres }: Props) {
  const [texto, setTexto] = useState('');
  const accion = useAccion();
  return (
    <div className="dcard">
      <h3>Notas</h3>
      <p className="dcard-sub">Internas: el cliente no las ve.</p>
      <form onSubmit={(e) => { e.preventDefault(); accion.ejecutar(() => agregarNota(perfil.lead.id, texto), (r) => r.ok && setTexto('')); }}>
        <input className="note-input" placeholder="Agregar una nota… (Enter para guardar)" value={texto} onChange={(e) => setTexto(e.target.value)} disabled={accion.pendiente} />
      </form>
      <Toast resultado={accion.resultado?.ok ? null : accion.resultado} />
      <div style={{ marginTop: 10 }}>
        {perfil.notas.length ? perfil.notas.map((n) => (
          <div key={n.id} className="note-item">
            {n.texto}
            <div className="note-meta">{nombres[n.usuario_id] ?? '—'} · {cuando(n.creado_en)}</div>
          </div>
        )) : <Vacio>Sin notas todavía.</Vacio>}
      </div>
    </div>
  );
}

function Historial({ perfil, nombres }: Props) {
  if (!perfil.historial.length) return null;
  return (
    <div className="dcard">
      <h3>Historial</h3>
      <p className="dcard-sub">Cambios de etapa, asignaciones, cierres y reagendamientos</p>
      <div className="timeline">
        {perfil.historial.map((h) => (
          <div key={h.id} className="tl-item">
            <div className="tl-title">{h.descripcion}</div>
            <div className="tl-time">{cuando(h.creado_en)}{h.usuario_id ? ` · ${nombres[h.usuario_id] ?? ''}` : ''}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
