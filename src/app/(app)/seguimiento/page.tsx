import { Seguimiento } from '@/components/seguimiento';
import { calcularSeguimiento } from '@/lib/datos';
import { exigirRol } from '@/lib/sesion';

export default async function SeguimientoPage() {
  const { perfil } = await exigirRol(['vendedor']);
  const { conteos, pendientes } = await calcularSeguimiento({ vendedorId: perfil.id });
  return (
    <div className="dash">
      <div className="pipe-filters">
        <span className="pipe-filters-note">
          Tus leads sin contacto, agrupados por antigüedad, desde 1 semana hasta 18 meses (los de Plan de Ahorro pueden seguir activos mucho tiempo mientras esperan adjudicación).
        </span>
      </div>
      <Seguimiento conteos={conteos} pendientes={pendientes} rutaLead="/bandeja" sub="Tus leads agrupados por tiempo sin contacto" />
    </div>
  );
}
