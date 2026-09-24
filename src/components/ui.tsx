'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import type { Resultado } from '@/lib/tipos';

/** Panel lateral deslizable (mismo estilo que los slide-overs del mockup). */
export function SlideOver({ abierto, titulo, onCerrar, children }: { abierto: boolean; titulo: string; onCerrar: () => void; children: React.ReactNode }) {
  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [abierto, onCerrar]);

  return (
    <>
      <div className={`slideover-backdrop${abierto ? ' visible' : ''}`} onClick={onCerrar} />
      <aside className={`slideover${abierto ? ' visible' : ''}`} aria-hidden={!abierto}>
        <div className="slideover-head">
          <h3>{titulo}</h3>
          <button className="cal-nav-btn" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </div>
        <div className="slideover-body">{abierto && children}</div>
      </aside>
    </>
  );
}

export function Toast({ resultado }: { resultado: Resultado | null }) {
  if (!resultado) return null;
  if (resultado.ok) return resultado.mensaje ? <div className="toast" role="status">{resultado.mensaje}</div> : null;
  return <div className="toast toast-error" role="alert">{resultado.error}</div>;
}

/** Ejecuta una Server Action con estado de "pendiente" y guarda el último resultado para mostrarlo. */
export function useAccion() {
  const [pendiente, iniciar] = useTransition();
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const ejecutar = useCallback(
    (fn: () => Promise<Resultado>, alTerminar?: (r: Resultado) => void) =>
      iniciar(async () => {
        const r = await fn();
        setResultado(r);
        alTerminar?.(r);
      }),
    []
  );
  const limpiar = useCallback(() => setResultado(null), []);
  return { pendiente, resultado, ejecutar, limpiar };
}

export const Vacio = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <p className="empty-state" style={style}>{children}</p>
);
