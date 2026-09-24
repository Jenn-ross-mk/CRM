'use client';

import { crearLead } from '@/app/acciones/leads';
import { CANALES, SECTORES } from '@/lib/constantes';
import { SlideOver, Toast, useAccion } from '../ui';
import type { PropsBandeja } from './bandeja';

type Props = PropsBandeja & { abierto: boolean; onCerrar: () => void; onCreado: (id: string) => void };

/** Alta manual de un lead (mientras no estén conectados los canales). */
export function FormNuevoLead({ abierto, onCerrar, onCreado, modo, perfiles, sucursales, modelos, yo }: Props) {
  const { pendiente, resultado, ejecutar, limpiar } = useAccion();
  const vendedores = perfiles.filter((p) => p.rol === 'vendedor' && (yo.rol === 'administrador' || p.sucursal_id === yo.sucursal_id));

  return (
    <SlideOver abierto={abierto} titulo="Nuevo lead" onCerrar={() => { limpiar(); onCerrar(); }}>
      <form action={(fd) => ejecutar(() => crearLead(fd), (r) => r.ok && r.mensaje && onCreado(r.mensaje))}>
        <div className="detail-block" style={{ padding: '0 0 16px' }}>
          <p className="detail-label">Datos del contacto</p>
          <div className="fld" style={{ marginBottom: 9 }}><label>Nombre</label><input name="nombre" required placeholder="Ej: Romina Díaz" /></div>
          <div className="fld" style={{ marginBottom: 9 }}><label>Teléfono</label><input name="telefono" placeholder="+54 9 297 400-0000" /></div>
          <div className="form-grid" style={{ marginBottom: 9 }}>
            <div className="fld"><label>Canal</label><select name="canal">{CANALES.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div className="fld"><label>Sector</label>
              <select name="sector" defaultValue={yo.sector ?? 'Convencional'}>{SECTORES.map((s) => <option key={s}>{s}</option>)}</select>
            </div>
          </div>
          <div className="form-grid" style={{ marginBottom: 9 }}>
            <div className="fld"><label>Sucursal</label>
              <select name="sucursal_id" defaultValue={yo.sucursal_id ?? sucursales[0]?.id}>
                {sucursales.filter((s) => yo.rol !== 'supervisor' || s.id === yo.sucursal_id).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
            {modo === 'gestion' && (
              <div className="fld"><label>Vendedor</label>
                <select name="vendedor_id" defaultValue="">
                  <option value="">Sin asignar</option>
                  {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="fld" style={{ marginBottom: 9 }}>
            <label>Modelo de interés</label>
            <select name="modelo" defaultValue=""><option value="">A definir</option>{modelos.map((m) => <option key={m} value={m.replace('Chevrolet ', '')}>{m}</option>)}</select>
          </div>
          <div className="form-grid" style={{ marginBottom: 9 }}>
            <div className="fld"><label>Forma de pago</label><input name="forma_pago" placeholder="Contado, financiado…" /></div>
            <div className="fld"><label>Presupuesto</label><input name="presupuesto" placeholder="$ 30.000.000" /></div>
          </div>
          <div className="fld"><label>Primer mensaje del cliente (opcional)</label><textarea name="mensaje" placeholder="Ej: Hola, quiero info del Onix" /></div>
          <button className="alert-btn" style={{ width: '100%', marginTop: 12, padding: '10px 12px' }} disabled={pendiente}>{pendiente ? 'Creando…' : 'Crear lead'}</button>
          <Toast resultado={resultado?.ok ? null : resultado} />
        </div>
      </form>
    </SlideOver>
  );
}
