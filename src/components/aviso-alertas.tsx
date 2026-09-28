'use client';

import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';
import { fechaLocal, horaLocal } from '@/lib/fechas';
import { Iconos } from './iconos';

export interface AlertaAviso {
  id: number;
  mensaje: string;
  fecha_hora: string;
  lead_id: number | null;
}

/**
 * Aviso emergente con las alertas de hoy (agendamientos y recordatorios). Aparece al entrar al CRM;
 * "Entendido" lo oculta hasta mañana en este navegador, salvo que aparezca una alerta nueva para hoy.
 */
const suscribir = (aviso: () => void) => {
  window.addEventListener('storage', aviso);
  return () => window.removeEventListener('storage', aviso);
};
const leer = (clave: string) => {
  try { return localStorage.getItem(clave) ?? ''; } catch { return ''; }
};

export function AvisoAlertas({ usuarioId, alertas, rutaAgenda, rutaChat }: {
  usuarioId: number; alertas: AlertaAviso[]; rutaAgenda: string | null; rutaChat: string;
}) {
  const clave = `aviso-alertas-${usuarioId}-${fechaLocal()}`;
  const firma = alertas.map((a) => a.id).join(',');
  // Qué alertas ya se vieron hoy en este navegador. En el servidor se asumen vistas: el aviso aparece al cargar en el navegador.
  const vistas = useSyncExternalStore(suscribir, () => leer(clave), () => firma);
  const [cerradas, setCerradas] = useState('');

  const pendientes = firma.split(',').filter((id) => id && !`,${vistas},${cerradas},`.includes(`,${id},`));
  if (!pendientes.length) return null;
  const cerrar = () => {
    try { localStorage.setItem(clave, firma); } catch { /* sin almacenamiento: se oculta solo en esta visita */ }
    setCerradas(firma);
  };

  return (
    <div className="aviso-fondo" role="dialog" aria-modal="true" aria-labelledby="aviso-titulo" onClick={cerrar}>
      <div className="aviso" onClick={(e) => e.stopPropagation()}>
        <div className="aviso-head">
          <span className="aviso-icono">{Iconos.campana}</span>
          <div>
            <h3 id="aviso-titulo">Tenés {alertas.length} {alertas.length === 1 ? 'alerta' : 'alertas'} para hoy</h3>
            <p>Llamadas, visitas, test drives aprobados y recordatorios del día.</p>
          </div>
        </div>
        <div className="aviso-lista">
          {alertas.map((a) => (
            <div key={a.id} className="aviso-item">
              <span className="aviso-hora">{horaLocal(a.fecha_hora)}</span>
              <span className="aviso-texto">{a.mensaje}</span>
              {a.lead_id && <Link className="btn-link" href={`${rutaChat}?lead=${a.lead_id}`} onClick={cerrar}>Ver chat</Link>}
            </div>
          ))}
        </div>
        <div className="aviso-acciones">
          {rutaAgenda && <Link className="alert-btn aviso-btn-sec" href={rutaAgenda} onClick={cerrar}>Ver agendamientos</Link>}
          <button className="alert-btn" autoFocus onClick={cerrar}>Entendido</button>
        </div>
      </div>
    </div>
  );
}
