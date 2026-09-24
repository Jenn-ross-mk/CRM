'use client';

import { useState } from 'react';
import { eliminarSucursal, guardarSucursal } from '@/app/acciones/equipo';
import { SlideOver, Toast, useAccion } from '@/components/ui';
import type { Sucursal } from '@/lib/tipos';
import { plural } from '@/lib/util';

export function GestionSucursales({ sucursales, vendedores }: { sucursales: Sucursal[]; vendedores: Record<number, number> }) {
  const [editando, setEditando] = useState<Sucursal | 'nueva' | null>(null);
  return (
    <div className="dash">
      <div className="pipe-filters">
        <span className="pipe-filters-note">Hacé clic en una sucursal para editarla o eliminarla.</span>
        <button className="btn-add-vendedor" onClick={() => setEditando('nueva')}>+ Nueva sucursal</button>
      </div>
      <div className="dcard">
        <table className="admin-table">
          <thead><tr><th>Sucursal</th><th>Dirección</th><th>Teléfono</th><th>Vendedores</th><th /></tr></thead>
          <tbody>
            {sucursales.map((s) => (
              <tr key={s.id} className="clickable" onClick={() => setEditando(s)}>
                <td className="venta-cliente">{s.nombre}</td><td>{s.direccion}</td><td>{s.telefono}</td><td>{vendedores[s.id] ?? 0}</td><td className="venta-chevron">›</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SlideOver abierto={!!editando} titulo={editando === 'nueva' ? 'Nueva sucursal' : 'Perfil de la sucursal'} onCerrar={() => setEditando(null)}>
        {editando && (
          <FormSucursal key={editando === 'nueva' ? 'n' : editando.id} sucursal={editando === 'nueva' ? null : editando}
            cantidad={editando === 'nueva' ? 0 : vendedores[editando.id] ?? 0} onListo={() => setEditando(null)} />
        )}
      </SlideOver>
    </div>
  );
}

function FormSucursal({ sucursal, cantidad, onListo }: { sucursal: Sucursal | null; cantidad: number; onListo: () => void }) {
  const guardar = useAccion();
  const borrar = useAccion();
  return (
    <>
      {sucursal && (
        <div className="venta-hero">
          <div className="vh-model">{sucursal.nombre}</div>
          <div className="vh-sub">{cantidad} {plural(cantidad, 'vendedor', 'vendedores')} {plural(cantidad, 'asignado')}</div>
        </div>
      )}
      <form className="detail-block" style={{ padding: '0 0 16px' }} action={(fd) => guardar.ejecutar(() => guardarSucursal(sucursal?.id ?? null, fd), (r) => r.ok && onListo())}>
        <p className="detail-label">{sucursal ? 'Editar datos' : 'Datos de la nueva sucursal'}</p>
        <div className="fld" style={{ marginBottom: 9 }}><label>Nombre</label><input name="nombre" defaultValue={sucursal?.nombre} placeholder="Ej: Sur" required /></div>
        <div className="fld" style={{ marginBottom: 9 }}><label>Dirección</label><input name="direccion" defaultValue={sucursal?.direccion} placeholder="Ej: Av. Principal 000" /></div>
        <div className="fld"><label>Teléfono</label><input name="telefono" defaultValue={sucursal?.telefono} placeholder="Ej: 297 400-3000" /></div>
        <button className="alert-btn" style={{ width: '100%', marginTop: 12, padding: '9px 12px' }} disabled={guardar.pendiente}>{sucursal ? 'Guardar cambios' : 'Crear sucursal'}</button>
        <Toast resultado={guardar.resultado?.ok ? null : guardar.resultado} />
      </form>
      {sucursal && (
        <>
          <button className="btn-danger-outline" disabled={borrar.pendiente} onClick={() => {
            let msg = `¿Eliminar la sucursal ${sucursal.nombre}?`;
            if (cantidad > 0) msg += ` Tiene ${cantidad} ${plural(cantidad, 'vendedor', 'vendedores')}, que van a quedar sin sucursal hasta que se reasignen.`;
            if (confirm(msg)) borrar.ejecutar(() => eliminarSucursal(sucursal.id), (r) => r.ok && onListo());
          }}>Eliminar sucursal</button>
          <Toast resultado={borrar.resultado?.ok ? null : borrar.resultado} />
        </>
      )}
    </>
  );
}
