import { cargarPanel, listarUsuarios } from '@/lib/datos';
import { clasificarLeads } from '@/lib/panel';
import { obtenerSesion } from '@/lib/sesion';
import { ListaClientes } from './lista';

// Todos los clientes que el usuario puede ver (RLS): el admin todos, el supervisor sus sucursales, el vendedor los suyos.
export default async function ClientesPage() {
  const { usuario, misSucursales } = await obtenerSesion();
  const [datos, usuarios] = await Promise.all([
    cargarPanel({ rango: null, vendedorId: null, sucursales: usuario.rol === 'admin' ? null : misSucursales, yoId: usuario.id, soloPropias: usuario.rol === 'vendedor' }),
    listarUsuarios(),
  ]);
  const items = clasificarLeads(datos.leads, datos.agendas, datos.ventas, datos.etapas)
    .sort((a, b) => b.lead.ultimo_mensaje_en.localeCompare(a.lead.ultimo_mensaje_en));
  return (
    <ListaClientes
      items={items}
      etapas={Object.fromEntries(datos.etapas.map((e) => [e.id, e.nombre]))}
      nombres={Object.fromEntries(usuarios.map((u) => [u.id, u.nombre]))}
      esGestion={usuario.rol !== 'vendedor'}
    />
  );
}
