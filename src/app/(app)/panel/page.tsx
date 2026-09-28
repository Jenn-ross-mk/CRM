import { cargarPanel, listarSucursales, listarUsuarios } from '@/lib/datos';
import { fechaLocal } from '@/lib/fechas';
import { clasificarLeads, fechaValida, periodoValido, rangoPeriodo } from '@/lib/panel';
import { obtenerSesion } from '@/lib/sesion';
import { PanelLeads } from './panel';

type Params = { p?: string; d?: string; v?: string };

// Primera pantalla de todos los roles. Qué leads ve cada uno lo decide RLS: admin todos, supervisor sus sucursales, vendedor los suyos.
export default async function PanelPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { usuario, misSucursales } = await obtenerSesion();
  const params = await searchParams;
  const esGestion = usuario.rol !== 'vendedor';
  const hoy = fechaLocal();
  const periodo = periodoValido(params.p);
  const fecha = fechaValida(params.d, hoy);
  const vendedorId = esGestion ? Number(params.v) || null : null;

  const [datos, usuarios, sucursales] = await Promise.all([
    cargarPanel({
      rango: rangoPeriodo(periodo, fecha),
      vendedorId,
      sucursales: usuario.rol === 'admin' ? null : misSucursales,
      yoId: usuario.id,
      soloPropias: usuario.rol === 'vendedor',
    }),
    listarUsuarios(),
    listarSucursales(),
  ]);

  const items = clasificarLeads(datos.leads, datos.agendas, datos.ventas, datos.etapas);

  const vendedores = usuarios.filter((u) => u.rol === 'vendedor' && (usuario.rol === 'admin' || (u.sucursal_id !== null && misSucursales.includes(u.sucursal_id))));

  return (
    <PanelLeads
      items={items.filter((i) => i.clasificacion.bloque !== 'vendido')}
      ventas={datos.ventas}
      etapas={datos.etapas}
      periodo={periodo}
      fecha={fecha}
      hoy={hoy}
      vendedorId={vendedorId}
      vendedores={esGestion ? vendedores.map((v) => ({ id: v.id, nombre: v.activo ? v.nombre : `${v.nombre} (baja)` })) : []}
      nombres={Object.fromEntries(usuarios.map((u) => [u.id, u.nombre]))}
      sucursales={Object.fromEntries(sucursales.map((s) => [s.id, s.nombre]))}
      yo={{ id: usuario.id, rol: usuario.rol, nombre: usuario.nombre }}
    />
  );
}
