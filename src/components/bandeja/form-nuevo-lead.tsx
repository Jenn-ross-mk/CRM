'use client';

import { crearLead } from '@/app/acciones/leads';
import { CANALES_MANUALES, ETIQUETA_CANAL, ETIQUETA_SECTOR, FORMAS_PAGO, SECTORES_VENTA } from '@/lib/constantes';
import { SlideOver, Toast, useAccion } from '../ui';
import type { PropsBandeja } from './bandeja';

type Props = PropsBandeja & { abierto: boolean; onCerrar: () => void; onCreado: (id: string) => void };

/** Alta manual de un lead (llamado, visita al salón, etc.). Los leads de WhatsApp, Instagram y Messenger los crea el bot. */
export function FormNuevoLead({ abierto, onCerrar, onCreado, modo, usuarios, sucursales, modelos, yo, misSucursales }: Props) {
  const { pendiente, resultado, ejecutar, limpiar } = useAccion();
  const esAdmin = yo.rol === 'admin';
  const vendedores = usuarios.filter((u) => u.rol === 'vendedor' && u.activo && (esAdmin || (u.sucursal_id !== null && misSucursales.includes(u.sucursal_id))));
  const sucursalesVisibles = sucursales.filter((s) => s.activa && (esAdmin || misSucursales.includes(s.id)));

  return (
    <SlideOver abierto={abierto} titulo="Nuevo lead" onCerrar={() => { limpiar(); onCerrar(); }}>
      <form action={(fd) => ejecutar(() => crearLead(fd), (r) => r.ok && r.mensaje && onCreado(r.mensaje))}>
        <div className="detail-block" style={{ padding: '0 0 16px' }}>
          <p className="detail-label">Datos del contacto</p>
          <div className="fld" style={{ marginBottom: 9 }}><label>Nombre</label><input name="nombre" required placeholder="Ej: Romina Díaz" /></div>
          <div className="fld" style={{ marginBottom: 9 }}>
            <label>Teléfono</label><input name="telefono" placeholder="Con código de país, ej: 5492974000000" />
          </div>
          <div className="form-grid" style={{ marginBottom: 9 }}>
            <div className="fld"><label>Canal</label>
              <select name="canal">{CANALES_MANUALES.map((c) => <option key={c} value={c}>{ETIQUETA_CANAL[c]}</option>)}</select>
            </div>
            <div className="fld"><label>Sector</label>
              <select name="sector" defaultValue={yo.sector && SECTORES_VENTA.includes(yo.sector) ? yo.sector : 'convencional'}>
                {SECTORES_VENTA.map((s) => <option key={s} value={s}>{ETIQUETA_SECTOR[s]}</option>)}
              </select>
            </div>
          </div>
          {modo === 'gestion' && (
            <div className="form-grid" style={{ marginBottom: 9 }}>
              <div className="fld"><label>Sucursal</label>
                <select name="sucursal_id" defaultValue={yo.sucursal_id ?? sucursalesVisibles[0]?.id}>
                  {sucursalesVisibles.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
              <div className="fld"><label>Vendedor</label>
                <select name="vendedor_id" defaultValue="">
                  <option value="">Sin asignar</option>
                  {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                </select>
              </div>
            </div>
          )}
          <div className="fld" style={{ marginBottom: 9 }}>
            <label>Vehículo de interés</label>
            <input name="vehiculo_interes" list="lista-modelos-nuevo" placeholder="A definir" />
            <datalist id="lista-modelos-nuevo">{modelos.map((m) => <option key={m} value={m} />)}</datalist>
          </div>
          <div className="form-grid" style={{ marginBottom: 9 }}>
            <div className="fld"><label>Forma de pago</label>
              <select name="forma_pago" defaultValue=""><option value="">A definir</option>{FORMAS_PAGO.map((f) => <option key={f.valor} value={f.valor}>{f.etiqueta}</option>)}</select>
            </div>
            <div className="fld"><label>Monto / capital</label><input name="monto_capital" placeholder="$ 30.000.000" /></div>
          </div>
          <div className="fld"><label>Primer mensaje del cliente (opcional)</label><textarea name="mensaje" placeholder="Ej: Hola, quiero info del Onix" /></div>
          <button className="alert-btn" style={{ width: '100%', marginTop: 12, padding: '10px 12px' }} disabled={pendiente}>{pendiente ? 'Creando…' : 'Crear lead'}</button>
          <Toast resultado={resultado?.ok ? null : resultado} />
        </div>
      </form>
    </SlideOver>
  );
}
