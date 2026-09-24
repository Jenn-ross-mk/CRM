'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, useTransition } from 'react';
import { cerrarSesion } from '@/app/acciones/auth';
import { cambiarEstado } from '@/app/acciones/equipo';
import { iniciales } from '@/lib/util';
import type { EstadoUsuario, Perfil } from '@/lib/tipos';
import { Iconos } from './iconos';
import { ETIQUETA_ROL, itemsPorRol } from './navegacion';

export function Shell({ perfil, sucursal, children }: { perfil: Perfil; sucursal: string | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const items = itemsPorRol(perfil.rol);
  const actual = items.find((i) => pathname.startsWith(i.href));
  const esBandeja = pathname.startsWith('/bandeja');

  return (
    <div className="app">
      <nav className="rail">
        <div className="rail-logo">A</div>
        <div className="rail-group">
          {items.map((i) => (
            <Link key={i.href} href={i.href} title={i.titulo} className={`rail-item${actual?.href === i.href ? ' active' : ''}`}>
              {Iconos[i.icono]}
            </Link>
          ))}
        </div>
        <div className="rail-spacer" />
        <div className="rail-avatar" title={perfil.nombre}>{iniciales(perfil.nombre)}</div>
        <form action={cerrarSesion}>
          <button className="rail-logout" title="Cerrar sesión" style={{ border: 'none', background: 'none' }}>{Iconos.salir}</button>
        </form>
      </nav>

      <div className="main-col">
        <header className="topbar">
          <div className="topbar-left">
            <h1>
              {actual?.titulo ?? 'Akar CRM'} <span className="role-badge">{ETIQUETA_ROL[perfil.rol]}</span>
            </h1>
          </div>
          <div className="topbar-right">
            {sucursal && (
              <span className="filter-chip" title="Tu sucursal">Sucursal {sucursal}</span>
            )}
            {esBandeja && <Suspense><BuscadorLeads /></Suspense>}
            {perfil.rol === 'vendedor' && <SelectorEstado inicial={perfil.estado} />}
            <div className="avatar" title={perfil.nombre}>{iniciales(perfil.nombre)}</div>
          </div>
        </header>
        <main className="page-body">{children}</main>
      </div>
    </div>
  );
}

function BuscadorLeads() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');

  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get('q') ?? '') === q) return;
      const p = new URLSearchParams(params);
      if (q) p.set('q', q); else p.delete('q');
      p.delete('lead');
      router.replace(`?${p.toString()}`);
    }, 300);
    return () => clearTimeout(t);
  }, [q, params, router]);

  return (
    <label className="search-input">
      {Iconos.buscar}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar lead" aria-label="Buscar lead" />
    </label>
  );
}

function SelectorEstado({ inicial }: { inicial: EstadoUsuario }) {
  const [estado, setEstado] = useState(inicial);
  const [, iniciar] = useTransition();
  const opciones: EstadoUsuario[] = ['Activo', 'Ocupado', 'Desconectado'];
  return (
    <div className="status-toggle" role="radiogroup" aria-label="Estado">
      {opciones.map((o) => (
        <button key={o} role="radio" aria-checked={estado === o} className={`status-opt${estado === o ? ' active' : ''}`}
          onClick={() => { setEstado(o); iniciar(() => cambiarEstado(o)); }}>
          {o}
        </button>
      ))}
    </div>
  );
}
