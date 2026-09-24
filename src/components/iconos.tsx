// Íconos del riel (mismos trazos SVG que el mockup).
const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 } as const;

export const Iconos = {
  inicio: (
    <svg {...base}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></svg>
  ),
  mensajes: (
    <svg {...base}><path d="M4 4h16v12H7l-3 3V4Z" /></svg>
  ),
  calendario: (
    <svg {...base}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
  ),
  reloj: (
    <svg {...base}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>
  ),
  trofeo: (
    <svg {...base}><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z" /><path d="M7 6H4a3 3 0 0 0 3 5M17 6h3a3 3 0 0 1-3 5" /></svg>
  ),
  embudo: (
    <svg {...base}><path d="M3 5h18l-7 9v6l-4 2v-8L3 5Z" /></svg>
  ),
  personas: (
    <svg {...base}><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17.5" cy="9" r="2.4" /><path d="M15.3 14.2c2.6.3 4.7 2.5 4.7 5.8" /></svg>
  ),
  ubicacion: (
    <svg {...base}><path d="M12 21s7-6.3 7-11.5A7 7 0 0 0 5 9.5C5 14.7 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.4" /></svg>
  ),
  documento: (
    <svg {...base}><path d="M4 4h11l5 5v11H4Z" /><path d="M9 12h6M9 16h6M9 8h3" /></svg>
  ),
  megafono: (
    <svg {...base}><path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Z" /><path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12" /></svg>
  ),
  salir: (
    <svg {...base} width="16" height="16"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>
  ),
  campana: (
    <svg {...base}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
  ),
  buscar: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
  ),
};
