'use client';

import { useState } from 'react';
import { agregarComunicado, agregarEntrega, agregarGira, eliminarItemPanel, marcarEntregada } from '@/app/acciones/panel';
import { Toast, useAccion, Vacio } from '@/components/ui';
import type { Comunicado, Entrega, Gira, Resultado } from '@/lib/tipos';

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
              <div style={{ flex: 1 }}><div className="mr-text"><span className="announce-tag" style={{ marginRight: 6 }}>{c.tag}</span>{c.texto}</div><div className="mr-sub">{c.detalle}</div></div>
              <button className="x-btn" disabled={pendiente} onClick={() => ejecutar(() => eliminarItemPanel('comunicados', c.id))}>✕</button>
            </div>
          ))}
          {!comunicados.length && <Vacio>Sin comunicados.</Vacio>}
          <FormInline placeholder="Nuevo comunicado · detalle" onAgregar={(t) => agregarComunicado(t)} />
        </div>
        <div className="dcard">
          <h3>Giras de Plan de Ahorro</h3><p className="dcard-sub">Viajes agendados</p>
          {giras.map((g) => (
            <div key={g.id} className="manage-row">
              <div style={{ flex: 1 }}><div className="mr-text">{g.destino}</div><div className="mr-sub">{g.fecha} · {g.unidades}</div></div>
              <button className="x-btn" disabled={pendiente} onClick={() => ejecutar(() => eliminarItemPanel('giras', g.id))}>✕</button>
            </div>
          ))}
          {!giras.length && <Vacio>Sin giras agendadas.</Vacio>}
          <FormInline placeholder="Ej: Rada Tilly · Sáb 9:00 · 3 unidades" onAgregar={agregarGira} />
        </div>
        <div className="dcard">
          <h3>Entregas de la semana</h3><p className="dcard-sub">Marcá como entregada al completarse</p>
          {entregas.map((e) => (
            <div key={e.id} className="manage-row">
              <div style={{ flex: 1 }}><div className="mr-text">{e.vehiculo} · {e.cliente}</div><div className="mr-sub">{e.hecha ? 'Entregada' : `Programada · ${e.dia}`}</div></div>
              {!e.hecha && <button className="mini-btn mini-btn-approve" style={{ marginRight: 6 }} disabled={pendiente} onClick={() => ejecutar(() => marcarEntregada(e.id))}>Marcar</button>}
              <button className="x-btn" disabled={pendiente} onClick={() => ejecutar(() => eliminarItemPanel('entregas', e.id))}>✕</button>
            </div>
          ))}
          {!entregas.length && <Vacio>Sin entregas programadas.</Vacio>}
          <FormInline placeholder="Ej: Onix Plus · L. Sosa · Jue" onAgregar={agregarEntrega} />
        </div>
      </div>
    </div>
  );
}

function FormInline({ placeholder, onAgregar }: { placeholder: string; onAgregar: (texto: string) => Promise<Resultado> }) {
  const [texto, setTexto] = useState('');
  const { pendiente, resultado, ejecutar } = useAccion();
  return (
    <>
      <form className="add-inline-form" onSubmit={(e) => { e.preventDefault(); ejecutar(() => onAgregar(texto), (r) => r.ok && setTexto('')); }}>
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={placeholder} />
        <button className="add-inline-btn" disabled={pendiente || !texto.trim()}>Agregar</button>
      </form>
      <Toast resultado={resultado?.ok ? null : resultado} />
    </>
  );
}
