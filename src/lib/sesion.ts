import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { crearClienteServidor } from './supabase/server';
import type { Rol, Sucursal, Usuario } from './tipos';

export interface Sesion {
  usuario: Usuario;
  /** Sucursal propia del usuario (la de su ficha). */
  sucursal: Sucursal | null;
  /** Sucursales que puede ver: la propia y, si es supervisor, las de supervisor_sucursales. */
  misSucursales: number[];
}

/** Usuario logueado (cacheado por request). Redirige a /login si no hay sesión o si está dado de baja. */
export const obtenerSesion = cache(async (): Promise<Sesion> => {
  const supabase = await crearClienteServidor();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) redirect('/login');

  const { data: usuario } = await supabase.from('usuarios').select('*').eq('auth_id', uid).maybeSingle<Usuario>();
  if (!usuario || !usuario.activo) redirect('/login?error=usuario');

  const [{ data: sucursal }, { data: supervisadas }] = await Promise.all([
    usuario.sucursal_id
      ? supabase.from('sucursales').select('*').eq('id', usuario.sucursal_id).maybeSingle<Sucursal>()
      : Promise.resolve({ data: null }),
    supabase.from('supervisor_sucursales').select('sucursal_id').eq('usuario_id', usuario.id),
  ]);
  const misSucursales = [...new Set([usuario.sucursal_id, ...(supervisadas ?? []).map((s) => s.sucursal_id as number)])]
    .filter((id): id is number => id !== null);
  return { usuario, sucursal: sucursal ?? null, misSucursales };
});

/** Exige uno de los roles indicados; si no, manda al inicio que le corresponde. */
export async function exigirRol(roles: Rol[]): Promise<Sesion> {
  const sesion = await obtenerSesion();
  if (!roles.includes(sesion.usuario.rol)) redirect(rutaInicio(sesion.usuario.rol));
  return sesion;
}

export function rutaInicio(rol: Rol): string {
  return rol === 'vendedor' ? '/inicio' : '/gestion/mensajes';
}
