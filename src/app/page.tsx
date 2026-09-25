import { redirect } from 'next/navigation';
import { obtenerSesion, rutaInicio } from '@/lib/sesion';

export default async function Raiz() {
  const { usuario } = await obtenerSesion();
  redirect(rutaInicio(usuario.rol));
}
