import { redirect } from 'next/navigation';

// La pestaña "Test drive" pasó a llamarse "Agendamientos": se mantiene la dirección vieja por si alguien la guardó.
export default function TestDriveAnterior() {
  redirect('/agendamientos');
}
