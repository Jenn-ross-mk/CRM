'use client';

import { useMemo, useState } from 'react';
import { cargarHorario, eliminarHorario } from '@/app/acciones/horarios';
import { Toast, useAccion, Vacio } from '@/components/ui';
import { etiquetaSector } from '@/lib/constantes';
import { fechaTexto, horaCorta, tituloDia } from '@/lib/fechas';
import type { Horario, Sucursal, Usuario } from '@/lib/tipos';

type Props = { horarios: Horario[]; vendedores: Usuario[]; sucursales: Sucursal[]; hoy: string };

/**
 * Horarios de los vendedores por fecha concreta (varían semana a semana).
 * La asignación automática de leads solo elige vendedores que estén dentro de su horario en ese momento.
 */
export function GestionHorarios({ horarios, vendedores, sucursales, hoy }: Props) {
  const [sucursalId, setSucursalId] = useState('');
  const crear = useAccion();
  const borrar = useAccion();
  const nombreSuc = (id: number | null) => sucursales.find((s) => s.id === id)?.nombre ?? '—';
  const porId = useMemo(() => new Map(vendedores.map((v) => [v.id, v])), [vendedores]);
  const visibles = vendedores.filter((v) => !sucursalId || String(v.sucursal_id) === sucursalId);

  const porDia = useMemo(() => {
    const m = new Map<string, Horario[]>();
    horarios
      .filter((h) => porId.has(h.usuario_id) && (!sucursalId || String(porId.get(h.usuario_id)?.sucursal_id) === sucursalId))
      .forEach((h) => m.set(h.fecha, [...(m.get(h.fecha) ?? []), h]));
    return [...m.entries()];
  }, [horarios, porId, sucursalId]);

  return (
    <div className="dash">
      <div className="pipe-filters">
        <select className="admin-filter" value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
          <option value="">Todas las sucursales</option>
          {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
        <span className="pipe-filters-note">El bot asigna leads solo a los vendedores que están dentro de su horario. Sin horario cargado para hoy, el vendedor no recibe leads.</span>
      </div>
      <div className="td-grid">
        <div className="dcard">
          <h3>Cargar horario</h3>
          <p className="dcard-sub">Para un día o para varios días seguidos</p>
          <form action={(fd) => crear.ejecutar(() => cargarHorario(fd))}>
            <div className="form-grid">
              <div className="fld" style={{ gridColumn: '1/-1' }}><label>Vendedor</label>
                <select name="usuario_id" required defaultValue="">
                  <option value="" disabled>Elegí un vendedor</option>
                  {visibles.map((v) => <option key={v.id} value={v.id}>{v.nombre} · {nombreSuc(v.sucursal_id)} · {etiquetaSector(v.sector)}</option>)}
                </select>
              </div>
              <div className="fld"><label>Desde el día</label><input type="date" name="fecha" defaultValue={hoy} min={hoy} required /></div>
              <div className="fld"><label>Hasta el día (opcional)</label><input type="date" name="fecha_hasta" min={hoy} /></div>
              <div className="fld"><label>Hora de entrada</label><input type="time" name="hora_desde" defaultValue="09:00" required /></div>
              <div className="fld"><label>Hora de salida</label><input type="time" name="hora_hasta" defaultValue="18:00" required /></div>
              <label className="check-inline" style={{ gridColumn: '1/-1' }}><input type="checkbox" name="solo_habiles" defaultChecked /> Saltear los domingos</label>
            </div>
            <button className="alert-btn" style={{ width: '100%', marginTop: 12 }} disabled={crear.pendiente}>{crear.pendiente ? 'Guardando…' : 'Guardar horario'}</button>
            <Toast resultado={crear.resultado} />
          </form>
        </div>
        <div className="dcard">
          <h3>Próximos horarios</h3>
          <p className="dcard-sub">Desde hoy · {fechaTexto(hoy)}</p>
          <Toast resultado={borrar.resultado?.ok ? null : borrar.resultado} />
          {porDia.length ? porDia.map(([fecha, lista]) => (
            <div key={fecha}>
              <div className="horario-dia">{tituloDia(fecha)}{fecha === hoy ? ' · hoy' : ''}</div>
              {lista.map((h) => (
                <div key={h.id} className="manage-row">
                  <div style={{ flex: 1 }}>
                    <div className="mr-text">{porId.get(h.usuario_id)?.nombre}</div>
                    <div className="mr-sub">{horaCorta(h.hora_desde)} a {horaCorta(h.hora_hasta)} · {nombreSuc(porId.get(h.usuario_id)?.sucursal_id ?? null)}</div>
                  </div>
                  <button className="x-btn" title="Quitar" disabled={borrar.pendiente} onClick={() => borrar.ejecutar(() => eliminarHorario(h.id))}>✕</button>
                </div>
              ))}
            </div>
          )) : <Vacio>No hay horarios cargados desde hoy.</Vacio>}
        </div>
      </div>
    </div>
  );
}
