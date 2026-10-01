'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { enviarMensaje, marcarLeido, reabrirLead } from '@/app/acciones/leads';
import { ETIQUETA_CANAL, ETIQUETA_ESTADO_LEAD, etiquetaMotivoCierre, etiquetaSector } from '@/lib/constantes';
import type { DetalleLead } from '@/lib/datos';
import { fechaCorta, horaBandeja, horaLocal } from '@/lib/fechas';
import { crearClienteNavegador } from '@/lib/supabase/client';
import type { EtapaPipeline, Etiqueta, LeadBandeja, Mensaje, Sucursal, Usuario } from '@/lib/tipos';
import { Iconos } from '../iconos';
import { FormCerrarLead } from '../cerrar-lead';
import { Avatar, Toast, useAccion } from '../ui';
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
  // En pantallas chicas se ve una sola parte por vez: la lista, el chat o los datos del lead.
  const [vista, setVista] = useState<'lista' | 'chat' | 'info'>(params.get('lead') ? 'chat' : 'lista');
  const [cargando, iniciar] = useTransition();
  const [abriendo, setAbriendo] = useState<number | null>(null);

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
    iniciar(() => router.push(`${pathname}?${p.toString()}`, { scroll: false }));
  };
  const abrir = (id: number) => {
    setAbriendo(id);
    setVista('chat');
    navegar({ lead: String(id) });
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
  const marcado = cargando && abriendo ? abriendo : lead?.id;

  return (
    <div className="body-row" data-vista={vista} style={modo === 'gestion' ? { height: '100%' } : undefined}>
      {cargando && <div className="loading-bar" />}
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
            <div key={l.id} className={`chat-item${l.id === marcado ? ' selected' : ''}`} onClick={() => abrir(l.id)}>
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
          <Conversacion key={lead.id} detalle={seleccionado} modo={modo} yo={props.yo} porId={porId} sucursal={lead.sucursal_id ? sucursalNombre.get(lead.sucursal_id) ?? '—' : '—'}
            onVolver={() => setVista('lista')} onInfo={() => setVista('info')}
            onCerrado={() => { setVista('lista'); navegar({ lead: null }); }} />
          <PanelDetalle key={lead.id} {...props} detalle={seleccionado} porId={porId} sucursalNombre={sucursalNombre} onVolver={() => setVista('chat')} />
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
        onCreado={(id) => { setNuevoAbierto(false); setVista('chat'); navegar({ lead: id, f: 'si' }); }} />
    </div>
  );
}

function Conversacion({ detalle, modo, yo, porId, sucursal, onVolver, onInfo, onCerrado }: {
  detalle: DetalleLead; modo: 'vendedor' | 'gestion'; yo: Usuario; porId: Map<number, Usuario>; sucursal: string;
  onVolver: () => void; onInfo: () => void; onCerrado: () => void;
}) {
  const { lead, mensajes } = detalle;
  const [texto, setTexto] = useState('');
  const [cerrando, setCerrando] = useState(false);
  const { pendiente, resultado, ejecutar } = useAccion();
  const reabrir = useAccion();
  const cerrado = lead.estado === 'cerrado';
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
          <button className="movil-volver solo-movil" onClick={onVolver} aria-label="Volver a la lista">‹</button>
          <span className="conv-name">{lead.nombre}</span>
          <Link href={`/clientes/${lead.id}`} className="btn-link" style={{ fontSize: 11 }}>Ver perfil</Link>
          <button className="movil-info solo-tablet" onClick={onInfo}>Datos</button>
          <span className={`pill ${lead.prioridad === 'alta' ? 'pill-navy' : lead.prioridad === 'media' ? 'pill-charcoal' : 'pill-outline'}`}>{prioridad}</span>
          <span className="pill pill-outline">{etiquetaSector(lead.sector)}</span>
          {modo === 'gestion' && <span className="pill pill-outline">{ETIQUETA_ESTADO_LEAD[lead.estado] ?? lead.estado}</span>}
          {!cerrado && !cerrando && <button className="conv-cerrar" onClick={() => setCerrando(true)}>Cerrar chat</button>}
        </div>
        <div className="conv-sub">
          {lead.telefono || 'Sin teléfono'} · {ETIQUETA_CANAL[lead.canal] ?? lead.canal} · Sucursal {sucursal}{modo === 'gestion' ? ` · ${atiende}` : ''}
        </div>
      </div>
      {cerrando && !cerrado && (
        <div className="cerrar-chat-caja">
          <FormCerrarLead leadId={lead.id} esAdmin={yo.rol === 'admin'} onCancelar={() => setCerrando(false)} onCerrado={onCerrado} />
        </div>
      )}
      {cerrado && (
        <div className="conv-cerrado">
          <span>
            Chat cerrado · {etiquetaMotivoCierre(lead.motivo_cierre)}{lead.detalle_cierre ? ` (${lead.detalle_cierre})` : ''}
            {lead.cerrado_en ? ` · ${fechaCorta(lead.cerrado_en)}` : ''}. No aparece en la lista de mensajes.
          </span>
          {modo === 'gestion' && (
            <button className="btn-link" disabled={reabrir.pendiente} onClick={() => reabrir.ejecutar(() => reabrirLead(lead.id))}>
              {reabrir.pendiente ? 'Reabriendo…' : 'Reabrir chat'}
            </button>
          )}
          <Toast resultado={reabrir.resultado?.ok ? null : reabrir.resultado} />
        </div>
      )}
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

/**
 * Archivo de un mensaje. Los que sube el bot están en la carpeta privada "mensajes" de Supabase (media_url guarda la ruta):
 * se abren con un enlace temporal, y Supabase solo lo da si el usuario puede ver ese mensaje.
 */
function ArchivoMensaje({ m }: { m: Mensaje }) {
  const ruta = m.media_url;
  const enCarpeta = !!ruta && !/^https?:\/\//.test(ruta);
  const [enlace, setEnlace] = useState<string | null>(enCarpeta ? null : ruta);
  useEffect(() => {
    if (!enCarpeta || !ruta) return;
    let vigente = true;
    crearClienteNavegador()
      .storage.from('mensajes')
      .createSignedUrl(ruta, 3600)
      .then(({ data }) => {
        if (vigente) setEnlace(data?.signedUrl ?? null);
      });
    return () => {
      vigente = false;
    };
  }, [ruta, enCarpeta]);

  if (!enlace) return <div className="msg-media">[{m.tipo}]</div>;
  if (m.tipo === 'imagen') {
    return (
      <a href={enlace} target="_blank" rel="noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element -- enlace temporal de Supabase, no pasa por next/image */}
        <img src={enlace} alt="Imagen enviada por el cliente" className="msg-img" />
      </a>
    );
  }
  if (m.tipo === 'audio') return <audio controls src={enlace} className="msg-audio" />;
  return (
    <div className="msg-media">
      <a href={enlace} target="_blank" rel="noreferrer">[{m.tipo}]</a>
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
        {m.tipo !== 'texto' && <ArchivoMensaje m={m} />}
        {m.contenido}
        <div className="msg-time">{hora}{estado}</div>
      </div>
    </div>
  );
}
