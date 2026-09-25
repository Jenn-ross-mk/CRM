'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { crearClienteServidor } from '@/lib/supabase/server';
import { rutaInicio } from '@/lib/sesion';
import type { Rol } from '@/lib/tipos';

export async function iniciarSesion(_prev: string | null, formData: FormData): Promise<string | null> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return 'Ingresá tu email y contraseña.';

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return 'Email o contraseña incorrectos.';

  const { data: usuario } = await supabase.from('usuarios').select('rol, activo').eq('auth_id', data.user.id).maybeSingle<{ rol: Rol; activo: boolean }>();
  if (!usuario || !usuario.activo) {
    await supabase.auth.signOut();
    return usuario ? 'Tu usuario está dado de baja. Contactá a un administrador.' : 'Tu cuenta no está vinculada a ningún usuario del CRM. Contactá a un administrador.';
  }
  redirect(rutaInicio(usuario.rol));
}

export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function solicitarRecuperacion(email: string): Promise<string> {
  const supabase = await crearClienteServidor();
  const h = await headers();
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('x-forwarded-host') ?? h.get('host')}`;
  if (email) await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${base}/restablecer` });
  // Misma respuesta exista o no el email, para no revelar usuarios.
  return 'Si el email está registrado, te enviamos un enlace para restablecer la contraseña.';
}
