'use client';

import { useState } from 'react';
import { agregarComunicado, agregarEntrega, agregarGira, eliminarItemPanel, marcarEntregada, ocultarComunicado } from '@/app/acciones/panel';
import { Toast, useAccion, Vacio } from '@/components/ui';
import { fechaLarga, fechaLocal, fechaTurno, horaLocal } from '@/lib/fechas';
import type { Comunicado, Entrega, Gira } from '@/lib/tipos';

export function PanelGeneral({ comunicados, giras, entregas }: { comunicados: Comunicado[]; giras: Gira[]; entregas: Entrega[] }) {
  const { pendiente, resultado, ejecutar } = useAccion();

  return (
    <div className="dash">
      <Toast resultado={resultado?.ok ? null : resultado} />
      <div className="admin-grid-3" style={{ marginTop: resultado && !resultado.ok ? 12 : 0 }}>
        <div className="dcard">
          <h3>Comunicados</h3><p className="dcard-sub">Visibles en el inicio del vendedor</p>
          {comunicados.map((c) => (
            <div key={c.id} className="manage-row">
              <div style={{ flex: 1 }}><div className="mr-text"><span className="announce-tag" style={{ marginRight: 6 }}>{c.categoria ?? 'INFO'}</span>{c.texto}</div><div className="mr-sub">{c.cuando ?? ''}</div></div>
              <button className="x-btn" title="Ocultar" disabled={pendiente} onClick={() => ejecutar(() => ocultarComunicado(c.id))}>✕</button>
            </div>
          ))}
          {!comunicados.length && <Vacio>Sin comunicados.</Vacio>}
          <FormComunicado />
        </div>
        <div className="dcard">
          <h3>Giras de Plan de Ahorro</h3><p className="dcard-sub">Viajes agendados</p>
          {giras.map((g) => (
            <div key={g.id} className="manage-row">
              <div style={{ flex: 1 }}><div className="mr-text">{g.destino}</div><div className="mr-sub">{fechaTurno(fechaLocal(g.fecha_hora))} {horaLocal(g.fecha_hora)} · {g.unidades ?? 'Unidades por confirmar'}</div></div>
              <button className="x-btn" disabled={pendiente} onClick={() => ejecutar(() => eliminarItemPanel('giras_plan_ahorro', g.id))}>✕</button>
            </div>
          ))}
          {!giras.length && <Vacio>Sin giras agendadas.</Vacio>}
          <FormGira />
        </div>
        <div className="dcard">
          <h3>Entregas de la semana</h3><p className="dcard-sub">Marcá como entregada al completarse</p>
          {entregas.map((e) => (
            <div key={e.id} className="manage-row">
              <div style={{ flex: 1 }}><div className="mr-text">{e.vehiculo} · {e.cliente_nombre}</div><div className="mr-sub">{e.entregada ? 'Entregada' : `Programada · ${fechaLarga(e.fecha)}`}</div></div>
              {!e.entregada && <button className="mini-btn mini-btn-approve" style={{ marginRight: 6 }} disabled={pendiente} onClick={() => ejecutar(() => marcarEntregada(e.id))}>Marcar</button>}
              <button className="x-btn" disabled={pendiente} onClick={() => ejecutar(() => eliminarItemPanel('entregas', e.id))}>✕</button>
            </div>
          ))}
          {!entregas.length && <Vacio>Sin entregas programadas.</Vacio>}
          <FormEntrega />
        </div>
      </div>
    </div>
  );
}

function FormComunicado() {
  const [texto, setTexto] = useState('');
  const { pendiente, resultado, ejecutar } = useAccion();
  return (
    <>
      <form className="add-inline-form" onSubmit={(e) => { e.preventDefault(); ejecutar(() => agregarComunicado(texto), (r) => r.ok && setTexto('')); }}>
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nuevo comunicado · cuándo" />
        <button className="add-inline-btn" disabled={pendiente || !texto.trim()}>Agregar</button>
      </form>
      <Toast resultado={resultado?.ok ? null : resultado} />
    </>
  );
}

function FormGira() {
  const [datos, setDatos] = useState({ destino: '', fecha: fechaLocal(), hora: '09:00', unidades: '' });
  const { pendiente, resultado, ejecutar } = useAccion();
  const cambiar = (k: keyof typeof datos) => (e: React.ChangeEvent<HTMLInputElement>) => setDatos({ ...datos, [k]: e.target.value });
  return (
    <form style={{ marginTop: 10 }} onSubmit={(e) => { e.preventDefault(); ejecutar(() => agregarGira(datos), (r) => r.ok && setDatos({ ...datos, destino: '', unidades: '' })); }}>
      <div className="form-grid">
        <div className="fld" style={{ gridColumn: '1/-1' }}><label>Destino</label><input value={datos.destino} onChange={cambiar('destino')} placeholder="Ej: Rada Tilly" /></div>
        <div className="fld"><label>Fecha</label><input type="date" value={datos.fecha} onChange={cambiar('fecha')} /></div>
        <div className="fld"><label>Hora</label><input type="time" value={datos.hora} onChange={cambiar('hora')} /></div>
        <div className="fld" style={{ gridColumn: '1/-1' }}><label>Unidades</label><input value={datos.unidades} onChange={cambiar('unidades')} placeholder="Ej: 3 unidades" /></div>
      </div>
      <button className="add-inline-btn" style={{ marginTop: 8, width: '100%' }} disabled={pendiente || !datos.destino.trim()}>Agregar gira</button>
      <Toast resultado={resultado?.ok ? null : resultado} />
    </form>
  );
}

function FormEntrega() {
  const [datos, setDatos] = useState({ vehiculo: '', cliente: '', fecha: fechaLocal() });
  const { pendiente, resultado, ejecutar } = useAccion();
  const cambiar = (k: keyof typeof datos) => (e: React.ChangeEvent<HTMLInputElement>) => setDatos({ ...datos, [k]: e.target.value });
  return (
    <form style={{ marginTop: 10 }} onSubmit={(e) => { e.preventDefault(); ejecutar(() => agregarEntrega(datos), (r) => r.ok && setDatos({ ...datos, vehiculo: '', cliente: '' })); }}>
      <div className="form-grid">
        <div className="fld"><label>Vehículo</label><input value={datos.vehiculo} onChange={cambiar('vehiculo')} placeholder="Ej: Onix Plus" /></div>
        <div className="fld"><label>Cliente</label><input value={datos.cliente} onChange={cambiar('cliente')} placeholder="Ej: L. Sosa" /></div>
        <div className="fld" style={{ gridColumn: '1/-1' }}><label>Fecha</label><input type="date" value={datos.fecha} onChange={cambiar('fecha')} /></div>
      </div>
      <button className="add-inline-btn" style={{ marginTop: 8, width: '100%' }} disabled={pendiente || !datos.vehiculo.trim()}>Agregar entrega</button>
      <Toast resultado={resultado?.ok ? null : resultado} />
    </form>
  );
}
