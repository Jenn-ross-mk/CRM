import { Shell } from '@/components/shell';
import { obtenerSesion } from '@/lib/sesion';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { perfil, sucursal } = await obtenerSesion();
  return (
    <Shell perfil={perfil} sucursal={sucursal?.nombre ?? null}>
      {children}
    </Shell>
  );
}
