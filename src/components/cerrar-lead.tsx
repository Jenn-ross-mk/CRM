'use client';

import { useState } from 'react';
import { cerrarLead } from '@/app/acciones/leads';
import { MOTIVOS_CIERRE } from '@/lib/constantes';
import type { Resultado } from '@/lib/tipos';
import { Toast, useAccion } from './ui';

/** Motivos que puede elegir cada rol: "Otros" solo aparece para el administrador. */
export const motivosPara = (esAdmin: boolean) => MOTIVOS_CIERRE.filter((m) => esAdmin || !m.soloAdmin);

/** Formulario para cerrar un chat: el motivo es obligatorio; "Otros" (solo admin) pide un texto. */
export function FormCerrarLead({ leadId, esAdmin, onCerrado, onCancelar }: {
  leadId: number;
  esAdmin: boolean;
  onCerrado?: (r: Resultado) => void;
  onCancelar?: () => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [detalle, setDetalle] = useState('');
  const { pendiente, resultado, ejecutar } = useAccion();

  return (
    <form className="cerrar-lead" onSubmit={(e) => {
      e.preventDefault();
      ejecutar(() => cerrarLead(leadId, motivo, detalle), (r) => r.ok && onCerrado?.(r));
    }}>
      <div className="fld">
        <label>Motivo de cierre</label>
        <select value={motivo} onChange={(e) => setMotivo(e.target.value)} required>
          <option value="" disabled>Elegí un motivo</option>
          {motivosPara(esAdmin).map((m, i) => <option key={m.valor} value={m.valor}>{m.soloAdmin ? m.etiqueta : `${i + 1}. ${m.etiqueta}`}</option>)}
        </select>
      </div>
      {motivo === 'otros' && (
        <div className="fld" style={{ marginTop: 8 }}>
          <label>Detalle del motivo</label>
          <textarea value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="Escribí por qué se cierra" required />
        </div>
      )}
      <div className="cerrar-lead-acciones">
        {onCancelar && <button type="button" className="btn-link" onClick={onCancelar}>Cancelar</button>}
        <button className="alert-btn btn-cerrar" disabled={pendiente || !motivo || (motivo === 'otros' && !detalle.trim())}>
          {pendiente ? 'Cerrando…' : 'Cerrar chat'}
        </button>
      </div>
      <Toast resultado={resultado?.ok ? null : resultado} />
    </form>
  );
}
