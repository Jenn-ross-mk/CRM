import { redirect } from 'next/navigation';
import { crearClienteServidor } from '@/lib/supabase/server';
import FormularioLogin from './formulario-login';

export default async function LoginPage() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect('/');

  return (
    <div className="app">
      <div className="login-screen">
        <div className="login-card">
          <div className="login-logo">A</div>
          <h2>Akar CRM</h2>
          <p className="login-sub">Iniciá sesión para ver tu panel</p>
          <FormularioLogin />
        </div>
      </div>
    </div>
  );
}
