import { Bandeja } from '@/components/bandeja/bandeja';
import { cargarBandeja, type ParamsBandeja } from '@/components/bandeja/cargar';
import { FiltroSelect } from '@/components/filtros';
import { exigirRol } from '@/lib/sesion';

export default async function MensajesPage({ searchParams }: { searchParams: Promise<ParamsBandeja> }) {
  const sesion = await exigirRol(['admin', 'supervisor']);
  const { usuario, misSucursales } = sesion;
  const params = await searchParams;
  const datos = await cargarBandeja('gestion', sesion, params);
  const vendedores = datos.usuarios.filter((u) => u.rol === 'vendedor' && (usuario.rol === 'admin' || (u.sucursal_id !== null && misSucursales.includes(u.sucursal_id))));

  return (
    <div className="dash" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="pipe-filters">
        <FiltroSelect param="v" valor={params.v ?? ''} limpiar={['lead']} opciones={[
          { valor: '', etiqueta: 'Todos los vendedores' },
          { valor: '__sin__', etiqueta: '— Sin asignar (bot o asignación manual) —' },
          { valor: String(usuario.id), etiqueta: `${usuario.nombre} (yo)` },
          ...vendedores.map((v) => ({ valor: String(v.id), etiqueta: `${v.nombre}${v.activo ? '' : ' (baja)'}` })),
        ]} />
        <span className="pipe-filters-note">
          Misma vista que la Bandeja del vendedor — acá se ven las conversaciones de {usuario.rol === 'supervisor' ? 'tus sucursales' : 'todos'}, no solo las propias.
        </span>
      </div>
      <div className="dcard" style={{ padding: 0, overflow: 'hidden', flex: 1, minHeight: 520 }}>
        <Bandeja {...datos} />
      </div>
    </div>
  );
}
