import { FiltroSelect } from '@/components/filtros';
import { Seguimiento } from '@/components/seguimiento';
import { calcularSeguimiento, listarPerfiles, listarSucursales } from '@/lib/datos';
import { exigirRol } from '@/lib/sesion';

export default async function SeguimientoGestionPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { perfil } = await exigirRol(['administrador', 'supervisor']);
  const { s } = await searchParams;
  const sucursalId = perfil.rol === 'supervisor' ? perfil.sucursal_id : Number(s) || null;
  const [{ conteos, pendientes }, perfiles, sucursales] = await Promise.all([
    calcularSeguimiento({ sucursalId }),
    listarPerfiles(),
    listarSucursales(),
  ]);
  const nombres = Object.fromEntries(perfiles.map((p) => [p.id, p.nombre]));

  return (
    <div className="dash">
      <div className="pipe-filters">
        {perfil.rol === 'administrador' && (
          <FiltroSelect param="s" valor={s ?? ''} opciones={[{ valor: '', etiqueta: 'Todas las sucursales' }, ...sucursales.map((x) => ({ valor: String(x.id), etiqueta: `Sucursal ${x.nombre}` }))]} />
        )}
        <span className="pipe-filters-note">
          Leads sin contacto agrupados por antigüedad, desde 1 semana hasta 18 meses (leads de Plan de Ahorro esperando adjudicación pueden quedar activos mucho tiempo).
        </span>
      </div>
      <Seguimiento conteos={conteos} pendientes={pendientes} rutaLead="/gestion/mensajes" nombres={nombres} sub="Leads agrupados por tiempo sin contacto" />
    </div>
  );
}
