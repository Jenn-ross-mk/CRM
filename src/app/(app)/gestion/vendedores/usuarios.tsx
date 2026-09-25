'use client';

import { useState } from 'react';
import { cambiarActivo, enviarRestablecerPassword, guardarUsuario } from '@/app/acciones/equipo';
import { ETIQUETA_ROL } from '@/components/navegacion';
import { Avatar, SlideOver, Toast, useAccion } from '@/components/ui';
import { ETIQUETA_SECTOR, SECTORES_VENTA, etiquetaSector } from '@/lib/constantes';
import type { Rol, Sucursal, Usuario } from '@/lib/tipos';

type Props = { usuarios: Usuario[]; sucursales: Sucursal[]; aCargo: Record<number, number[]>; yoId: number };

export function GestionUsuarios({ usuarios, sucursales, aCargo, yoId }: Props) {
  const [editando, setEditando] = useState<Usuario | 'nuevo' | null>(null);
  const nombreSuc = (id: number | null) => sucursales.find((s) => s.id === id)?.nombre ?? '—';
  const sucursalesDe = (u: Usuario) => {
    const ids = [...new Set([u.sucursal_id, ...(aCargo[u.id] ?? [])])].filter((x): x is number => x !== null);
    return ids.length ? ids.map(nombreSuc).join(', ') : u.rol === 'admin' ? 'Todas' : '—';
  };

  return (
    <div className="dash">
      <div className="pipe-filters">
        <span className="pipe-filters-note">Hacé clic en un usuario para ver o editar su ficha. Los usuarios no se borran: se dan de baja.</span>
        <button className="btn-add-vendedor" onClick={() => setEditando('nuevo')}>+ Nuevo usuario</button>
      </div>
      <div className="dcard">
        <table className="admin-table">
          <thead><tr><th /><th>Nombre</th><th>Rol</th><th>Sucursal</th><th>Sector</th><th>Email</th><th>Acceso</th><th /></tr></thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="clickable" onClick={() => setEditando(u)} style={u.activo ? undefined : { opacity: 0.55 }}>
                <td><Avatar mini nombre={u.nombre} foto={u.foto_url} /></td>
                <td className="venta-cliente">{u.nombre}{u.activo ? '' : ' (baja)'}</td>
                <td>{ETIQUETA_ROL[u.rol]}</td>
                <td><span className="pill">{sucursalesDe(u)}</span></td>
                <td>{u.sector ? <span className="pill">{etiquetaSector(u.sector)}</span> : '—'}</td>
                <td>{u.email}</td>
                <td>{u.auth_id ? 'Sí' : 'Sin cuenta'}</td>
                <td className="venta-chevron">›</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SlideOver abierto={!!editando} titulo={editando === 'nuevo' ? 'Nuevo usuario' : 'Ficha del usuario'} onCerrar={() => setEditando(null)}>
        {editando && (
          <FormUsuario key={editando === 'nuevo' ? 'nuevo' : editando.id} usuario={editando === 'nuevo' ? null : editando}
            aCargo={editando === 'nuevo' ? [] : aCargo[editando.id] ?? []} sucursales={sucursales} yoId={yoId} onListo={() => setEditando(null)} />
        )}
      </SlideOver>
    </div>
  );
}

function FormUsuario({ usuario, aCargo, sucursales, yoId, onListo }: { usuario: Usuario | null; aCargo: number[]; sucursales: Sucursal[]; yoId: number; onListo: () => void }) {
  const [rol, setRol] = useState<Rol>(usuario?.rol ?? 'vendedor');
  const guardar = useAccion();
  const reset = useAccion();
  const baja = useAccion();
  const esNuevo = !usuario;
  const soyYo = usuario?.id === yoId;
  const activas = sucursales.filter((s) => s.activa || s.id === usuario?.sucursal_id);

  return (
    <>
      {usuario && (
        <div className="venta-hero" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Avatar nombre={usuario.nombre} foto={usuario.foto_url} />
          <div>
            <div className="vh-model">{usuario.nombre}{usuario.activo ? '' : ' (baja)'}</div>
            <div className="vh-sub">{ETIQUETA_ROL[usuario.rol]}{usuario.sector ? ` · ${etiquetaSector(usuario.sector)}` : ''}</div>
          </div>
        </div>
      )}
      <form className="detail-block" style={{ padding: '0 0 16px' }} action={(fd) => guardar.ejecutar(() => guardarUsuario(usuario?.id ?? null, fd), (r) => r.ok && onListo())}>
        <p className="detail-label">{esNuevo ? 'Datos del nuevo usuario' : 'Editar datos'}</p>
        <div className="fld" style={{ marginBottom: 9 }}><label>Nombre</label><input name="nombre" defaultValue={usuario?.nombre} placeholder="Ej: Wildo Villar" required /></div>
        <div className="fld" style={{ marginBottom: 9 }}><label>Rol</label>
          <select name="rol" value={rol} onChange={(e) => setRol(e.target.value as Rol)} disabled={soyYo}>
            <option value="vendedor">Vendedor</option><option value="supervisor">Supervisor</option><option value="admin">Administrador</option>
          </select>
          {soyYo && <input type="hidden" name="rol" value={rol} />}
        </div>
        {rol !== 'admin' && (
          <div className="fld" style={{ marginBottom: 9 }}><label>{rol === 'supervisor' ? 'Sucursal propia (opcional)' : 'Sucursal'}</label>
            <select name="sucursal_id" defaultValue={usuario?.sucursal_id ?? (rol === 'vendedor' ? activas[0]?.id : '')}>
              {rol === 'supervisor' && <option value="">—</option>}
              {activas.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
        )}
        {rol === 'supervisor' && (
          <div className="fld" style={{ marginBottom: 9 }}><label>Sucursales a cargo</label>
            {activas.map((s) => (
              <label key={s.id} className="check-inline"><input type="checkbox" name="supervisa" value={s.id} defaultChecked={aCargo.includes(s.id)} /> {s.nombre}</label>
            ))}
          </div>
        )}
        {rol === 'vendedor' && (
          <div className="fld" style={{ marginBottom: 9 }}><label>Sector</label>
            <select name="sector" defaultValue={usuario?.sector ?? 'convencional'}>{SECTORES_VENTA.map((s) => <option key={s} value={s}>{ETIQUETA_SECTOR[s]}</option>)}</select>
          </div>
        )}
        <div className="fld" style={{ marginBottom: 9 }}><label>Email</label><input name="email" type="email" defaultValue={usuario?.email} placeholder="nombre@akar.com.ar" required /></div>
        <div className="fld" style={{ marginBottom: 9 }}><label>Teléfono</label><input name="telefono" defaultValue={usuario?.telefono ?? ''} placeholder="Ej: 2974000000" /></div>
        <div className="fld"><label>Foto (URL, opcional)</label><input name="foto_url" type="url" defaultValue={usuario?.foto_url ?? ''} placeholder="https://…" /></div>
        {(esNuevo || !usuario.auth_id) && (
          <div className="fld" style={{ marginTop: 9 }}>
            <label>{esNuevo ? 'Contraseña provisoria' : 'Contraseña provisoria (para crearle el acceso)'}</label>
            <input name="password" type="password" minLength={8} placeholder="Mínimo 8 caracteres" required={esNuevo} />
          </div>
        )}
        <button className="alert-btn" style={{ width: '100%', marginTop: 12, padding: '9px 12px' }} disabled={guardar.pendiente}>{esNuevo ? 'Crear usuario' : 'Guardar cambios'}</button>
        <Toast resultado={guardar.resultado?.ok ? null : guardar.resultado} />
      </form>
      {usuario && (
        <div className="detail-block" style={{ padding: 0 }}>
          {usuario.auth_id && (
            <>
              <button className="alert-btn" style={{ width: '100%', background: 'var(--navy-500)', padding: '9px 12px' }} disabled={reset.pendiente}
                onClick={() => reset.ejecutar(() => enviarRestablecerPassword(usuario.email))}>
                Enviar email para restablecer contraseña
              </button>
              <Toast resultado={reset.resultado} />
            </>
          )}
          {!soyYo && (
            <button className="btn-danger-outline" disabled={baja.pendiente} onClick={() => {
              if (!usuario.activo) { baja.ejecutar(() => cambiarActivo(usuario.id, true), (r) => r.ok && onListo()); return; }
              if (confirm(`¿Dar de baja a ${usuario.nombre}? No va a poder iniciar sesión ni recibir leads. Sus conversaciones y ventas quedan guardadas.`)) {
                baja.ejecutar(() => cambiarActivo(usuario.id, false), (r) => r.ok && onListo());
              }
            }}>{usuario.activo ? 'Dar de baja' : 'Reactivar usuario'}</button>
          )}
          <Toast resultado={baja.resultado?.ok ? null : baja.resultado} />
        </div>
      )}
    </>
  );
}
