'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { enviarMensaje, marcarLeido } from '@/app/acciones/leads';
import { ETIQUETA_CANAL, ETIQUETA_ESTADO_LEAD, etiquetaSector } from '@/lib/constantes';
import type { DetalleLead } from '@/lib/datos';
import { horaBandeja, horaLocal } from '@/lib/fechas';
import type { EtapaPipeline, Etiqueta, LeadBandeja, Mensaje, Sucursal, Usuario } from '@/lib/tipos';
import { Iconos } from '../iconos';
import { Avatar, useAccion } from '../ui';
import { FormNuevoLead } from './form-nuevo-lead';
import { PanelDetalle } from './panel-detalle';

export interface PropsBandeja {
  modo: 'vendedor' | 'gestion';
  leads: LeadBandeja[];
  filtroLeido: 'no' | 'si';
  seleccionado: DetalleLead | null;
  usuarios: Usuario[];
  sucursales: Sucursal[];
  modelos: string[];
  etapas: EtapaPipeline[];
  etiquetas: Etiqueta[];
  yo: Usuario;
  misSucursales: number[];
}

const snippet = (l: LeadBandeja) => {
  const autor = l.ultimo_autor_tipo === 'vendedor' ? 'Vos: ' : l.ultimo_autor_tipo === 'bot' ? 'Bot: ' : '';
  const texto = l.ultimo_texto || (l.ultimo_tipo && l.ultimo_tipo !== 'texto' ? `[${l.ultimo_tipo}]` : null);
  return texto ? `${autor}${texto}` : 'Sin mensajes';
};

export function Bandeja(props: PropsBandeja) {
  const { modo, leads, filtroLeido, seleccionado, usuarios, sucursales } = props;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [nuevoAbierto, setNuevoAbierto] = useState(false);

  const porId = useMemo(() => new Map(usuarios.map((u) => [u.id, u])), [usuarios]);
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
              <Avatar nombre={l.nombre} />
              <div className="chat-meta">
                <div className="chat-top-row">
                  <span className="chat-name">{l.nombre}</span>
                  <span className="chat-time">{horaBandeja(l.ultimo_mensaje_en)}</span>
                </div>
                <div className="chat-snippet">{snippet(l)}</div>
                <div className="chat-badges">
                  <span className="chan-tag">{(ETIQUETA_CANAL[l.canal] ?? l.canal).toUpperCase()}</span>
                  <span className={`priority-dot p-${l.prioridad}`} title={`Prioridad ${l.prioridad}`} />
                  {modo === 'gestion' && (
                    <span className="msg-vendor-tag" style={l.vendedor_id ? undefined : { color: 'var(--slate)', fontWeight: 600 }}>
                      {l.vendedor_id ? porId.get(l.vendedor_id)?.nombre ?? '—' : l.modo === 'bot' ? 'Con el bot' : 'Sin asignar'}
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
          <Conversacion detalle={seleccionado} modo={modo} porId={porId} sucursal={lead.sucursal_id ? sucursalNombre.get(lead.sucursal_id) ?? '—' : '—'} />
          <PanelDetalle key={lead.id} {...props} detalle={seleccionado} porId={porId} sucursalNombre={sucursalNombre} />
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

function Conversacion({ detalle, modo, porId, sucursal }: { detalle: DetalleLead; modo: 'vendedor' | 'gestion'; porId: Map<number, Usuario>; sucursal: string }) {
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
  const atiende = lead.vendedor_id ? `Atiende ${porId.get(lead.vendedor_id)?.nombre ?? '—'}` : lead.modo === 'bot' ? 'Atiende el bot' : 'Sin asignar';

  return (
    <div className="conversation">
      <div className="conv-header">
        <div className="conv-header-top">
          <span className="conv-name">{lead.nombre}</span>
          <span className={`pill ${lead.prioridad === 'alta' ? 'pill-navy' : lead.prioridad === 'media' ? 'pill-charcoal' : 'pill-outline'}`}>{prioridad}</span>
          <span className="pill pill-outline">{etiquetaSector(lead.sector)}</span>
          {modo === 'gestion' && <span className="pill pill-outline">{ETIQUETA_ESTADO_LEAD[lead.estado] ?? lead.estado}</span>}
        </div>
        <div className="conv-sub">
          {lead.telefono || 'Sin teléfono'} · {ETIQUETA_CANAL[lead.canal] ?? lead.canal} · Sucursal {sucursal}{modo === 'gestion' ? ` · ${atiende}` : ''}
        </div>
      </div>
      <div className="messages">
        {mensajes.map((m) => <Burbuja key={m.id} m={m} autor={m.autor_usuario_id ? porId.get(m.autor_usuario_id) : undefined} />)}
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

/** Un mensaje, con el avatar de quien lo escribió: foto/iniciales del vendedor o el ícono del bot. */
function Burbuja({ m, autor }: { m: Mensaje; autor?: Usuario }) {
  const saliente = m.direccion === 'saliente';
  const hora = horaBandeja(m.creado_en) === horaLocal(m.creado_en) ? horaLocal(m.creado_en) : `${horaBandeja(m.creado_en)} · ${horaLocal(m.creado_en)}`;
  const estado = m.autor_tipo === 'vendedor' && m.estado_envio === 'pendiente' ? ' · pendiente de envío' : m.estado_envio === 'fallido' ? ' · no se pudo enviar' : '';
  return (
    <div className={`msg-row ${saliente ? 'msg-row-out' : 'msg-row-in'}`}>
      {m.autor_tipo === 'bot' && <div className="avatar avatar-mini avatar-bot" title="Bot">{Iconos.bot}</div>}
      {m.autor_tipo === 'vendedor' && <Avatar mini nombre={autor?.nombre ?? '?'} foto={autor?.foto_url} />}
      <div className={`msg ${saliente ? 'msg-out' : 'msg-in'}${m.autor_tipo === 'bot' ? ' msg-bot' : ''}`}>
        {m.autor_tipo === 'vendedor' && autor && <div className="msg-author">{autor.nombre}</div>}
        {m.tipo !== 'texto' && (
          <div className="msg-media">{m.media_url ? <a href={m.media_url} target="_blank" rel="noreferrer">[{m.tipo}]</a> : `[${m.tipo}]`}</div>
        )}
        {m.contenido}
        <div className="msg-time">{hora}{estado}</div>
      </div>
    </div>
  );
}
