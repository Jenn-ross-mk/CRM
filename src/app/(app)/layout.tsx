import { Shell } from '@/components/shell';
import { alertasDeHoy } from '@/lib/datos';
import { obtenerSesion } from '@/lib/sesion';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { usuario, sucursal, misSucursales } = await obtenerSesion();
  const alertas = await alertasDeHoy(usuario.id);
  return (
    <Shell usuario={usuario} alertasHoy={alertas.map((a) => ({ id: a.id, mensaje: a.mensaje, fecha_hora: a.fecha_hora, lead_id: a.lead_id }))} sucursal={misSucursales.length > 1 ? `${misSucursales.length} sucursales` : sucursal ? `Sucursal ${sucursal.nombre}` : null}>
      {children}
    </Shell>
  );
}
