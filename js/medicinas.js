// Qué medicinas tocan un día (cada una con su horario y sus días) y cómo se llaman los días.
import { desdeIso } from './util.js';

export const DIAS_CORTOS = [['1', 'L'], ['2', 'M'], ['3', 'X'], ['4', 'J'], ['5', 'V'], ['6', 'S'], ['0', 'D']];

export function medicinasDeHoy(lista, fecha) {
  const dow = desdeIso(fecha).getDay();
  return (lista || []).filter(m => m.activa !== false && (!m.dias || m.dias.length === 0 || m.dias.includes(dow)))
    .sort((a, b) => a.hora.localeCompare(b.hora) || a.nombre.localeCompare(b.nombre, 'es'));
}

const dos = n => String(n).padStart(2, '0');
export const ahoraHM = () => new Date().toTimeString().slice(0, 5);
// Suma horas a una hora «HH:MM»: devuelve la hora resultante y si ya cae en otro día (dia > 0 = mañana).
export function sumaHoras(hm, horas) {
  const [a, b] = hm.split(':').map(Number);
  const tot = a * 60 + b + Math.round(Number(horas) * 60);
  const m = ((tot % 1440) + 1440) % 1440;
  return { hm: `${dos(Math.floor(m / 60))}:${dos(m % 60)}`, dia: Math.floor(tot / 1440) };
}
export const esPeriodica = m => Number(m.cada_h) > 0;
export const tomasDe = (r, id) => (r.meds[id] || []).slice().sort((x, y) => (x.h || '').localeCompare(y.h || ''));

// ── Stock de pastillas ──
// stock_base = { n, fecha, hora }: las pastillas que había en ese momento. Lo que queda se CALCULA restando las tomas registradas después
// (así deshacer o editar una toma no desajusta nada).
export function quedan(m, registro) {
  const b = m.stock_base; if (!b || b.n === null || b.n === undefined) return null;
  const upt = Number(m.unidades) > 0 ? Number(m.unidades) : 1; let n = 0;
  for (const [f, r] of Object.entries(registro || {})) {
    if (f < b.fecha) continue;
    for (const t of ((r.meds || {})[m.id] || [])) { if (f > b.fecha || !t.h || t.h > (b.hora || '00:00')) n++; }
  }
  return Math.max(0, Math.round((Number(b.n) - n * upt) * 100) / 100);
}
export function diasQueQuedan(m, q) {
  const upt = Number(m.unidades) > 0 ? Number(m.unidades) : 1;
  const tomasDia = esPeriodica(m) ? (Number(m.max_dia) || Math.max(1, Math.floor(24 / Number(m.cada_h)))) : 1;
  const frecuencia = (m.dias && m.dias.length) ? m.dias.length / 7 : 1;
  const porDia = upt * tomasDia * frecuencia; return porDia > 0 ? Math.floor(q / porDia) : null;
}
export const avisoStock = m => (Number(m.aviso_stock) >= 0 && m.aviso_stock !== null && m.aviso_stock !== undefined && m.aviso_stock !== '') ? Number(m.aviso_stock) : 3;
