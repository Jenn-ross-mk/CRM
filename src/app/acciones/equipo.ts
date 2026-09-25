'use server';

import { refresh } from 'next/cache';
import { headers } from 'next/headers';
import { contexto, error, ok, texto } from '@/lib/acciones';
import { SECTORES_VENTA } from '@/lib/constantes';
import { crearClienteAdmin } from '@/lib/supabase/server';
import type { EstadoUsuario, Resultado, Rol, Sector } from '@/lib/tipos';

export async function cambiarEstado(estado: EstadoUsuario): Promise<void> {
  const { supabase } = await contexto();
  await supabase.rpc('cambiar_mi_estado', { p_estado: estado });
}

async function urlBase() {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'http';
  return process.env.NEXT_PUBLIC_SITE_URL ?? `${proto}://${host}`;
}

const ROLES: Rol[] = ['vendedor', 'supervisor', 'admin'];
// Bloqueo "indefinido" (100 años) para las cuentas dadas de baja.
const BLOQUEO = '876000h';

/**
 * Alta o edición de un usuario. Solo administradores.
 * Alta: se crea la cuenta de login en Supabase Auth y el trigger de la base la vincula (o crea) en `usuarios`.
 */
export async function guardarUsuario(id: number | null, fd: FormData): Promise<Resultado> {
  const { esAdmin } = await contexto();
  if (!esAdmin) return error('Solo un administrador puede gestionar usuarios.');

  const nombre = texto(fd, 'nombre');
  const email = texto(fd, 'email').toLowerCase();
  const rol = ROLES.includes(texto(fd, 'rol') as Rol) ? (texto(fd, 'rol') as Rol) : 'vendedor';
  const sucursal_id = Number(texto(fd, 'sucursal_id')) || null;
  const sectorElegido = texto(fd, 'sector') as Sector;
  const datos = {
    nombre,
    email,
    telefono: texto(fd, 'telefono') || null,
    foto_url: texto(fd, 'foto_url') || null,
    rol,
    sucursal_id: rol === 'admin' ? null : sucursal_id,
    sector: rol === 'vendedor' ? (SECTORES_VENTA.includes(sectorElegido) ? sectorElegido : 'convencional') : null,
  };
  // Sucursales a cargo del supervisor (puede tener varias).
  const supervisadas = rol === 'supervisor' ? fd.getAll('supervisa').map(Number).filter(Boolean) : [];
  const password = texto(fd, 'password');

  if (!nombre) return error('Ingresá el nombre.');
  if (!email) return error('Ingresá el email.');
  if (rol === 'vendedor' && !sucursal_id) return error('Elegí la sucursal del vendedor.');
  if (rol === 'supervisor' && !sucursal_id && !supervisadas.length) return error('Elegí al menos una sucursal para el supervisor.');
  if (password && password.length < 8) return error('La contraseña provisoria debe tener al menos 8 caracteres.');

  const admin = crearClienteAdmin();
  let usuarioId = id;

  if (id) {
    const { data: actual } = await admin.from('usuarios').select('auth_id, email').eq('id', id).single<{ auth_id: string | null; email: string }>();
    if (!actual) return error('No se encontró el usuario.');
    if (actual.auth_id && actual.email !== email) {
      const { error: e1 } = await admin.auth.admin.updateUserById(actual.auth_id, { email, email_confirm: true });
      if (e1) return error(e1);
    }
    const { error: e2 } = await admin.from('usuarios').update(datos).eq('id', id);
    if (e2) return error(e2.code === '23505' ? 'Ya existe un usuario con ese email.' : e2);
    // Usuario cargado sin cuenta de login (por ejemplo, desde SQL): se le crea el acceso.
    if (!actual.auth_id && password) {
      const { error: e3 } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (e3) return error(e3.message.includes('already') ? 'Ya existe una cuenta de login con ese email.' : e3);
    }
  } else {
    if (!password) return error('Ingresá una contraseña provisoria.');
    const { data: creado, error: e } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      // app_metadata solo lo puede escribir el servidor: el trigger de la base lo usa para crear la ficha.
      app_metadata: { nombre, telefono: datos.telefono ?? '', rol, sucursal_id: datos.sucursal_id ? String(datos.sucursal_id) : '', sector: datos.sector ?? '' },
    });
    if (e || !creado.user) return error(e?.message.includes('already') ? 'Ya existe una cuenta de login con ese email.' : e ?? 'No se pudo crear la cuenta.');
    // Si ya existía una ficha con ese email, el trigger la vinculó: se actualiza con los datos del formulario.
    const { data: ficha, error: e2 } = await admin.from('usuarios').update(datos).eq('auth_id', creado.user.id).select('id').single();
    if (e2 || !ficha) return error(e2 ?? 'La cuenta se creó pero no quedó vinculada. Revisá el trigger de la Parte 6.');
    usuarioId = ficha.id;
  }

  const { error: e4 } = await admin.from('supervisor_sucursales').delete().eq('usuario_id', usuarioId);
  if (e4) return error(e4);
  if (supervisadas.length) {
    const { error: e5 } = await admin.from('supervisor_sucursales').insert(supervisadas.map((s) => ({ usuario_id: usuarioId, sucursal_id: s })));
    if (e5) return error(e5);
  }
  refresh();
  return ok(id ? 'Cambios guardados.' : 'Usuario creado.');
}

/**
 * Baja o reactivación. Nada se borra: la ficha queda con activo = false (sus conversaciones y ventas
 * siguen a su nombre) y la cuenta de login queda bloqueada.
 */
export async function cambiarActivo(id: number, activo: boolean): Promise<Resultado> {
  const { esAdmin, usuario } = await contexto();
  if (!esAdmin) return error('Solo un administrador puede dar de baja usuarios.');
  if (id === usuario.id) return error('No podés darte de baja a vos mismo.');
  const admin = crearClienteAdmin();
  const { data: u, error: e } = await admin.from('usuarios').update({ activo, ...(activo ? {} : { estado: 'desconectado' }) }).eq('id', id).select('auth_id').single();
  if (e || !u) return error(e ?? 'No se encontró el usuario.');
  if (u.auth_id) {
    const { error: e2 } = await admin.auth.admin.updateUserById(u.auth_id, { ban_duration: activo ? 'none' : BLOQUEO });
    if (e2) return error(e2);
  }
  refresh();
  return ok(activo ? 'Usuario reactivado.' : 'Usuario dado de baja.');
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
  const datos = { nombre: texto(fd, 'nombre'), direccion: texto(fd, 'direccion') || null, telefono: texto(fd, 'telefono') || null };
  if (!datos.nombre) return error('Ingresá el nombre de la sucursal.');
  const { error: e } = id ? await supabase.from('sucursales').update(datos).eq('id', id) : await supabase.from('sucursales').insert(datos);
  if (e) return error(e.code === '23505' ? 'Ya existe una sucursal con ese nombre.' : e);
  refresh();
  return ok();
}

/** Las sucursales no se borran (tienen localidades, leads y ventas): se desactivan. */
export async function cambiarSucursalActiva(id: number, activa: boolean): Promise<Resultado> {
  const { supabase, esAdmin } = await contexto();
  if (!esAdmin) return error('Solo un administrador puede gestionar sucursales.');
  const { error: e } = await supabase.from('sucursales').update({ activa }).eq('id', id);
  if (e) return error(e);
  refresh();
  return ok();
}
