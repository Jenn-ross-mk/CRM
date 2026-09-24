import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { crearClienteServidor } from './supabase/server';
import type { Perfil, Rol, Sucursal } from './tipos';

export interface Sesion {
  perfil: Perfil;
  sucursal: Sucursal | null;
}

/** Perfil del usuario logueado (cacheado por request). Redirige a /login si no hay sesión. */
export const obtenerSesion = cache(async (): Promise<Sesion> => {
  const supabase = await crearClienteServidor();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) redirect('/login');

  const { data: perfil } = await supabase.from('perfiles').select('*').eq('id', uid).single<Perfil>();
  if (!perfil) redirect('/login?error=perfil');

  let sucursal: Sucursal | null = null;
  if (perfil.sucursal_id) {
    const { data } = await supabase.from('sucursales').select('*').eq('id', perfil.sucursal_id).single<Sucursal>();
    sucursal = data;
  }
  return { perfil, sucursal };
});

/** Exige uno de los roles indicados; si no, manda al inicio que le corresponde. */
export async function exigirRol(roles: Rol[]): Promise<Sesion> {
  const sesion = await obtenerSesion();
  if (!roles.includes(sesion.perfil.rol)) redirect(rutaInicio(sesion.perfil.rol));
  return sesion;
}

export function rutaInicio(rol: Rol): string {
  return rol === 'vendedor' ? '/inicio' : '/gestion/mensajes';
}
