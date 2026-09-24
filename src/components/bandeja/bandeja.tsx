'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { enviarMensaje, marcarLeido } from '@/app/acciones/leads';
import type { DetalleLead, LeadBandeja } from '@/lib/datos';
import { horaBandeja, horaLocal } from '@/lib/fechas';
import type { Perfil, Sucursal } from '@/lib/tipos';
import { iniciales } from '@/lib/util';
import { useAccion } from '../ui';
import { FormNuevoLead } from './form-nuevo-lead';
import { PanelDetalle } from './panel-detalle';

export interface PropsBandeja {
  modo: 'vendedor' | 'gestion';
  leads: LeadBandeja[];
  filtroLeido: 'no' | 'si';
  seleccionado: DetalleLead | null;
  perfiles: Perfil[];
  sucursales: Sucursal[];
  modelos: string[];
  yo: Perfil;
}

export function Bandeja(props: PropsBandeja) {
  const { modo, leads, filtroLeido, seleccionado, perfiles, sucursales } = props;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [nuevoAbierto, setNuevoAbierto] = useState(false);

  const nombres = useMemo(() => new Map(perfiles.map((p) => [p.id, p.nombre])), [perfiles]);
  const sucursalNombre = useMemo(() => new Map(sucursales.map((s) => [s.id, s.nombre])), [sucursales]);
  const noLeidos = leads.filter((l) => !l.leido).length;
  const lista = leads.filter((l) => (filtroLeido === 'no' ? !l.leido : l.leido));
  // La conversación abierta sigue visible en la lista aunque se haya marcado como leída.
  if (seleccionado && !lista.some((l) => l.id === seleccionado.lead.id)) {
    const actual = leads.find((l) => l.id === seleccionado.lead.id);
    if (actual && filtroLeido === 'no') lista.unshift(actual);
  }

  const navegar = (cambios: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    Object.entries(cambios).forEach(([k, v]) => (v === null ? p.delete(k) : p.set(k, v)));
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
  };

  useEffect(() => {
    if (!seleccionado) return;
    if (!seleccionado.lead.leido) marcarLeido(seleccionado.lead.id);
    // Fijar en la URL el lead abierto por defecto: así los refrescos posteriores (enviar, reasignar…) no cambian de conversación.
    if (!params.get('lead')) {
      const p = new URLSearchParams(params);
      p.set('lead', String(seleccionado.lead.id));
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    }
  }, [seleccionado, params, pathname, router]);

  const lead = seleccionado?.lead;

  return (
    <div className="body-row" style={modo === 'gestion' ? { height: '100%' } : undefined}>
      <div className="inbox">
        <div className="inbox-tabs">
          <div className={`inbox-tab${filtroLeido === 'no' ? ' active' : ''}`} onClick={() => navegar({ f: null, lead: null })}>
            No leídos <span>· {noLeidos}</span>
          </div>
          <div className={`inbox-tab${filtroLeido === 'si' ? ' active' : ''}`} onClick={() => navegar({ f: 'si', lead: null })}>
            Leídos <span>· {leads.length - noLeidos}</span>
          </div>
        </div>
        <div className="inbox-actions">
          <span className="pipe-filters-note">{lista.length} conversaciones</span>
          <button className="btn-link" onClick={() => setNuevoAbierto(true)}>+ Nuevo lead</button>
        </div>
        <div className="inbox-list">
          {lista.length ? lista.map((l) => (
            <div key={l.id} className={`chat-item${l.id === lead?.id ? ' selected' : ''}`} onClick={() => navegar({ lead: String(l.id) })}>
              <div className="avatar">{iniciales(l.nombre)}</div>
              <div className="chat-meta">
                <div className="chat-top-row">
                  <span className="chat-name">{l.nombre}</span>
                  <span className="chat-time">{horaBandeja(l.ultimo_mensaje_at)}</span>
                </div>
                <div className="chat-snippet">{l.ultima_direccion === 'out' ? 'Vos: ' : ''}{l.ultimo_texto ?? 'Sin mensajes'}</div>
                <div className="chat-badges">
                  <span className="chan-tag">{l.canal.toUpperCase()}</span>
                  <span className={`priority-dot p-${l.prioridad}`} title={`Prioridad ${l.prioridad}`} />
                  {modo === 'gestion' && (
                    <span className="msg-vendor-tag" style={l.vendedor_id ? undefined : { color: 'var(--slate)', fontWeight: 600 }}>
                      {l.vendedor_id ? nombres.get(l.vendedor_id) ?? '—' : 'Sin asignar'}
                    </span>
                  )}
                  {!l.leido && l.id !== lead?.id && <span className="unread-dot" />}
                </div>
              </div>
            </div>
          )) : (
            <div className="empty-slots" style={{ padding: '30px 16px' }}>
              {modo === 'vendedor' ? 'No tenés conversaciones acá.' : 'No hay conversaciones en esta categoría.'}
            </div>
          )}
        </div>
      </div>

      {seleccionado && lead ? (
        <>
          <Conversacion detalle={seleccionado} modo={modo} nombres={nombres} sucursal={lead.sucursal_id ? sucursalNombre.get(lead.sucursal_id) ?? '—' : '—'} />
          <PanelDetalle key={lead.id} {...props} detalle={seleccionado} nombres={nombres} sucursalNombre={sucursalNombre} />
        </>
      ) : (
        <div className="conversation">
          <div className="conv-header">
            <div className="conv-header-top"><span className="conv-name">Sin conversaciones</span></div>
            <div className="conv-sub">{modo === 'vendedor' ? 'No tenés conversaciones en esta bandeja todavía.' : 'Elegí una conversación de la lista.'}</div>
          </div>
          <div className="messages" />
        </div>
      )}

      <FormNuevoLead abierto={nuevoAbierto} onCerrar={() => setNuevoAbierto(false)} {...props}
        onCreado={(id) => { setNuevoAbierto(false); navegar({ lead: id, f: 'si' }); }} />
    </div>
  );
}

function Conversacion({ detalle, modo, nombres, sucursal }: { detalle: DetalleLead; modo: 'vendedor' | 'gestion'; nombres: Map<string, string>; sucursal: string }) {
  const { lead, mensajes } = detalle;
  const [texto, setTexto] = useState('');
  const { pendiente, resultado, ejecutar } = useAccion();
  const fin = useRef<HTMLDivElement>(null);

  useEffect(() => { fin.current?.scrollIntoView({ block: 'end' }); }, [mensajes.length, lead.id]);

  const enviar = () => {
    const t = texto;
    if (!t.trim()) return;
    ejecutar(() => enviarMensaje(lead.id, t), (r) => r.ok && setTexto(''));
  };

  const prioridad = { alta: 'Prioridad alta', media: 'Prioridad media', baja: 'Prioridad baja' }[lead.prioridad];
  const atiende = lead.vendedor_id ? `Atiende ${nombres.get(lead.vendedor_id) ?? '—'}` : 'Sin asignar';

  return (
    <div className="conversation">
      <div className="conv-header">
        <div className="conv-header-top">
          <span className="conv-name">{lead.nombre}</span>
          <span className={`pill ${lead.prioridad === 'alta' ? 'pill-navy' : lead.prioridad === 'media' ? 'pill-charcoal' : 'pill-outline'}`}>{prioridad}</span>
          <span className="pill pill-outline">{lead.sector}</span>
        </div>
        <div className="conv-sub">
          {lead.telefono || 'Sin teléfono'} · Sucursal {sucursal}{modo === 'gestion' ? ` · ${atiende}` : ''}
        </div>
      </div>
      <div className="messages">
        {mensajes.map((m) => (
          <div key={m.id} className={`msg msg-${m.direccion}`}>
            {modo === 'gestion' && m.direccion === 'out' && m.autor_id && <div className="msg-author">{nombres.get(m.autor_id)}</div>}
            {m.texto}
            <div className="msg-time">{horaBandeja(m.created_at) === horaLocal(m.created_at) ? horaLocal(m.created_at) : `${horaBandeja(m.created_at)} · ${horaLocal(m.created_at)}`}</div>
          </div>
        ))}
        {!mensajes.length && <div className="empty-slots">Todavía no hay mensajes en esta conversación.</div>}
        <div ref={fin} />
      </div>
      {resultado && !resultado.ok && <div className="toast toast-error" style={{ margin: '0 22px 10px' }}>{resultado.error}</div>}
      <form className="composer" onSubmit={(e) => { e.preventDefault(); enviar(); }}>
        <input className="composer-input" placeholder="Escribir un mensaje…" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Mensaje" />
        <button className="send-btn" disabled={pendiente || !texto.trim()}>{pendiente ? 'Enviando…' : 'Enviar'}</button>
      </form>
    </div>
  );
}
