import { redirect } from 'next/navigation';
import { obtenerSesion, rutaInicio } from '@/lib/sesion';

export default async function Raiz() {
  const { perfil } = await obtenerSesion();
  redirect(rutaInicio(perfil.rol));
}
