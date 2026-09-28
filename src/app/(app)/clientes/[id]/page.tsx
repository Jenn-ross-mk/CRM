import { notFound } from 'next/navigation';
import { listarEtapas, listarModelos, listarSucursales, listarUsuarios, perfilCliente } from '@/lib/datos';
import { agendaVigente, clasificarLeads } from '@/lib/panel';
import { obtenerSesion } from '@/lib/sesion';
import { Perfil } from './perfil';

export default async function PerfilClientePage({ params }: { params: Promise<{ id: string }> }) {
  const [{ usuario }, { id }] = await Promise.all([obtenerSesion(), params]);
  const [perfil, etapas, usuarios, sucursales, modelos] = await Promise.all([
    perfilCliente(Number(id) || 0),
    listarEtapas(),
    listarUsuarios(),
    listarSucursales(),
    listarModelos(),
  ]);
  if (!perfil) notFound();

  // Dónde está hoy: la misma regla que el Panel general.
  const [{ clasificacion }] = clasificarLeads([perfil.lead], perfil.turnos.filter(agendaVigente), perfil.venta ? [perfil.venta] : [], etapas);

  return (
    <Perfil
      perfil={perfil}
      clasificacion={clasificacion}
      etapas={etapas}
      modelos={modelos}
      nombres={Object.fromEntries(usuarios.map((u) => [u.id, u.nombre]))}
      sucursales={Object.fromEntries(sucursales.map((s) => [s.id, s.nombre]))}
      yo={{ id: usuario.id, rol: usuario.rol }}
    />
  );
}
