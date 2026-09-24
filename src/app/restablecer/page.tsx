'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { crearClienteNavegador } from '@/lib/supabase/client';

// Destino del enlace de recuperación de contraseña. Soporta el flujo PKCE (?code=)
// y el implícito (#access_token=), según desde dónde se haya pedido el correo.
export default function RestablecerPage() {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const supabase = crearClienteNavegador();
    (async () => {
      const code = new URLSearchParams(window.location.search).get('code');
      const hash = new URLSearchParams(window.location.hash.slice(1));
      if (code) {
        const { error: e } = await supabase.auth.exchangeCodeForSession(code);
        if (e) return setError('El enlace venció o ya fue usado. Pedí uno nuevo.');
      } else if (hash.get('access_token') && hash.get('refresh_token')) {
        const { error: e } = await supabase.auth.setSession({ access_token: hash.get('access_token')!, refresh_token: hash.get('refresh_token')! });
        if (e) return setError('El enlace venció o ya fue usado. Pedí uno nuevo.');
      } else {
        const { data } = await supabase.auth.getSession();
        if (!data.session) return setError('Enlace inválido. Pedí uno nuevo desde la pantalla de ingreso.');
      }
      window.history.replaceState(null, '', '/restablecer');
      setListo(true);
    })();
  }, []);

  async function guardar(fd: FormData) {
    const pass = String(fd.get('password') ?? '');
    if (pass.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    if (pass !== String(fd.get('confirmar') ?? '')) return setError('Las contraseñas no coinciden.');
    setGuardando(true);
    const { error: e } = await crearClienteNavegador().auth.updateUser({ password: pass });
    setGuardando(false);
    if (e) return setError(e.message);
    router.replace('/');
  }

  return (
    <div className="app">
      <div className="login-screen">
        <div className="login-card">
          <div className="login-logo">A</div>
          <h2>Nueva contraseña</h2>
          <p className="login-sub">Elegí una contraseña para tu cuenta</p>
          {listo ? (
            <form action={guardar}>
              <div className="fld"><label htmlFor="password">Contraseña</label><input id="password" name="password" type="password" autoComplete="new-password" required /></div>
              <div className="fld"><label htmlFor="confirmar">Repetir contraseña</label><input id="confirmar" name="confirmar" type="password" autoComplete="new-password" required /></div>
              <button className="alert-btn" style={{ width: '100%', marginTop: 6, padding: '10px 12px' }} disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar contraseña'}
              </button>
            </form>
          ) : !error && <p className="login-sub">Verificando enlace…</p>}
          {error && <div className="login-error">{error}</div>}
        </div>
      </div>
    </div>
  );
}
