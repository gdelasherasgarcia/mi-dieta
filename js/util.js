// Utilidades pequeñas: fechas (siempre en hora local, formato AAAA-MM-DD) y escape de texto.
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const pad = n => String(n).padStart(2, '0');
export const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hoy = () => iso(new Date());

export function desdeIso(s) {            // 'AAAA-MM-DD' -> Date a las 12:00 locales (evita saltos por horario de verano)
  const [a, m, d] = s.split('-').map(Number);
  return new Date(a, m - 1, d, 12);
}
export function diasHasta(s) {           // días desde hoy hasta la fecha (negativo = ya pasó); null si no hay fecha
  if (!s) return null;
  return Math.round((desdeIso(s) - desdeIso(hoy())) / 86400000);
}
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const diaSemana = s => DIAS[desdeIso(s).getDay()];
export const fechaLarga = s => { const d = desdeIso(s); return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`; };
export const fechaCorta = s => { if (!s) return ''; const d = desdeIso(s); return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}`; };

export const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
