'use client';

import { useState } from 'react';
import { agregarCampoExtra, crearVenta } from '@/app/acciones/ventas';
import { SlideOver, Toast, useAccion } from '@/components/ui';
import { fechaLarga, fechaLocal } from '@/lib/fechas';
import type { Perfil, Sucursal, Venta } from '@/lib/tipos';

type Props = { ventas: Venta[]; nombres: Record<string, string>; sucursales: Sucursal[]; vendedores: Perfil[]; modelos: string[] };

export function TablaVentas({ ventas, nombres, sucursales, vendedores, modelos }: Props) {
  const [abiertaId, setAbiertaId] = useState<number | null>(null);
  const [nueva, setNueva] = useState(false);
  const abierta = ventas.find((v) => v.id === abiertaId) ?? null;
  const nombreSuc = (id: number | null) => sucursales.find((s) => s.id === id)?.nombre ?? '—';

  return (
    <>
      <div className="pipe-filters" style={{ marginTop: -6 }}>
        <button className="btn-add-vendedor" onClick={() => setNueva(true)}>+ Registrar venta</button>
      </div>
      <div className="dcard">
        <table className="admin-table">
          <thead><tr><th>Cliente</th><th>Vehículo</th><th>Vendedor</th><th>Sucursal</th><th>Sector</th><th>Fecha</th><th /></tr></thead>
          <tbody>
            {ventas.map((v) => (
              <tr key={v.id} className="clickable" onClick={() => setAbiertaId(v.id)}>
                <td className="venta-cliente">{v.cliente}</td>
                <td>{v.vehiculo}</td>
                <td>{v.vendedor_id ? nombres[v.vendedor_id] ?? '—' : 'Sin vendedor'}</td>
                <td><span className="pill">{nombreSuc(v.sucursal_id)}</span></td>
                <td><span className="pill">{v.sector}</span></td>
                <td>{fechaLarga(v.fecha)}</td>
                <td className="venta-chevron">›</td>
              </tr>
            ))}
            {!ventas.length && <tr><td colSpan={7} className="empty-slots">No hay ventas para estos filtros.</td></tr>}
          </tbody>
        </table>
      </div>

      <SlideOver abierto={!!abierta} titulo="Detalle de la venta" onCerrar={() => setAbiertaId(null)}>
        {abierta && <DetalleVenta venta={abierta} vendedor={abierta.vendedor_id ? nombres[abierta.vendedor_id] : '—'} sucursal={nombreSuc(abierta.sucursal_id)} />}
      </SlideOver>
      <SlideOver abierto={nueva} titulo="Registrar venta" onCerrar={() => setNueva(false)}>
        <FormVenta vendedores={vendedores} sucursales={sucursales} modelos={modelos} onListo={() => setNueva(false)} />
      </SlideOver>
    </>
  );
}

function DetalleVenta({ venta, vendedor, sucursal }: { venta: Venta; vendedor: string; sucursal: string }) {
  const [k, setK] = useState('');
  const [v, setV] = useState('');
  const { pendiente, resultado, ejecutar } = useAccion();
  return (
    <>
      <div className="venta-hero">
        <div className="vh-model">{venta.vehiculo}</div>
        <div className="vh-sub">{venta.sector} · {fechaLarga(venta.fecha)}</div>
        <div className="vh-amount">{venta.monto}</div>
      </div>
      <div className="detail-block" style={{ padding: '0 0 16px' }}>
        <p className="detail-label">Datos generales</p>
        <div className="field-row"><span className="field-key">Cliente</span><span className="field-val">{venta.cliente}</span></div>
        <div className="field-row"><span className="field-key">Vendedor</span><span className="field-val">{vendedor}</span></div>
        <div className="field-row"><span className="field-key">Sucursal</span><span className="field-val">{sucursal}</span></div>
        <div className="field-row"><span className="field-key">Fecha</span><span className="field-val">{fechaLarga(venta.fecha)}</span></div>
        {venta.lead_id && <div className="field-row"><span className="field-key">Origen</span><span className="field-val">Lead del CRM</span></div>}
      </div>
      <div className="detail-block" style={{ padding: '16px 0 0', borderTop: '1px solid var(--silver-light)' }}>
        <p className="detail-label">Datos adicionales</p>
        {venta.extra.map((f, i) => (
          <div key={i} className="extra-field-row"><span className="field-key">{f.k}</span><span className="field-val">{f.v}</span></div>
        ))}
        <form className="extra-add-form" onSubmit={(e) => { e.preventDefault(); ejecutar(() => agregarCampoExtra(venta.id, { k, v }), (r) => { if (r.ok) { setK(''); setV(''); } }); }}>
          <input placeholder="Campo" value={k} onChange={(e) => setK(e.target.value)} />
          <input placeholder="Valor" value={v} onChange={(e) => setV(e.target.value)} />
          <button className="alert-btn" disabled={pendiente}>+</button>
        </form>
        <Toast resultado={resultado?.ok ? null : resultado} />
      </div>
    </>
  );
}

function FormVenta({ vendedores, sucursales, modelos, onListo }: { vendedores: Perfil[]; sucursales: Sucursal[]; modelos: string[]; onListo: () => void }) {
  const { pendiente, resultado, ejecutar } = useAccion();
  return (
    <form action={(fd) => ejecutar(() => crearVenta(fd), (r) => r.ok && onListo())}>
      <div className="detail-block" style={{ padding: '0 0 16px' }}>
        <p className="detail-label">Datos de la venta</p>
        <div className="fld" style={{ marginBottom: 9 }}><label>Cliente</label><input name="cliente" required /></div>
        <div className="fld" style={{ marginBottom: 9 }}><label>Vehículo</label><select name="vehiculo">{modelos.map((m) => <option key={m}>{m}</option>)}</select></div>
        <div className="fld" style={{ marginBottom: 9 }}><label>Vendedor</label>
          <select name="vendedor_id" required>{vendedores.map((v) => <option key={v.id} value={v.id}>{v.nombre} · {v.sector}</option>)}</select>
        </div>
        <div className="form-grid" style={{ marginBottom: 9 }}>
          <div className="fld"><label>Sucursal</label>
            <select name="sucursal_id" defaultValue=""><option value="">La del vendedor</option>{sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select>
          </div>
          <div className="fld"><label>Fecha</label><input type="date" name="fecha" defaultValue={fechaLocal()} /></div>
        </div>
        <div className="fld"><label>Monto / cuota</label><input name="monto" placeholder="$ 30.000.000 o Cuota N.º 1 de 84" /></div>
        <button className="alert-btn" style={{ width: '100%', marginTop: 12, padding: '10px 12px' }} disabled={pendiente}>Registrar venta</button>
        <Toast resultado={resultado?.ok ? null : resultado} />
      </div>
    </form>
  );
}
