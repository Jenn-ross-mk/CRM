'use server';

import { refresh } from 'next/cache';
import { headers } from 'next/headers';
import { contexto, error, ok, texto } from '@/lib/acciones';
import { crearClienteAdmin } from '@/lib/supabase/server';
import type { EstadoUsuario, Resultado, Rol, Sector } from '@/lib/tipos';

export async function cambiarEstado(estado: EstadoUsuario): Promise<void> {
  const { supabase, perfil } = await contexto();
  await supabase.from('perfiles').update({ estado }).eq('id', perfil.id);
}

async function urlBase() {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'http';
  return process.env.NEXT_PUBLIC_SITE_URL ?? `${proto}://${host}`;
}

/** Alta o edición de un usuario (vendedor o supervisor). Solo administradores. */
export async function guardarUsuario(id: string | null, fd: FormData): Promise<Resultado> {
  const { esAdmin } = await contexto();
  if (!esAdmin) return error('Solo un administrador puede gestionar usuarios.');

  const nombre = texto(fd, 'nombre');
  const email = texto(fd, 'email').toLowerCase();
  const telefono = texto(fd, 'telefono');
  const rol = (texto(fd, 'rol') || 'vendedor') as Rol;
  const sucursal_id = Number(texto(fd, 'sucursal_id')) || null;
  const sector = rol === 'vendedor' ? ((texto(fd, 'sector') || 'Convencional') as Sector) : null;
  if (!nombre) return error('Ingresá el nombre.');
  if (!email) return error('Ingresá el email.');
  if (rol !== 'administrador' && !sucursal_id) return error('Elegí una sucursal.');

  const admin = crearClienteAdmin();
  if (id) {
    const { error: e1 } = await admin.auth.admin.updateUserById(id, { email, email_confirm: true });
    if (e1) return error(e1);
    const { error: e2 } = await admin.from('perfiles').update({ nombre, email, telefono, rol, sucursal_id, sector }).eq('id', id);
    if (e2) return error(e2);
    refresh();
    return ok('Cambios guardados.');
  }

  const password = texto(fd, 'password');
  if (password.length < 8) return error('La contraseña provisoria debe tener al menos 8 caracteres.');
  const { error: e } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre, telefono, rol, sucursal_id: sucursal_id ? String(sucursal_id) : '', sector: sector ?? '' },
  });
  if (e) return error(e.message.includes('already') ? 'Ya existe un usuario con ese email.' : e);
  refresh();
  return ok('Usuario creado.');
}

export async function eliminarUsuario(id: string): Promise<Resultado> {
  const { esAdmin, perfil } = await contexto();
  if (!esAdmin) return error('Solo un administrador puede eliminar usuarios.');
  if (id === perfil.id) return error('No podés eliminar tu propio usuario.');
  // Las conversaciones y ventas quedan sin vendedor asignado (on delete set null).
  const { error: e } = await crearClienteAdmin().auth.admin.deleteUser(id);
  if (e) return error(e);
  refresh();
  return ok();
}

export async function enviarRestablecerPassword(email: string): Promise<Resultado> {
  const { esAdmin } = await contexto();
  if (!esAdmin) return error('Solo un administrador puede hacer esto.');
  const { error: e } = await crearClienteAdmin().auth.resetPasswordForEmail(email, { redirectTo: `${await urlBase()}/restablecer` });
  if (e) return error(e);
  return ok(`Se envió un correo a ${email} para restablecer la contraseña.`);
}

export async function guardarSucursal(id: number | null, fd: FormData): Promise<Resultado> {
  const { supabase, esAdmin } = await contexto();
  if (!esAdmin) return error('Solo un administrador puede gestionar sucursales.');
  const datos = { nombre: texto(fd, 'nombre'), direccion: texto(fd, 'direccion'), telefono: texto(fd, 'telefono') };
  if (!datos.nombre) return error('Ingresá el nombre de la sucursal.');
  const { error: e } = id ? await supabase.from('sucursales').update(datos).eq('id', id) : await supabase.from('sucursales').insert(datos);
  if (e) return error(e.code === '23505' ? 'Ya existe una sucursal con ese nombre.' : e);
  refresh();
  return ok();
}

export async function eliminarSucursal(id: number): Promise<Resultado> {
  const { supabase, esAdmin } = await contexto();
  if (!esAdmin) return error('Solo un administrador puede eliminar sucursales.');
  const { error: e } = await supabase.from('sucursales').delete().eq('id', id);
  if (e) return error(e);
  refresh();
  return ok();
}
