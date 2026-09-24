import { exigirRol } from '@/lib/sesion';

// Toda la consola de gestión es solo para administradores y supervisores.
export default async function GestionLayout({ children }: { children: React.ReactNode }) {
  await exigirRol(['administrador', 'supervisor']);
  return children;
}
