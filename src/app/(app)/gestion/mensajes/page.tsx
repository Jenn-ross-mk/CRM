import { Bandeja } from '@/components/bandeja/bandeja';
import { cargarBandeja, type ParamsBandeja } from '@/components/bandeja/cargar';
import { FiltroSelect } from '@/components/filtros';
import { exigirRol } from '@/lib/sesion';

export default async function MensajesPage({ searchParams }: { searchParams: Promise<ParamsBandeja> }) {
  const { perfil } = await exigirRol(['administrador', 'supervisor']);
  const params = await searchParams;
  const datos = await cargarBandeja('gestion', perfil, params);
  const vendedores = datos.perfiles.filter((p) => p.rol === 'vendedor' && (perfil.rol === 'administrador' || p.sucursal_id === perfil.sucursal_id));

  return (
    <div className="dash" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="pipe-filters">
        <FiltroSelect param="v" valor={params.v ?? ''} limpiar={['lead']} opciones={[
          { valor: '', etiqueta: 'Todos los vendedores' },
          { valor: '__sin__', etiqueta: '— Sin asignar —' },
          { valor: perfil.id, etiqueta: `${perfil.nombre} (yo)` },
          ...vendedores.map((v) => ({ valor: v.id, etiqueta: v.nombre })),
        ]} />
        <span className="pipe-filters-note">
          Misma vista que la Bandeja del vendedor — acá se ven las conversaciones de {perfil.rol === 'supervisor' ? 'toda tu sucursal' : 'todos'}, no solo las propias.
        </span>
      </div>
      <div className="dcard" style={{ padding: 0, overflow: 'hidden', flex: 1, minHeight: 520 }}>
        <Bandeja {...datos} />
      </div>
    </div>
  );
}
