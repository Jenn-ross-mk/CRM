import { Shell } from '@/components/shell';
import { obtenerSesion } from '@/lib/sesion';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { usuario, sucursal, misSucursales } = await obtenerSesion();
  return (
    <Shell usuario={usuario} sucursal={misSucursales.length > 1 ? `${misSucursales.length} sucursales` : sucursal ? `Sucursal ${sucursal.nombre}` : null}>
      {children}
    </Shell>
  );
}
