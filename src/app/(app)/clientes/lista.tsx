'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Vacio } from '@/components/ui';
import { etiquetaFormaPago } from '@/lib/constantes';
import { horaBandeja } from '@/lib/fechas';
import { type LeadClasificado, ubicacion } from '@/lib/panel';

const BLOQUES = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'seguimiento', etiqueta: 'En seguimiento' },
  { valor: 'pendiente', etiqueta: 'Pendientes' },
  { valor: 'cerrado', etiqueta: 'Cerrados' },
  { valor: 'vendido', etiqueta: 'Vendidos' },
];

/** Quita tildes y pasa a minúscula para buscar "Pérez" escribiendo "perez". */
const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function ListaClientes({ items, etapas, nombres, esGestion }: {
  items: LeadClasificado[];
  etapas: Record<number, string>;
  nombres: Record<number, string>;
  esGestion: boolean;
}) {
  const [q, setQ] = useState('');
  const [bloque, setBloque] = useState('todos');
  const busqueda = normalizar(q.trim());
  const filtrados = items.filter((i) =>
    (bloque === 'todos' || i.clasificacion.bloque === bloque) &&
    (!busqueda || normalizar(`${i.lead.nombre} ${i.lead.telefono ?? ''} ${i.lead.vehiculo_interes ?? ''}`).includes(busqueda)));
  const cuenta = (b: string) => (b === 'todos' ? items.length : items.filter((i) => i.clasificacion.bloque === b).length);

  return (
    <div className="dash">
      <div className="pipe-filters">
        <label className="search-input clientes-buscar">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, teléfono o vehículo" aria-label="Buscar cliente" />
        </label>
        <div className="panel-chips" style={{ margin: 0 }}>
          {BLOQUES.map((b) => (
            <button key={b.valor} type="button" className={`panel-chip chip-${b.valor}${bloque === b.valor ? ' active' : ''}`} onClick={() => setBloque(b.valor)}>
              {b.etiqueta} · {cuenta(b.valor)}
            </button>
          ))}
        </div>
      </div>
      <div className="dcard" style={{ padding: 0, overflow: 'hidden' }}>
        {filtrados.length ? (
          <div className="clientes-lista">
            {filtrados.map(({ lead, clasificacion }) => {
              const u = ubicacion(clasificacion);
              const interes = [lead.vehiculo_interes, lead.forma_pago ? etiquetaFormaPago(lead.forma_pago) : null].filter(Boolean).join(' · ');
              return (
                <Link key={lead.id} href={`/clientes/${lead.id}`} className="cliente-fila">
                  <div className="cliente-principal">
                    <div className="cliente-nombre">{lead.nombre}</div>
                    <div className="cliente-sub">{lead.telefono ?? 'Sin teléfono'}{interes ? ` · ${interes}` : ''}</div>
                  </div>
                  <div className="cliente-donde">
                    <span className={`ptag ptag-bloque-${clasificacion.bloque}`}>{u.bloque}</span>
                    {u.etiqueta !== u.bloque && <span className="cliente-motivo">{u.etiqueta}</span>}
                    <div className="cliente-sub">Etapa: {lead.etapa_id ? etapas[lead.etapa_id] ?? '—' : 'Nuevo'}</div>
                  </div>
                  {esGestion && <div className="cliente-vend">{lead.vendedor_id ? nombres[lead.vendedor_id] ?? '—' : 'Sin asignar'}</div>}
                  <div className="cliente-cuando">{horaBandeja(lead.ultimo_mensaje_en)}</div>
                </Link>
              );
            })}
          </div>
        ) : <Vacio style={{ padding: 20 }}>{items.length ? 'Ningún cliente coincide con la búsqueda.' : 'Todavía no hay clientes.'}</Vacio>}
      </div>
    </div>
  );
}
