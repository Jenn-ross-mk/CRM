import { Bandeja } from '@/components/bandeja/bandeja';
import { cargarBandeja, type ParamsBandeja } from '@/components/bandeja/cargar';
import { exigirRol } from '@/lib/sesion';

export default async function BandejaPage({ searchParams }: { searchParams: Promise<ParamsBandeja> }) {
  const { perfil } = await exigirRol(['vendedor']);
  const datos = await cargarBandeja('vendedor', perfil, await searchParams);
  return (
    <div className="page">
      <Bandeja {...datos} />
    </div>
  );
}
