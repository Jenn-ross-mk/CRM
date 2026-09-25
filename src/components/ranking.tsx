'use client';

import { useEffect, useRef } from 'react';
import { Vacio } from './ui';

export interface FilaRanking {
  id: number;
  nombre: string;
  sucursal: string;
  ventas: number;
}

/** Podio (2º - 1º - 3º) como en el mockup. */
export function Podio({ filas, onClick }: { filas: FilaRanking[]; onClick?: (f: FilaRanking) => void }) {
  const [p1, p2, p3] = filas;
  const card = (f: FilaRanking | undefined, pos: number) =>
    f && (
      <div key={pos} className={`pod-card pod-${pos}`} style={onClick ? { cursor: 'pointer' } : undefined} onClick={() => onClick?.(f)}>
        <div className="pod-medal">{pos}</div>
        <div className="pod-name">{f.nombre}</div>
        <div className="pod-count">{f.ventas}</div>
        <div className="pod-sub">ventas</div>
        <div className="pod-bar" />
      </div>
    );
  if (!filas.length) return <Vacio style={{ padding: 20 }}>Sin vendedores para este filtro.</Vacio>;
  return <div className="podium">{card(p2, 2)}{card(p1, 1)}{card(p3, 3)}</div>;
}

/** Posiciones del 4º en adelante. */
export function ListaRanking({ filas, onClick }: { filas: FilaRanking[]; onClick?: (f: FilaRanking) => void }) {
  const resto = filas.slice(3);
  const max = filas[0]?.ventas || 1;
  if (!filas.length) return null;
  if (!resto.length) return <Vacio style={{ padding: '8px 2px' }}>El podio ya incluye a todo el equipo de este sector.</Vacio>;
  return (
    <>
      {resto.map((f, i) => (
        <div key={f.id} className={`rank-list-row${onClick ? ' clickable' : ''}`} onClick={() => onClick?.(f)}>
          <div className="rl-num">{i + 4}</div>
          <div className="rl-name">{f.nombre}</div>
          <div className="rl-sucursal">{f.sucursal}</div>
          <div className="rl-bar-bg"><div className="rl-bar-fill" style={{ width: `${Math.round((f.ventas / max) * 100)}%` }} /></div>
          <div className="rl-count">{f.ventas}</div>
        </div>
      ))}
    </>
  );
}

/** Confeti al entrar al ranking (mismo efecto que el mockup). */
export function Confeti() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = parent.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const colores = ['#003366', '#3D6797', '#5A85B5', '#9FB4CC', '#C7D3E0', '#FFFFFF'];
    const piezas = Array.from({ length: 140 }, () => ({
      x: Math.random() * canvas.width, y: -20 - Math.random() * canvas.height * 0.5, w: 5 + Math.random() * 5, h: 8 + Math.random() * 6,
      color: colores[Math.floor(Math.random() * colores.length)], vel: 2 + Math.random() * 3, deriva: (Math.random() - 0.5) * 1.6,
      rot: Math.random() * 360, vrot: (Math.random() - 0.5) * 10, op: 1,
    }));
    const duracion = 2600;
    let inicio: number | null = null;
    let raf = 0;
    const frame = (ts: number) => {
      inicio ??= ts;
      const t = ts - inicio;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of piezas) {
        p.y += p.vel; p.x += p.deriva; p.rot += p.vrot;
        if (t > duracion * 0.6) p.op = Math.max(0, 1 - (t - duracion * 0.6) / (duracion * 0.4));
        ctx.save(); ctx.globalAlpha = p.op; ctx.translate(p.x, p.y); ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
      }
      if (t < duracion) raf = requestAnimationFrame(frame); else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }} />;
}
