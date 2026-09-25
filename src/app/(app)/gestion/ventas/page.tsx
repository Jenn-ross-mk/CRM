import { FiltroSelect } from '@/components/filtros';
import { ETIQUETA_SECTOR, SECTORES_VENTA } from '@/lib/constantes';
import { listarModelos, listarSucursales, listarUsuarios, listarVentas, rangoMes } from '@/lib/datos';
import { mesClave, nombreMes } from '@/lib/fechas';
import { exigirRol } from '@/lib/sesion';
import { plural } from '@/lib/util';
import { TablaVentas } from './tabla';

type Params = { sector?: string; s?: string; v?: string; mes?: string };

export default async function VentasPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { usuario, misSucursales } = await exigirRol(['admin', 'supervisor']);
  const params = await searchParams;
  const [todas, usuarios, sucursales, modelos] = await Promise.all([
    listarVentas(params.mes && /^\d{4}-\d{2}$/.test(params.mes) ? rangoMes(params.mes) : {}),
    listarUsuarios(),
    listarSucursales(),
    listarModelos(),
  ]);
  const acotado = usuario.rol === 'supervisor';
  const ventas = todas.filter((v) =>
    (!acotado || (v.sucursal_id !== null && misSucursales.includes(v.sucursal_id))) &&
    (!params.sector || v.sector === params.sector) &&
    (!params.s || String(v.sucursal_id) === params.s) &&
    (!params.v || String(v.vendedor_id) === params.v)
  );
  const vendedores = usuarios.filter((u) => u.rol === 'vendedor' && (!acotado || (u.sucursal_id !== null && misSucursales.includes(u.sucursal_id))));
  const sucursalesVisibles = sucursales.filter((s) => !acotado || misSucursales.includes(s.id));
  const meses = Array.from({ length: 12 }, (_, i) => mesClave(-i));

  return (
    <div className="dash">
      <div className="pipe-filters">
        <FiltroSelect param="sector" valor={params.sector ?? ''} opciones={[{ valor: '', etiqueta: 'Todos los sectores' }, ...SECTORES_VENTA.map((s) => ({ valor: s, etiqueta: ETIQUETA_SECTOR[s] }))]} />
        {sucursalesVisibles.length > 1 && (
          <FiltroSelect param="s" valor={params.s ?? ''} opciones={[{ valor: '', etiqueta: 'Todas las sucursales' }, ...sucursalesVisibles.map((s) => ({ valor: String(s.id), etiqueta: s.nombre }))]} />
        )}
        <FiltroSelect param="v" valor={params.v ?? ''} opciones={[{ valor: '', etiqueta: 'Todos los vendedores' }, ...vendedores.map((v) => ({ valor: String(v.id), etiqueta: v.nombre }))]} />
        <FiltroSelect param="mes" valor={params.mes ?? ''} opciones={[{ valor: '', etiqueta: 'Todos los meses' }, ...meses.map((m) => ({ valor: m, etiqueta: nombreMes(m) }))]} />
        <span className="pipe-filters-note">{ventas.length} {plural(ventas.length, 'venta encontrada', 'ventas encontradas')}</span>
      </div>
      <TablaVentas
        ventas={ventas}
        nombres={Object.fromEntries(usuarios.map((u) => [u.id, u.nombre]))}
        sucursales={sucursalesVisibles}
        vendedores={vendedores.filter((v) => v.activo)}
        modelos={modelos}
      />
    </div>
  );
}
