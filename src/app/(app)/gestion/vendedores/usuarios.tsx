'use client';

import { useState } from 'react';
import { eliminarUsuario, enviarRestablecerPassword, guardarUsuario } from '@/app/acciones/equipo';
import { ETIQUETA_ROL } from '@/components/navegacion';
import { SlideOver, Toast, useAccion } from '@/components/ui';
import { SECTORES } from '@/lib/constantes';
import type { Perfil, Rol, Sucursal } from '@/lib/tipos';

type Props = { usuarios: Perfil[]; sucursales: Sucursal[]; yoId: string };

export function GestionUsuarios({ usuarios, sucursales, yoId }: Props) {
  const [editando, setEditando] = useState<Perfil | 'nuevo' | null>(null);
  const nombreSuc = (id: number | null) => sucursales.find((s) => s.id === id)?.nombre ?? '—';

  return (
    <div className="dash">
      <div className="pipe-filters">
        <span className="pipe-filters-note">Hacé clic en un usuario para ver, editar o eliminar su ficha. Los supervisores ven solo su sucursal.</span>
        <button className="btn-add-vendedor" onClick={() => setEditando('nuevo')}>+ Nuevo usuario</button>
      </div>
      <div className="dcard">
        <table className="admin-table">
          <thead><tr><th>Nombre</th><th>Rol</th><th>Sucursal</th><th>Sector</th><th>Email</th><th /></tr></thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="clickable" onClick={() => setEditando(u)}>
                <td className="venta-cliente">{u.nombre}</td>
                <td>{ETIQUETA_ROL[u.rol]}</td>
                <td><span className="pill">{nombreSuc(u.sucursal_id)}</span></td>
                <td>{u.sector ? <span className="pill">{u.sector}</span> : '—'}</td>
                <td>{u.email}</td>
                <td className="venta-chevron">›</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SlideOver abierto={!!editando} titulo={editando === 'nuevo' ? 'Nuevo usuario' : 'Perfil del usuario'} onCerrar={() => setEditando(null)}>
        {editando && <FormUsuario key={editando === 'nuevo' ? 'nuevo' : editando.id} usuario={editando === 'nuevo' ? null : editando} sucursales={sucursales} yoId={yoId} onListo={() => setEditando(null)} />}
      </SlideOver>
    </div>
  );
}

function FormUsuario({ usuario, sucursales, yoId, onListo }: { usuario: Perfil | null; sucursales: Sucursal[]; yoId: string; onListo: () => void }) {
  const [rol, setRol] = useState<Rol>(usuario?.rol ?? 'vendedor');
  const guardar = useAccion();
  const reset = useAccion();
  const borrar = useAccion();
  const esNuevo = !usuario;

  return (
    <>
      {usuario && (
        <div className="venta-hero">
          <div className="vh-model">{usuario.nombre}</div>
          <div className="vh-sub">{ETIQUETA_ROL[usuario.rol]}{usuario.sector ? ` · ${usuario.sector}` : ''} · Sucursal {sucursales.find((s) => s.id === usuario.sucursal_id)?.nombre ?? '—'}</div>
        </div>
      )}
      <form className="detail-block" style={{ padding: '0 0 16px' }} action={(fd) => guardar.ejecutar(() => guardarUsuario(usuario?.id ?? null, fd), (r) => r.ok && onListo())}>
        <p className="detail-label">{esNuevo ? 'Datos del nuevo usuario' : 'Editar datos'}</p>
        <div className="fld" style={{ marginBottom: 9 }}><label>Nombre</label><input name="nombre" defaultValue={usuario?.nombre} placeholder="Ej: L. Ramírez" required /></div>
        <div className="fld" style={{ marginBottom: 9 }}><label>Rol</label>
          <select name="rol" value={rol} onChange={(e) => setRol(e.target.value as Rol)} disabled={usuario?.id === yoId}>
            <option value="vendedor">Vendedor</option><option value="supervisor">Supervisor</option><option value="administrador">Administrador</option>
          </select>
          {usuario?.id === yoId && <input type="hidden" name="rol" value={rol} />}
        </div>
        {rol !== 'administrador' && (
          <div className="fld" style={{ marginBottom: 9 }}><label>Sucursal</label>
            <select name="sucursal_id" defaultValue={usuario?.sucursal_id ?? sucursales[0]?.id}>{sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select>
          </div>
        )}
        {rol === 'vendedor' && (
          <div className="fld" style={{ marginBottom: 9 }}><label>Sector</label>
            <select name="sector" defaultValue={usuario?.sector ?? 'Convencional'}>{SECTORES.map((s) => <option key={s}>{s}</option>)}</select>
          </div>
        )}
        <div className="fld" style={{ marginBottom: 9 }}><label>Email</label><input name="email" type="email" defaultValue={usuario?.email} placeholder="nombre@akarautomotores.com.ar" required /></div>
        <div className="fld"><label>Teléfono</label><input name="telefono" defaultValue={usuario?.telefono} placeholder="Ej: 297 400-1099" /></div>
        {esNuevo && <div className="fld" style={{ marginTop: 9 }}><label>Contraseña provisoria</label><input name="password" type="password" minLength={8} placeholder="Mínimo 8 caracteres" required /></div>}
        <button className="alert-btn" style={{ width: '100%', marginTop: 12, padding: '9px 12px' }} disabled={guardar.pendiente}>{esNuevo ? 'Crear usuario' : 'Guardar cambios'}</button>
        <Toast resultado={guardar.resultado?.ok ? null : guardar.resultado} />
      </form>
      {usuario && (
        <div className="detail-block" style={{ padding: 0 }}>
          <button className="alert-btn" style={{ width: '100%', background: 'var(--navy-500)', padding: '9px 12px' }} disabled={reset.pendiente}
            onClick={() => reset.ejecutar(() => enviarRestablecerPassword(usuario.email))}>
            Enviar email para restablecer contraseña
          </button>
          <Toast resultado={reset.resultado} />
          {usuario.id !== yoId && (
            <button className="btn-danger-outline" disabled={borrar.pendiente} onClick={() => {
              if (confirm(`¿Eliminar a ${usuario.nombre}? Sus conversaciones y ventas quedarán sin vendedor asignado.`)) borrar.ejecutar(() => eliminarUsuario(usuario.id), (r) => r.ok && onListo());
            }}>Eliminar usuario</button>
          )}
          <Toast resultado={borrar.resultado?.ok ? null : borrar.resultado} />
        </div>
      )}
    </>
  );
}
