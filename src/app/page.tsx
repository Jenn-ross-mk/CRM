import { redirect } from 'next/navigation';
import { obtenerSesion, rutaInicio } from '@/lib/sesion';

export default async function Raiz() {
  await obtenerSesion(); // redirige a /login si no hay sesión
  redirect(rutaInicio());
}
