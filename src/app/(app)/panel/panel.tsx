'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { cerrarLead, reabrirLead } from '@/app/acciones/leads';
import { FormCerrarLead, motivosPara } from '@/components/cerrar-lead';
import { FiltroSelect } from '@/components/filtros';
import { SlideOver, Toast, useAccion, Vacio } from '@/components/ui';
import { ETIQUETA_CANAL, ETIQUETA_TIPO_TURNO, MOTIVOS_CIERRE, etiquetaFormaPago, etiquetaMotivoCierre, etiquetaSector } from '@/lib/constantes';
import { fechaCorta, fechaLarga, fechaLocal, fechaTurno, horaBandeja, horaLocal } from '@/lib/fechas';
import { PERIODOS, type Agenda, type Clasificacion, type LeadPanel, type Periodo, moverPeriodo, rangoPeriodo, tituloPeriodo } from '@/lib/panel';
import type { EtapaPipeline, Rol, Venta } from '@/lib/tipos';
import { plural } from '@/lib/util';

export interface ItemPanel {
  lead: LeadPanel;
  agendas: Agenda[];
  clasificacion: Clasificacion;
}

type Props = {
  items: ItemPanel[];
  ventas: Venta[];
  etapas: EtapaPipeline[];
  periodo: Periodo;
  fecha: string;
  hoy: string;
  vendedorId: number | null;
  vendedores: { id: number; nombre: string }[];
  nombres: Record<number, string>;
  sucursales: Record<number, string>;
  yo: { id: number; rol: Rol; nombre: string };
};

type Seleccion = { tipo: 'lead'; item: ItemPanel; cerrar?: boolean } | { tipo: 'venta'; venta: Venta } | null;

const agendaTexto = (a: Agenda) => `${ETIQUETA_TIPO_TURNO[a.tipo] ?? a.tipo} · ${fechaTurno(fechaLocal(a.fecha_hora))} ${horaLocal(a.fecha_hora)}`;

/** Etiqueta (texto + clase de color) y línea de detalle de cada tarjeta según su bloque. */
function describir({ lead, clasificacion: c }: ItemPanel): { tag: string; clase: string; sub: string } {
  switch (c.bloque) {
    case 'seguimiento':
      return c.etiqueta === 'agendado'
        ? { tag: 'Agendado', clase: 'ptag-agendado', sub: agendaTexto(c.agenda) }
        : { tag: 'Activo', clase: 'ptag-activo', sub: `Último mensaje ${horaBandeja(lead.ultimo_mensaje_en)}` };
    case 'pendiente':
      if (c.motivo === 'agenda_vencida') return { tag: 'Agenda vencida', clase: 'ptag-pendiente', sub: `${agendaTexto(c.agenda)} · sin mensaje enviado` };
      return c.motivo === 'sin_respuesta'
        ? { tag: 'Sin respuesta', clase: 'ptag-pendiente', sub: `Se le escribió y no responde hace ${c.dias} ${plural(c.dias, 'día')}` }
        : { tag: 'Sin contacto', clase: 'ptag-pendiente', sub: `Sin mensajes del cliente hace ${c.dias} ${plural(c.dias, 'día')}` };
    case 'cerrado':
      return { tag: etiquetaMotivoCierre(lead.motivo_cierre), clase: `ptag-cierre ptag-${lead.motivo_cierre ?? 'sin'}`, sub: lead.cerrado_en ? `Cerrado el ${fechaLarga(fechaLocal(lead.cerrado_en))}` : 'Cerrado' };
    default:
      return { tag: 'Vendido', clase: 'ptag-vendido', sub: '' };
  }
}

export function PanelLeads(props: Props) {
  const { items, ventas, periodo, fecha, hoy, vendedorId, vendedores, nombres, yo } = props;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [cargando, iniciar] = useTransition();
  const [filtroSeg, setFiltroSeg] = useState<'todos' | 'activo' | 'agendado'>('todos');
  const [filtroCierre, setFiltroCierre] = useState('todos');
  const [sel, setSel] = useState<Seleccion>(null);
  const cierre = useAccion();
  const esGestion = yo.rol !== 'vendedor';
  const esAdmin = yo.rol === 'admin';

  const navegar = (cambios: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    Object.entries(cambios).forEach(([k, v]) => (v === null ? p.delete(k) : p.set(k, v)));
    iniciar(() => router.push(`${pathname}?${p.toString()}`, { scroll: false }));
  };

  const seguimiento = items.filter((i) => i.clasificacion.bloque === 'seguimiento');
  const activos = seguimiento.filter((i) => i.clasificacion.bloque === 'seguimiento' && i.clasificacion.etiqueta === 'activo');
  const agendados = seguimiento.filter((i) => i.clasificacion.bloque === 'seguimiento' && i.clasificacion.etiqueta === 'agendado');
  const pendientes = items.filter((i) => i.clasificacion.bloque === 'pendiente').sort((a, b) => urgencia(b) - urgencia(a));
  const cerrados = items.filter((i) => i.clasificacion.bloque === 'cerrado');
  const listaSeg = filtroSeg === 'activo' ? activos : filtroSeg === 'agendado' ? agendados : seguimiento;
  const listaCerrados = filtroCierre === 'todos' ? cerrados : cerrados.filter((i) => (i.lead.motivo_cierre ?? 'sin') === filtroCierre);
  const motivosUsados = [...MOTIVOS_CIERRE.map((m) => m.valor as string), 'sin'].filter((m) => cerrados.some((i) => (i.lead.motivo_cierre ?? 'sin') === m));

  const rango = rangoPeriodo(periodo, fecha);
  const incluyeHoy = !rango || (hoy >= rango.desde && hoy < rango.hasta);

  const cerrarDesdeTarjeta = (item: ItemPanel, motivo: string) => {
    if (motivo === 'otros') return setSel({ tipo: 'lead', item, cerrar: true });
    const etiqueta = etiquetaMotivoCierre(motivo as LeadPanel['motivo_cierre']);
    if (!confirm(`¿Cerrar el chat de ${item.lead.nombre} por "${etiqueta}"? Deja de verse en la bandeja.`)) return;
    cierre.ejecutar(() => cerrarLead(item.lead.id, motivo, ''));
  };

  const tarjeta = (item: ItemPanel, conCierre: boolean) => (
    <Tarjeta key={item.lead.id} item={item} vendedor={esGestion ? nombreVendedor(item.lead.vendedor_id, nombres) : null}
      onAbrir={() => setSel({ tipo: 'lead', item })}
      cierre={conCierre ? (
        <select className="panel-cerrar" value="" aria-label={`Cerrar el chat de ${item.lead.nombre}`} disabled={cierre.pendiente}
          onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} onChange={(e) => cerrarDesdeTarjeta(item, e.target.value)}>
          <option value="">Cerrar…</option>
          {motivosPara(esAdmin).map((m) => <option key={m.valor} value={m.valor}>{m.etiqueta}</option>)}
        </select>
      ) : null} />
  );

  return (
    <div className="dash">
      {cargando && <div className="loading-bar" />}
      <div className="pipe-filters">
        <div className="rank-toggle" style={{ marginBottom: 0 }}>
          {PERIODOS.map((p) => (
            <div key={p.valor} className={`rtog${periodo === p.valor ? ' active' : ''}`} onClick={() => navegar({ p: p.valor === 'mes' ? null : p.valor })}>{p.etiqueta}</div>
          ))}
        </div>
        {periodo !== 'todo' && (
          <div className="panel-nav">
            <button className="cal-nav-btn" aria-label="Período anterior" onClick={() => navegar({ d: moverPeriodo(periodo, fecha, -1) })}>‹</button>
            <span className="panel-periodo">{tituloPeriodo(periodo, fecha)}</span>
            <button className="cal-nav-btn" aria-label="Período siguiente" onClick={() => navegar({ d: moverPeriodo(periodo, fecha, 1) })}>›</button>
            {!incluyeHoy && <button className="btn-link" onClick={() => navegar({ d: null })}>Hoy</button>}
          </div>
        )}
        {esGestion && (
          <FiltroSelect param="v" valor={vendedorId ? String(vendedorId) : ''} opciones={[
            { valor: '', etiqueta: yo.rol === 'admin' ? 'Todos los vendedores' : 'Todos los vendedores de mis sucursales' },
            ...vendedores.map((v) => ({ valor: String(v.id), etiqueta: v.nombre })),
          ]} />
        )}
      </div>
      <p className="pipe-filters-note" style={{ margin: '-6px 0 14px' }}>
        {periodo === 'todo' ? 'Todos los leads' : 'Leads abiertos según su fecha de ingreso, cerrados según la fecha de cierre y vendidos según la fecha de venta'}
        {esGestion ? (yo.rol === 'admin' ? ' · todas las sucursales.' : ' · tus sucursales.') : ' · tus leads.'}
      </p>
      <Toast resultado={cierre.resultado} />

      <div className="panel-grid" style={{ marginTop: cierre.resultado ? 12 : 0 }}>
        <Bloque clase="seguimiento" titulo="En seguimiento" total={seguimiento.length}
          ayuda="Leads nuevos, en conversación y agendados"
          chips={<>
            <Chip activo={filtroSeg === 'todos'} onClick={() => setFiltroSeg('todos')}>Todos · {seguimiento.length}</Chip>
            <Chip activo={filtroSeg === 'activo'} onClick={() => setFiltroSeg('activo')}>Activos · {activos.length}</Chip>
            <Chip activo={filtroSeg === 'agendado'} onClick={() => setFiltroSeg('agendado')}>Agendados · {agendados.length}</Chip>
          </>}>
          {listaSeg.length ? listaSeg.map((i) => tarjeta(i, true)) : <Vacio>No hay leads en seguimiento.</Vacio>}
        </Bloque>

        <Bloque clase="pendiente" titulo="Pendientes" total={pendientes.length}
          ayuda="Agenda de hoy o vencida sin mensaje, o 7 días sin respuesta del cliente">
          {pendientes.length ? pendientes.map((i) => tarjeta(i, true)) : <Vacio>No hay leads pendientes.</Vacio>}
        </Bloque>

        <Bloque clase="cerrado" titulo="Cerrados" total={cerrados.length}
          ayuda="Chats cerrados con su motivo"
          chips={cerrados.length ? <>
            <Chip activo={filtroCierre === 'todos'} onClick={() => setFiltroCierre('todos')}>Todos · {cerrados.length}</Chip>
            {motivosUsados.map((m) => (
              <Chip key={m} activo={filtroCierre === m} onClick={() => setFiltroCierre(m)}>
                {m === 'sin' ? 'Sin motivo' : etiquetaMotivoCierre(m as LeadPanel['motivo_cierre'])} · {cerrados.filter((i) => (i.lead.motivo_cierre ?? 'sin') === m).length}
              </Chip>
            ))}
          </> : null}>
          {listaCerrados.length ? listaCerrados.map((i) => tarjeta(i, false)) : <Vacio>No hay chats cerrados.</Vacio>}
        </Bloque>

        <Bloque clase="vendido" titulo="Vendidos" total={ventas.length} ayuda="Ventas registradas">
          {ventas.length ? ventas.map((v) => (
            <div key={v.id} className="panel-item" role="button" tabIndex={0} onClick={() => setSel({ tipo: 'venta', venta: v })}
              onKeyDown={(e) => e.key === 'Enter' && setSel({ tipo: 'venta', venta: v })}>
              <div className="panel-item-top">
                <span className="panel-item-nombre">{v.cliente_nombre}</span>
                <span className="ptag ptag-vendido">Vendido</span>
              </div>
              <div className="panel-item-sub">{v.vehiculo} · {fechaLarga(v.fecha)}</div>
              {esGestion && <div className="panel-item-vend">{nombres[v.vendedor_id] ?? '—'}</div>}
            </div>
          )) : <Vacio>No hay ventas en este período.</Vacio>}
        </Bloque>
      </div>

      <SlideOver abierto={!!sel} titulo={sel?.tipo === 'venta' ? sel.venta.cliente_nombre : sel?.item.lead.nombre ?? ''} onCerrar={() => setSel(null)}>
        {sel?.tipo === 'lead' && <DetalleLead key={sel.item.lead.id} {...props} item={sel.item} abrirCierre={!!sel.cerrar} onListo={() => setSel(null)} />}
        {sel?.tipo === 'venta' && <DetalleVenta {...props} venta={sel.venta} />}
      </SlideOver>
    </div>
  );
}

/** Orden de los pendientes: primero las agendas vencidas, después los que llevan más días sin respuesta. */
const urgencia = ({ clasificacion: c }: ItemPanel) => (c.bloque !== 'pendiente' ? 0 : c.motivo === 'agenda_vencida' ? 100000 : c.dias);

const nombreVendedor = (id: number | null, nombres: Record<number, string>) => (id ? nombres[id] ?? '—' : 'Sin asignar');

function Bloque({ clase, titulo, ayuda, total, chips, children }: {
  clase: string; titulo: string; ayuda: string; total: number; chips?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className={`panel-bloque panel-${clase}`}>
      <header className="panel-bloque-head">
        <h3>{titulo}</h3>
        <span className="panel-count">{total}</span>
      </header>
      <p className="panel-ayuda">{ayuda}</p>
      {chips && <div className="panel-chips">{chips}</div>}
      <div className="panel-lista">{children}</div>
    </section>
  );
}

const Chip = ({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button type="button" className={`panel-chip${activo ? ' active' : ''}`} onClick={onClick}>{children}</button>
);

function Tarjeta({ item, vendedor, onAbrir, cierre }: { item: ItemPanel; vendedor: string | null; onAbrir: () => void; cierre: React.ReactNode }) {
  const { tag, clase, sub } = describir(item);
  return (
    <div className="panel-item" role="button" tabIndex={0} onClick={onAbrir} onKeyDown={(e) => e.key === 'Enter' && onAbrir()}>
      <div className="panel-item-top">
        <span className="panel-item-nombre">{item.lead.nombre}</span>
        <span className={`ptag ${clase}`}>{tag}</span>
      </div>
      <div className="panel-item-sub">{sub}</div>
      {(vendedor || cierre) && (
        <div className="panel-item-pie">
          <span className="panel-item-vend">{vendedor}</span>
          {cierre}
        </div>
      )}
    </div>
  );
}

const Campo = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="field-row"><span className="field-key">{k}</span><span className="field-val">{v}</span></div>
);
const cuando = (d: string | null) => (d ? `${fechaCorta(d)} ${horaLocal(d)}` : '—');

function DetalleLead({ item, etapas, nombres, sucursales, yo, abrirCierre, onListo }: Props & { item: ItemPanel; abrirCierre: boolean; onListo: () => void }) {
  const { lead, agendas } = item;
  const { tag, clase, sub } = describir(item);
  const [cerrando, setCerrando] = useState(abrirCierre);
  const reabrir = useAccion();
  const esGestion = yo.rol !== 'vendedor';
  const cerrado = item.clasificacion.bloque === 'cerrado';
  const bloque = { seguimiento: 'En seguimiento', pendiente: 'Pendiente', cerrado: 'Cerrado', vendido: 'Vendido' }[item.clasificacion.bloque];

  return (
    <div className="panel-detalle">
      <div className="tag-row" style={{ marginBottom: 6 }}>
        <span className={`ptag ptag-bloque-${item.clasificacion.bloque}`}>{bloque}</span>
        <span className={`ptag ${clase}`}>{tag}</span>
      </div>
      {sub && <p className="dcard-sub">{sub}</p>}

      <div className="detail-block" style={{ padding: 0 }}>
        <Campo k="Teléfono" v={lead.telefono ?? '—'} />
        <Campo k="Canal" v={ETIQUETA_CANAL[lead.canal] ?? lead.canal} />
        <Campo k="Sector" v={etiquetaSector(lead.sector)} />
        <Campo k="Sucursal" v={lead.sucursal_id ? sucursales[lead.sucursal_id] ?? '—' : '—'} />
        <Campo k="Vendedor" v={nombreVendedor(lead.vendedor_id, nombres)} />
        <Campo k="Vehículo de interés" v={lead.vehiculo_interes ?? '—'} />
        <Campo k="Forma de pago" v={etiquetaFormaPago(lead.forma_pago)} />
        <Campo k="Prioridad" v={lead.prioridad[0].toUpperCase() + lead.prioridad.slice(1)} />
        <Campo k="Etapa" v={etapas.find((e) => e.id === lead.etapa_id)?.nombre ?? 'Nuevo'} />
        <Campo k="Ingresó" v={cuando(lead.creado_en)} />
        <Campo k="Último mensaje del cliente" v={cuando(lead.ultima_interaccion)} />
        <Campo k="Último mensaje enviado" v={cuando(lead.ultimo_saliente_en)} />
      </div>
      {lead.ultimo_texto && <div className="note-item" style={{ marginTop: 10 }}>{lead.ultimo_texto}<div className="note-meta">Último mensaje · {cuando(lead.ultimo_mensaje_en)}</div></div>}

      <p className="detail-label" style={{ marginTop: 16 }}>Agenda</p>
      {agendas.length ? agendas.map((a) => (
        <div key={a.id} className="manage-row">
          <div style={{ flex: 1 }}>
            <div className="mr-text">{agendaTexto(a)}</div>
            <div className="mr-sub">{a.estado === 'aprobado' ? 'Aprobado' : a.tipo === 'test_drive' ? 'Pendiente de aprobación' : 'Pendiente'}{a.vehiculo ? ` · ${a.vehiculo}` : ''}</div>
          </div>
        </div>
      )) : <Vacio>Nada agendado.</Vacio>}

      {cerrado && (
        <>
          <p className="detail-label" style={{ marginTop: 16 }}>Cierre</p>
          <Campo k="Motivo" v={etiquetaMotivoCierre(lead.motivo_cierre)} />
          {lead.detalle_cierre && <Campo k="Detalle" v={lead.detalle_cierre} />}
          <Campo k="Fecha" v={cuando(lead.cerrado_en)} />
          <Campo k="Cerrado por" v={lead.cerrado_por ? nombres[lead.cerrado_por] ?? '—' : '—'} />
        </>
      )}

      <div className="panel-detalle-acciones">
        <Link className="alert-btn" href={`${esGestion ? '/gestion/mensajes' : '/bandeja'}?lead=${lead.id}`}>Abrir chat</Link>
        {cerrado && esGestion && (
          <button className="alert-btn btn-secundario" disabled={reabrir.pendiente} onClick={() => reabrir.ejecutar(() => reabrirLead(lead.id), (r) => r.ok && onListo())}>
            {reabrir.pendiente ? 'Reabriendo…' : 'Reabrir chat'}
          </button>
        )}
        {!cerrado && !cerrando && <button className="alert-btn btn-cerrar" onClick={() => setCerrando(true)}>Cerrar chat</button>}
      </div>
      <Toast resultado={reabrir.resultado?.ok ? null : reabrir.resultado} />
      {!cerrado && cerrando && (
        <div style={{ marginTop: 14 }}>
          <FormCerrarLead leadId={lead.id} esAdmin={yo.rol === 'admin'} onCerrado={onListo} onCancelar={() => setCerrando(false)} />
        </div>
      )}
    </div>
  );
}

function DetalleVenta({ venta, nombres, sucursales, yo }: Props & { venta: Venta }) {
  const esGestion = yo.rol !== 'vendedor';
  return (
    <div className="panel-detalle">
      <div className="tag-row" style={{ marginBottom: 12 }}><span className="ptag ptag-bloque-vendido">Vendido</span></div>
      <Campo k="Vehículo" v={venta.vehiculo} />
      <Campo k="Fecha de venta" v={fechaLarga(venta.fecha)} />
      <Campo k="Sector" v={etiquetaSector(venta.sector)} />
      <Campo k="Vendedor" v={nombres[venta.vendedor_id] ?? '—'} />
      <Campo k="Sucursal" v={venta.sucursal_id ? sucursales[venta.sucursal_id] ?? '—' : '—'} />
      <Campo k="Monto" v={venta.monto !== null ? `$ ${venta.monto.toLocaleString('es-AR')}` : '—'} />
      {(venta.datos_extra ?? []).map((c, i) => <Campo key={i} k={c.k} v={c.v} />)}
      <div className="panel-detalle-acciones">
        {venta.lead_id
          ? <Link className="alert-btn" href={`${esGestion ? '/gestion/mensajes' : '/bandeja'}?lead=${venta.lead_id}`}>Abrir chat</Link>
          : <span className="pipe-filters-note">Venta cargada a mano, sin chat asociado.</span>}
      </div>
    </div>
  );
}
