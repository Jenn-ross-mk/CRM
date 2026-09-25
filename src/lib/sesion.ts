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

  // Una sola consulta: la ficha, su sucursal y las sucursales que supervisa.
  const { data } = await supabase
    .from('usuarios')
    .select('*, sucursal:sucursales!sucursal_id(*), supervisadas:supervisor_sucursales(sucursal_id)')
    .eq('auth_id', uid)
    .maybeSingle<Usuario & { sucursal: Sucursal | null; supervisadas: { sucursal_id: number }[] }>();
  if (!data || !data.activo) redirect('/login?error=usuario');

  const { sucursal, supervisadas, ...usuario } = data;
  const misSucursales = [...new Set([usuario.sucursal_id, ...supervisadas.map((s) => s.sucursal_id)])]
    .filter((id): id is number => id !== null);
  return { usuario, sucursal, misSucursales };
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
