import type { LeadBandeja } from '@/lib/tipos';

/** Pestañas de la lista de conversaciones. El vendedor ve No leídos / Leídos; gestión, No leídos / Mías / Sin asignar / Todas. */
export type FiltroBandeja = 'no' | 'si' | 'mias' | 'sin' | 'todas';

export const filtroDesdeUrl = (modo: 'vendedor' | 'gestion', f?: string): FiltroBandeja => {
  if (modo === 'vendedor') return f === 'si' ? 'si' : 'no';
  return f === 'mias' || f === 'sin' || f === 'todas' ? f : 'no';
};

/** Sin asignar: ya no la atiende el bot y todavía no tiene vendedor (en espera o para asignar a mano). */
export const esSinAsignar = (l: LeadBandeja) => !l.vendedor_id && l.modo !== 'bot';

export const pasaFiltro = (l: LeadBandeja, filtro: FiltroBandeja, yoId: number) => {
  switch (filtro) {
    case 'no': return !l.leido;
    case 'si': return l.leido;
    case 'mias': return l.vendedor_id === yoId;
    case 'sin': return esSinAsignar(l);
    case 'todas': return true;
  }
};
