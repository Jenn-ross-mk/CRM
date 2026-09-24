'use client';

import { useActionState, useState, useTransition } from 'react';
import { iniciarSesion, solicitarRecuperacion } from '../acciones/auth';

export default function FormularioLogin() {
  const [error, accion, pendiente] = useActionState(iniciarSesion, null);
  const [email, setEmail] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  return (
    <form action={accion}>
      <div className="fld">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" placeholder="nombre@akarautomotores.com.ar"
          value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="fld">
        <label htmlFor="password">Contraseña</label>
        <input id="password" name="password" type="password" autoComplete="current-password" placeholder="••••••••" required />
      </div>
      <button className="alert-btn" style={{ width: '100%', marginTop: 6, padding: '10px 12px' }} disabled={pendiente}>
        {pendiente ? 'Ingresando…' : 'Ingresar'}
      </button>
      {error && <div className="login-error">{error}</div>}
      <button type="button" className="btn-link" style={{ marginTop: 14 }} disabled={enviando}
        onClick={() => {
          if (!email) { setAviso('Escribí tu email arriba y volvé a tocar este enlace.'); return; }
          iniciar(async () => setAviso(await solicitarRecuperacion(email)));
        }}>
        ¿Olvidaste tu contraseña?
      </button>
      {aviso && <div className="login-hint">{aviso}</div>}
    </form>
  );
}
