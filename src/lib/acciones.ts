import 'server-only';
import { crearClienteServidor } from './supabase/server';
import { obtenerSesion } from './sesion';
import type { Resultado } from './tipos';

/** Contexto común de las Server Actions: cliente con la sesión del usuario + su perfil. */
export async function contexto() {
  const [supabase, { perfil }] = await Promise.all([crearClienteServidor(), obtenerSesion()]);
  return { supabase, perfil, esGestion: perfil.rol !== 'vendedor', esAdmin: perfil.rol === 'administrador' };
}

export const ok = (mensaje?: string): Resultado => ({ ok: true, mensaje });
export const error = (e: unknown): Resultado => ({
  ok: false,
  error: typeof e === 'string' ? e : e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Ocurrió un error inesperado.',
});

export const texto = (fd: FormData, campo: string) => String(fd.get(campo) ?? '').trim();
