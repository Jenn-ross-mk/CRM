import { redirect } from 'next/navigation';
import { crearClienteServidor } from '@/lib/supabase/server';
import FormularioLogin from './formulario-login';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getClaims();
  // Con ?error=usuario no se redirige: la sesión existe pero no hay un usuario activo vinculado (evita un bucle).
  if (data?.claims && !error) redirect('/');

  return (
    <div className="app">
      <div className="login-screen">
        <div className="login-card">
          <div className="login-logo">A</div>
          <h2>Akar CRM</h2>
          <p className="login-sub">Iniciá sesión para ver tu panel</p>
          <FormularioLogin errorInicial={error === 'usuario' ? 'Tu cuenta no está vinculada a un usuario activo del CRM. Contactá a un administrador.' : null} />
        </div>
      </div>
    </div>
  );
}
