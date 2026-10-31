// Avisos que se muestran arriba en «Hoy». Cada tipo se puede apagar en Más (ajustes.avisos). Solo se ven con la app abierta;
// los avisos con la app cerrada los hace el calendario del móvil (archivos .ics).
import * as S from './store.js';
import { esc, diasHasta } from './util.js';
import { quedan, diasQueQuedan, avisoStock, ahoraHM } from './medicinas.js';
import { hoy } from './util.js';

export const TIPOS = [['stock', 'Pastillas que se acaban'], ['citas', 'Citas con médico o enfermero'], ['agua', 'Agua'], ['comidas', 'Desayuno, comida y cena sin apuntar'], ['ejercicio', 'Ejercicio']];
export const estaActivo = (aj, k) => activo(aj, k);
const activo = (aj, k) => (aj.avisos && aj.avisos[k] !== undefined) ? aj.avisos[k] : (k === 'stock' || k === 'citas');

export function calcular() {
  const d = S.datos(), aj = d.ajustes, out = [];
  if (activo(aj, 'stock')) for (const m of aj.medicinas || []) {
    if (m.activa === false) continue;
    const q = quedan(m, d.registro); if (q === null || q > avisoStock(m)) continue;
    const dias = diasQueQuedan(m, q);
    out.push({ nivel: q <= 0 ? 'bad' : 'warn', texto: `${q <= 0 ? 'Sin pastillas de' : 'Quedan ' + String(q).replace('.', ',') + ' de'} ${m.nombre}${m.dosis ? ' ' + m.dosis : ''}${dias !== null && q > 0 ? ' (≈ ' + dias + ' d)' : ''}. Recógelas o cómpralas en la farmacia.` });
  }
  if (activo(aj, 'citas')) for (const c of d.citas || []) {
    const n = diasHasta(c.fecha); if (n === null || n < 0 || n > 2) continue;
    out.push({ nivel: n === 0 ? 'bad' : 'warn', texto: `${n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : 'En 2 días'}${c.hora ? ' a las ' + c.hora : ''}: ${c.con || 'cita'}${c.lugar ? ' (' + c.lugar + ')' : ''}` });
  }
  const ahora = ahoraHM(), h = parseInt(ahora.slice(0, 2), 10) + parseInt(ahora.slice(3), 10) / 60, reg = d.registro?.[hoy()] || {}, com = d.comidas?.[hoy()] || {};
  const mas = (hm, min) => { const [x, y] = String(hm || '00:00').split(':').map(Number); return x * 60 + y + min; };
  const mins = parseInt(ahora.slice(0, 2), 10) * 60 + parseInt(ahora.slice(3), 10);
  if (activo(aj, 'comidas')) for (const [k, t, hk] of [['desayuno', 'el desayuno', 'hora_desayuno'], ['media', 'la media mañana', 'hora_media'], ['comida', 'la comida', 'hora_comida'], ['cena', 'la cena', 'hora_cena']])
    if (!(com[k] && com[k].estado) && mins >= mas(aj[hk], 60)) out.push({ nivel: 'warn', texto: `Aún no has apuntado ${t} de hoy.` });
  if (activo(aj, 'agua') && h >= 11 && h <= 22) {
    const esperado = Math.floor((aj.objetivo_vasos || 8) * Math.min(1, Math.max(0, (h - 9) / 12))), llevo = reg.agua || 0;
    if (llevo < esperado - 1) out.push({ nivel: 'warn', texto: `Agua: llevas ${llevo} vaso(s); a esta hora deberías ir por ${esperado}.` });
  }
  if (activo(aj, 'ejercicio') && mins >= mas(aj.hora_ejercicio, 0) && !(reg.ejercicio && reg.ejercicio.length)) out.push({ nivel: 'warn', texto: 'Hoy todavía no has hecho ejercicio (pedaleadora o un paseo).' });
  return out;
}
export function render() {
  const l = calcular(); if (!l.length) return '';
  return `<div style="margin-bottom:6px">${l.map(a => `<div class="item ${a.nivel === 'bad' ? 'caducado' : 'alerta'}"><div class="grow nom">${esc(a.texto)}</div></div>`).join('')}</div>`;
}

// Si a una medicina le quedan pocas pastillas, pone «Reponer …» en la sección Farmacia de la lista de la compra (y la quita si ya hay de sobra).
// Devuelve true si cambió algo (y ya ha guardado).
export function sincronizar() {
  const d = S.datos(), aj = d.ajustes; if (!d.compra) return false; let cambio = false;
  for (const m of aj.medicinas || []) {
    const it = d.compra.find(x => x.med_id === m.id && x.auto);
    const q = m.activa === false ? null : quedan(m, d.registro), bajo = q !== null && q <= avisoStock(m) && activo(aj, 'stock');
    if (bajo && !it) { d.compra.push({ id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36), nombre: `Reponer ${m.nombre}${m.dosis ? ' ' + m.dosis : ''}`, cantidad: null, unidad: '', seccion: 'farmacia', med_id: m.id, auto: true, nota: `Quedan ${String(q).replace('.', ',')}: recogerlas o comprarlas en la farmacia`, hecho: false }); cambio = true; }
    else if (!bajo && it && !it.hecho) { d.compra = d.compra.filter(x => x !== it); cambio = true; }
  }
  if (cambio) S.guardar(); return cambio;
}
