import { FiltroSelect } from '@/components/filtros';
import { Seguimiento } from '@/components/seguimiento';
import { calcularSeguimiento, listarSucursales, listarUsuarios } from '@/lib/datos';
import { exigirRol } from '@/lib/sesion';

export default async function SeguimientoGestionPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { usuario, misSucursales } = await exigirRol(['admin', 'supervisor']);
  const { s } = await searchParams;
  const esAdmin = usuario.rol === 'admin';
  const elegida = Number(s) || null;
  const [{ conteos, pendientes }, usuarios, todas] = await Promise.all([
    calcularSeguimiento({ sucursales: elegida ? [elegida] : esAdmin ? null : misSucursales }),
    listarUsuarios(),
    listarSucursales(),
  ]);
  const sucursales = esAdmin ? todas : todas.filter((x) => misSucursales.includes(x.id));
  const nombres = Object.fromEntries(usuarios.map((u) => [u.id, u.nombre]));

  return (
    <div className="dash">
      <div className="pipe-filters">
        {sucursales.length > 1 && (
          <FiltroSelect param="s" valor={s ?? ''} opciones={[{ valor: '', etiqueta: esAdmin ? 'Todas las sucursales' : 'Todas mis sucursales' }, ...sucursales.map((x) => ({ valor: String(x.id), etiqueta: `Sucursal ${x.nombre}` }))]} />
        )}
        <span className="pipe-filters-note">
          Leads sin contacto agrupados por antigüedad, desde 1 semana hasta 18 meses (leads de Plan de Ahorro esperando adjudicación pueden quedar activos mucho tiempo).
        </span>
      </div>
      <Seguimiento conteos={conteos} pendientes={pendientes} rutaLead="/gestion/mensajes" nombres={nombres} sub="Leads agrupados por tiempo sin contacto" />
    </div>
  );
}
