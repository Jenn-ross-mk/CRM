'use client';

import { cambiarEstadoTestDrive } from '@/app/acciones/test-drives';
import { Toast, useAccion, Vacio } from '@/components/ui';
import { fechaTurno, horaCorta } from '@/lib/fechas';
import type { EstadoTestDrive, TestDrive } from '@/lib/tipos';

type Props = { turnos: TestDrive[]; nombres: Record<string, string>; sucursales: Record<number, string> };

export function AprobacionTestDrives({ turnos, nombres, sucursales }: Props) {
  const { pendiente, resultado, ejecutar } = useAccion();
  const cambiar = (id: number, estado: EstadoTestDrive) => ejecutar(() => cambiarEstadoTestDrive(id, estado));
  const pendientes = turnos.filter((t) => t.estado === 'pendiente');
  const resto = turnos.filter((t) => t.estado !== 'pendiente').sort((a, b) => b.fecha.localeCompare(a.fecha));

  const info = (t: TestDrive) => (
    <>
      <div className="td-req-date">{fechaTurno(t.fecha)}</div>
      <div className="td-req-info">
        <div className="td-req-veh">{t.vehiculo} · {t.cliente}</div>
        <div className="td-req-sub">
          {horaCorta(t.hora)} · {t.vendedor_id ? nombres[t.vendedor_id] ?? '—' : '—'} · Sucursal {t.sucursal_id ? sucursales[t.sucursal_id] : '—'}{t.telefono ? ` · ${t.telefono}` : ''}
        </div>
      </div>
    </>
  );

  return (
    <div className="dash">
      <div className="pipe-filters"><span className="pipe-filters-note">Aprobá o rechazá las solicitudes pendientes de los vendedores.</span></div>
      <Toast resultado={resultado?.ok ? null : resultado} />
      <div className="dcard">
        <h3>Pendientes de aprobación</h3>
        {pendientes.length ? pendientes.map((t) => (
          <div key={t.id} className="td-req-row">
            {info(t)}
            <div className="td-req-actions">
              <button className="mini-btn mini-btn-approve" disabled={pendiente} onClick={() => cambiar(t.id, 'aprobado')}>Aprobar</button>
              <button className="mini-btn mini-btn-reject" disabled={pendiente} onClick={() => cambiar(t.id, 'rechazado')}>Rechazar</button>
            </div>
          </div>
        )) : <Vacio>No hay solicitudes pendientes.</Vacio>}
      </div>
      <div className="dcard" style={{ marginTop: 18 }}>
        <h3>Aprobados y realizados</h3>
        {resto.length ? resto.map((t) => {
          const [clase, texto] = t.estado === 'hecho' ? ['status-hecho', 'Realizado'] : t.estado === 'rechazado' ? ['status-pendiente', 'Rechazado'] : ['status-aprobado', 'Aprobado'];
          return (
            <div key={t.id} className="td-req-row">
              {info(t)}
              <span className={`status-pill ${clase}`}>{texto}</span>
              {t.estado === 'aprobado' && (
                <button className="mini-btn mini-btn-approve" disabled={pendiente} onClick={() => cambiar(t.id, 'hecho')}>Marcar hecho</button>
              )}
            </div>
          );
        }) : <Vacio>Todavía no hay turnos aprobados.</Vacio>}
      </div>
    </div>
  );
}
