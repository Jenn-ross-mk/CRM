import { Bandeja } from '@/components/bandeja/bandeja';
import { cargarBandeja, type ParamsBandeja } from '@/components/bandeja/cargar';
import { exigirRol } from '@/lib/sesion';

export default async function BandejaPage({ searchParams }: { searchParams: Promise<ParamsBandeja> }) {
  const sesion = await exigirRol(['vendedor']);
  const datos = await cargarBandeja('vendedor', sesion, await searchParams);
  return (
    <div className="page">
      <Bandeja {...datos} />
    </div>
  );
}
