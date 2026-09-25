'use client';

import Link from 'next/link';
import { useState } from 'react';
import { etiquetaSector } from '@/lib/constantes';
import { fechaLarga } from '@/lib/fechas';
import type { Venta } from '@/lib/tipos';
import { plural } from '@/lib/util';
import { Confeti, ListaRanking, Podio, type FilaRanking } from './ranking';
import { SlideOver, Vacio } from './ui';

/** Podio + lista completa. En gestión, clic en un vendedor abre el detalle de sus ventas del período. */
export function RankingVista({ filas, etiqueta, ventas, rutaVentas }: {
  filas: FilaRanking[];
  etiqueta: string;
  ventas?: Venta[];
  rutaVentas?: string;
}) {
  const [elegido, setElegido] = useState<FilaRanking | null>(null);
  const onClick = ventas ? setElegido : undefined;
  const susVentas = elegido && ventas ? ventas.filter((v) => v.vendedor_id === elegido.id) : [];

  return (
    <>
      <Confeti />
      <div className="dcard" style={{ marginBottom: 18 }}><Podio filas={filas} onClick={onClick} /></div>
      <div className="dcard">
        <h3>Todo el equipo</h3>
        <p className="dcard-sub">{etiqueta}</p>
        <ListaRanking filas={filas} onClick={onClick} />
      </div>
      {rutaVentas && (
        <div className="dcard" style={{ marginTop: 18, textAlign: 'center', padding: '26px 20px' }}>
          <h3 style={{ marginBottom: 6 }}>¿Necesitás más detalle?</h3>
          <p className="dcard-sub" style={{ marginBottom: 14 }}>Entrá al listado completo de ventas, filtrable por fecha, vendedor y sucursal</p>
          <Link href={rutaVentas} className="alert-btn" style={{ padding: '11px 22px', display: 'inline-block' }}>Ver todas las ventas</Link>
        </div>
      )}
      <SlideOver abierto={!!elegido} titulo={elegido ? `Ventas de ${elegido.nombre}` : ''} onCerrar={() => setElegido(null)}>
        {elegido && (
          <>
            <div className="venta-hero">
              <div className="vh-model">{elegido.nombre}</div>
              <div className="vh-sub">{susVentas.length} {plural(susVentas.length, 'venta')} en el período seleccionado</div>
            </div>
            <div className="detail-block" style={{ padding: 0 }}>
              {susVentas.length ? susVentas.map((v) => (
                <div key={v.id} className="manage-row">
                  <div><div className="mr-text">{v.cliente_nombre}</div><div className="mr-sub">{v.vehiculo} · {fechaLarga(v.fecha)} · {etiquetaSector(v.sector)}</div></div>
                </div>
              )) : <Vacio style={{ padding: '12px 0' }}>Sin ventas en el período seleccionado.</Vacio>}
            </div>
          </>
        )}
      </SlideOver>
    </>
  );
}
