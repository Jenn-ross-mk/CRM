import { FiltroSelect } from '@/components/filtros';
import { listarModelos, listarPerfiles, listarSucursales, listarVentas, rangoMes } from '@/lib/datos';
import { mesClave, nombreMes } from '@/lib/fechas';
import { exigirRol } from '@/lib/sesion';
import { plural } from '@/lib/util';
import { TablaVentas } from './tabla';

type Params = { sector?: string; s?: string; v?: string; mes?: string };

export default async function VentasPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { perfil } = await exigirRol(['administrador', 'supervisor']);
  const params = await searchParams;
  const [todas, perfiles, sucursales, modelos] = await Promise.all([
    listarVentas(params.mes ? rangoMes(params.mes) : {}),
    listarPerfiles(),
    listarSucursales(),
    listarModelos(),
  ]);
  const sucursalForzada = perfil.rol === 'supervisor' ? perfil.sucursal_id : null;
  const ventas = todas.filter((v) =>
    (!sucursalForzada || v.sucursal_id === sucursalForzada) &&
    (!params.sector || v.sector === params.sector) &&
    (!params.s || String(v.sucursal_id) === params.s) &&
    (!params.v || v.vendedor_id === params.v)
  );
  const vendedores = perfiles.filter((p) => p.rol === 'vendedor' && (!sucursalForzada || p.sucursal_id === sucursalForzada));
  const meses = Array.from({ length: 12 }, (_, i) => mesClave(-i));

  return (
    <div className="dash">
      <div className="pipe-filters">
        <FiltroSelect param="sector" valor={params.sector ?? ''} opciones={[{ valor: '', etiqueta: 'Todos los sectores' }, { valor: 'Convencional', etiqueta: 'Convencional' }, { valor: 'Plan de ahorro', etiqueta: 'Plan de ahorro' }]} />
        {!sucursalForzada && (
          <FiltroSelect param="s" valor={params.s ?? ''} opciones={[{ valor: '', etiqueta: 'Todas las sucursales' }, ...sucursales.map((s) => ({ valor: String(s.id), etiqueta: s.nombre }))]} />
        )}
        <FiltroSelect param="v" valor={params.v ?? ''} opciones={[{ valor: '', etiqueta: 'Todos los vendedores' }, ...vendedores.map((v) => ({ valor: v.id, etiqueta: v.nombre }))]} />
        <FiltroSelect param="mes" valor={params.mes ?? ''} opciones={[{ valor: '', etiqueta: 'Todos los meses' }, ...meses.map((m) => ({ valor: m, etiqueta: nombreMes(m) }))]} />
        <span className="pipe-filters-note">{ventas.length} {plural(ventas.length, 'venta encontrada', 'ventas encontradas')}</span>
      </div>
      <TablaVentas
        ventas={ventas}
        nombres={Object.fromEntries(perfiles.map((p) => [p.id, p.nombre]))}
        sucursales={sucursales.filter((s) => !sucursalForzada || s.id === sucursalForzada)}
        vendedores={vendedores}
        modelos={modelos}
      />
    </div>
  );
}
