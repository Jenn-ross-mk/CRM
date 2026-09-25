'use client';

import { ETIQUETA_SECTOR, SECTORES_VENTA } from '@/lib/constantes';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/** Select que guarda su valor en la URL (?param=valor) para que el filtro sea compartible. */
export function FiltroSelect({ param, valor, opciones, limpiar = [] }: {
  param: string;
  valor: string;
  opciones: { valor: string; etiqueta: string }[];
  limpiar?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <select className="admin-filter" value={valor} onChange={(e) => {
      const p = new URLSearchParams(params);
      if (e.target.value) p.set(param, e.target.value); else p.delete(param);
      limpiar.forEach((k) => p.delete(k));
      router.push(`${pathname}?${p.toString()}`, { scroll: false });
    }}>
      {opciones.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
    </select>
  );
}

/** Toggle de sector (Convencional / Plan de ahorro / Usados) guardado en la URL. */
export function ToggleSector({ valor, param = 'sector' }: { valor: string; param?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <div className="rank-toggle">
      {SECTORES_VENTA.map((s) => (
        <div key={s} className={`rtog${valor === s ? ' active' : ''}`} onClick={() => {
          const p = new URLSearchParams(params);
          p.set(param, s);
          router.push(`${pathname}?${p.toString()}`, { scroll: false });
        }}>{ETIQUETA_SECTOR[s]}</div>
      ))}
    </div>
  );
}
