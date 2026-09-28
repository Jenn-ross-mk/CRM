import { ordenEtapa, ordenFinal } from '@/lib/constantes';
import { cargarPanel, listarSucursales, listarUsuarios } from '@/lib/datos';
import { fechaLocal } from '@/lib/fechas';
import { type Agenda, clasificarLead, fechaValida, periodoValido, rangoPeriodo } from '@/lib/panel';
import { obtenerSesion } from '@/lib/sesion';
import { PanelLeads, type ItemPanel } from './panel';

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

  const agendasPorLead = new Map<number, Agenda[]>();
  for (const a of datos.agendas) agendasPorLead.set(a.lead_id!, [...(agendasPorLead.get(a.lead_id!) ?? []), a]);
  const conVenta = new Set(datos.ventas.map((v) => v.lead_id));
  const ahora = new Date();

  const items: ItemPanel[] = datos.leads.map((lead) => {
    const agendas = agendasPorLead.get(lead.id) ?? [];
    const final = ordenFinal(datos.etapas, lead.sector);
    const vendido = conVenta.has(lead.id) || (final > 0 && ordenEtapa(datos.etapas, lead.etapa_id) >= final);
    return { lead, agendas, clasificacion: clasificarLead(lead, agendas, vendido, ahora) };
  });

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
