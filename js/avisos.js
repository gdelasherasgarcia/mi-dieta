// Avisos que se muestran arriba en «Hoy». Cada tipo se puede apagar en Más (ajustes.avisos). Solo se ven con la app abierta;
// los avisos con la app cerrada los hace el calendario del móvil (archivos .ics).
import * as S from './store.js';
import { esc, diasHasta, fechaCorta } from './util.js';
import { quedan, diasQueQuedan, avisoStock, ahoraHM, medicinasDeHoy, esPeriodica } from './medicinas.js';
import { hoy } from './util.js';

export const TIPOS = [['meds', 'Medicinas sin tomar'], ['propios', 'Mis avisos'], ['stock', 'Pastillas que se acaban'], ['citas', 'Citas con médico o enfermero'], ['agua', 'Agua'], ['comidas', 'Desayuno, comida y cena sin apuntar'], ['ejercicio', 'Ejercicio'], ['peso', 'Pesarte (una vez por semana)']];
export const estaActivo = (aj, k) => activo(aj, k);
const activo = (aj, k) => (aj.avisos && aj.avisos[k] !== undefined) ? aj.avisos[k] : (k === 'stock' || k === 'citas' || k === 'meds' || k === 'propios' || k === 'peso');

// ¿Toca hoy este aviso propio? (una fecha concreta, unos días de la semana o todos los días)
const toca = p => p.unico ? p.unico === hoy() : (!p.dias || !p.dias.length || p.dias.includes(new Date().getDay()));

export function calcular() {
  const d = S.datos(), aj = d.ajustes, out = [];
  if (activo(aj, 'stock')) for (const m of aj.medicinas || []) {
    if (m.activa === false) continue;
    const q = quedan(m, d.registro); if (q === null || q > avisoStock(m)) continue;
    const dias = diasQueQuedan(m, q);
    out.push({ tipo: 'stock', clave: 'stock:' + m.id, nivel: q <= 0 ? 'bad' : 'warn', texto: `${q <= 0 ? 'Sin pastillas de' : 'Quedan ' + String(q).replace('.', ',') + ' de'} ${m.nombre}${m.dosis ? ' ' + m.dosis : ''}${dias !== null && q > 0 ? ' (≈ ' + dias + ' d)' : ''}. Recógelas o cómpralas en la farmacia.` });
  }
  if (activo(aj, 'citas')) for (const c of d.citas || []) {
    const n = diasHasta(c.fecha); if (n === null || n < 0 || n > (Number(aj.aviso_citas_dias) || 2)) continue;
    out.push({ tipo: 'citas', clave: 'cita:' + (c.id || c.fecha), nivel: n === 0 ? 'bad' : 'warn', texto: `${n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : 'En ' + n + ' días'}${c.hora ? ' a las ' + c.hora : ''}: ${c.con || 'cita'}${c.lugar ? ' (' + c.lugar + ')' : ''}` });
  }
  const ahora = ahoraHM(), h = parseInt(ahora.slice(0, 2), 10) + parseInt(ahora.slice(3), 10) / 60, reg = d.registro?.[hoy()] || {}, com = d.comidas?.[hoy()] || {};
  const mas = (hm, min) => { const [x, y] = String(hm || '00:00').split(':').map(Number); return x * 60 + y + min; };
  const mins = parseInt(ahora.slice(0, 2), 10) * 60 + parseInt(ahora.slice(3), 10);
  if (activo(aj, 'meds')) for (const m of medicinasDeHoy(aj.medicinas, hoy())) {                  // medicinas de hora fija que tocaban y no se han dado por tomadas
    if (esPeriodica(m) || ((reg.meds || {})[m.id] || []).length) continue;
    const [x, y] = String(m.hora || '00:00').split(':').map(Number), tarde = mins - (x * 60 + y);
    if (tarde >= (Number(aj.aviso_meds_min) || 30)) out.push({ tipo: 'meds', clave: 'med:' + m.id, nivel: tarde >= (Number(aj.aviso_meds_rojo) || 120) ? 'bad' : 'warn', texto: `Sin tomar: ${m.nombre}${m.dosis ? ' ' + m.dosis : ''} (tocaba ${m.hora === '23:59' ? 'al acostarse' : 'a las ' + m.hora}).` });
  }
  if (activo(aj, 'propios')) for (const p of d.avisos_propios || []) {                           // avisos creados por el usuario: vencen a su hora y siguen hasta marcarlos como hechos
    if (p.activo === false || !toca(p)) continue;
    if (mins >= mas(p.hora, 0)) out.push({ tipo: 'propios', clave: 'propio:' + p.id, id: p.id, nivel: 'bad', texto: `${p.titulo} (${p.hora})${p.nota ? ' · ' + p.nota : ''}` });
  }
  if (activo(aj, 'peso') && new Date().getDay() === Number(aj.dia_peso ?? 2) && mins >= mas(aj.hora_peso || '08:00', 0) && !(d.salud?.peso || []).some(x => x.fecha === hoy()))      // día de pesarse (por defecto, martes) y aún no apuntado
    out.push({ tipo: 'peso', clave: 'peso', nivel: 'warn', texto: 'Hoy toca pesarte, en ayunas y a la vez que la tensión. Apúntalo en Salud.' });
  if (activo(aj, 'comidas')) for (const [k, t, hk] of [['desayuno', 'el desayuno', 'hora_desayuno'], ['media', 'la media mañana', 'hora_media'], ['comida', 'la comida', 'hora_comida'], ['cena', 'la cena', 'hora_cena']])
    if (!(com[k] && com[k].estado) && mins >= mas(aj[hk], 60)) out.push({ tipo: 'comidas', clave: 'comida:' + k, nivel: 'warn', texto: `Aún no has apuntado ${t} de hoy.` });
  if (activo(aj, 'agua') && h >= 11 && h <= 22) {
    const esperado = Math.floor((aj.objetivo_vasos || 8) * Math.min(1, Math.max(0, (h - 9) / 12))), llevo = reg.agua || 0;
    if (llevo < esperado - 1) out.push({ tipo: 'agua', clave: 'agua', nivel: 'warn', texto: `Agua: llevas ${llevo} vaso(s); a esta hora deberías ir por ${esperado}.` });
  }
  if (activo(aj, 'ejercicio') && mins >= mas(aj.hora_ejercicio, 0) && !(reg.ejercicio && reg.ejercicio.length)) out.push({ tipo: 'ejercicio', clave: 'ejercicio', nivel: 'warn', texto: 'Hoy todavía no has hecho ejercicio (pedaleadora o un paseo).' });
  return out;
}
// ── Estado de cada aviso: anulado por hoy o pospuesto hasta una hora (se guarda en los datos, así viaja en las copias) ──
const ahoraISO = () => hoy() + 'T' + ahoraHM();
const estados = () => (S.datos().avisos_estado ||= {});
export function clasificar() {
  const est = estados(), pend = [], posp = [], anul = [], ya = ahoraISO();
  for (const k of Object.keys(est)) { const e = est[k]; if ((e.a && e.a < hoy()) || (e.h && e.h < hoy()) || (e.p && e.p < hoy() + 'T00:00')) delete est[k]; }   // limpia lo viejo
  for (const a of calcular()) {
    const e = est[a.clave] || {};
    if (e.h === hoy()) continue;                                                                       // marcado como hecho hoy
    if (e.a === hoy()) anul.push(a); else if (e.p && e.p > ya) posp.push({ ...a, hasta: e.p }); else pend.push(a);
  }
  return { pend, posp, anul };
}
export function anular(clave) { estados()[clave] = { a: hoy() }; S.guardar(); }
export function posponer(clave, iso) { estados()[clave] = { p: iso }; S.guardar(); }
export function deshacer(clave) { delete estados()[clave]; S.guardar(); }
export function hecho(clave) { estados()[clave] = { h: hoy() }; S.guardar(); }
export const propios = () => (S.datos().avisos_propios ||= []);
export function guardarPropio(datos, id) { const l = propios(), x = id && l.find(y => y.id === id); if (x) Object.assign(x, datos); else l.push({ id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36), ...datos }); S.guardar(); }
export function borrarPropio(id) { S.datos().avisos_propios = propios().filter(x => x.id !== id); delete estados()['propio:' + id]; S.guardar(); }
export function apagarPropio(id) { const x = propios().find(y => y.id === id); if (x) { x.activo = false; S.guardar(); } }
export function apagarTipo(tipo) { (S.datos().ajustes.avisos ||= {})[tipo] = false; S.guardar(); }
export function activarTipo(tipo) { (S.datos().ajustes.avisos ||= {})[tipo] = true; S.guardar(); }

// El próximo aviso que va a saltar (o el aplazado que vuelve antes). Devuelve { texto, cuando: 'AAAA-MM-DDTHH:MM' } o null.
const hhmm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
function proximo(posp) {
  const d = S.datos(), aj = d.ajustes, ya = ahoraISO(), cand = [];
  const [hh, mm] = ahoraHM().split(':').map(Number), mins = hh * 60 + mm, reg = d.registro?.[hoy()] || {}, com = d.comidas?.[hoy()] || {};
  const parte = (hm, extra = 0) => { const [x, y] = String(hm || '00:00').split(':').map(Number); return x * 60 + y + extra; };
  for (const a of posp) cand.push({ texto: a.texto, cuando: a.hasta });                                   // aplazados: vuelven a su hora
  if (activo(aj, 'meds')) for (const m of medicinasDeHoy(aj.medicinas, hoy())) {
    if (esPeriodica(m) || ((reg.meds || {})[m.id] || []).length) continue;
    const t = parte(m.hora, Number(aj.aviso_meds_min) || 30); if (t > mins && t < 1440) cand.push({ texto: `${m.nombre}${m.dosis ? ' ' + m.dosis : ''}, si no la has tomado (toca a las ${m.hora})`, cuando: hoy() + 'T' + hhmm(t) });
  }
  if (activo(aj, 'comidas')) for (const [k, t, hk] of [['desayuno', 'el desayuno', 'hora_desayuno'], ['media', 'la media mañana', 'hora_media'], ['comida', 'la comida', 'hora_comida'], ['cena', 'la cena', 'hora_cena']]) {
    const x = parte(aj[hk], 60); if (!(com[k] && com[k].estado) && x > mins && x < 1440) cand.push({ texto: `apuntar ${t}`, cuando: hoy() + 'T' + hhmm(x) });
  }
  if (activo(aj, 'ejercicio') && !(reg.ejercicio && reg.ejercicio.length)) { const x = parte(aj.hora_ejercicio, 0); if (x > mins && x < 1440) cand.push({ texto: 'ejercicio de hoy', cuando: hoy() + 'T' + hhmm(x) }); }
  if (activo(aj, 'peso') && new Date().getDay() === Number(aj.dia_peso ?? 2) && !(d.salud?.peso || []).some(x => x.fecha === hoy())) { const x = parte(aj.hora_peso || '08:00', 0); if (x > mins && x < 1440) cand.push({ texto: 'pesarte en ayunas', cuando: hoy() + 'T' + hhmm(x) }); }
  if (activo(aj, 'propios')) for (const p of d.avisos_propios || []) {                                  // avisos propios que aún no han llegado a su hora
    if (p.activo === false || !toca(p) || (estados()['propio:' + p.id] || {}).h === hoy()) continue;
    const x = parte(p.hora, 0); if (x > mins && x < 1440) cand.push({ texto: p.titulo, cuando: hoy() + 'T' + hhmm(x) });
  }
  if (activo(aj, 'citas')) for (const c of d.citas || []) {
    const n = diasHasta(c.fecha); if (n === null || n <= (Number(aj.aviso_citas_dias) || 2)) continue;                                      // las de hoy a pasado mañana ya avisan
    const f = new Date(c.fecha + 'T12:00:00'); f.setDate(f.getDate() - (Number(aj.aviso_citas_dias) || 2));
    cand.push({ texto: `cita con ${c.con || 'el sanitario'} el ${fechaCorta(c.fecha)}${c.hora ? ' a las ' + c.hora : ''}`, cuando: f.getFullYear() + '-' + String(f.getMonth() + 1).padStart(2, '0') + '-' + String(f.getDate()).padStart(2, '0') + 'T00:00' });
  }
  return cand.filter(c => c.cuando > ya).sort((a, b) => a.cuando.localeCompare(b.cuando))[0] || null;
}

// Arriba en «Hoy»: SIEMPRE visible. Si hay avisos pendientes, los resume con el más urgente; si no, dice cuál será el próximo.
// Al tocarla se abre la pantalla Avisos (de ahí se pospone, anula o cancela).
export function render() {
  const { pend, posp } = clasificar();
  if (!pend.length) {
    const p = proximo(posp);
    const cuando = p ? (p.cuando.slice(0, 10) === hoy() ? 'a las ' + p.cuando.slice(11) : 'el ' + fechaCorta(p.cuando.slice(0, 10))) : '';
    return `<button type="button" class="item" data-nav="avisos" style="display:flex;width:100%;text-align:left;margin-bottom:6px">
      <div class="grow"><div class="nom">Sin avisos pendientes</div><div class="det">${p ? `Próximo aviso ${esc(cuando)}: ${esc(p.texto)}` : 'Por ahora no queda ningún aviso previsto.'}</div></div><span class="chip ok">Ver</span></button>`;
  }
  const rojos = pend.filter(a => a.nivel === 'bad'), ult = rojos.length ? rojos[rojos.length - 1] : pend[pend.length - 1];
  return `<button type="button" class="item ${rojos.length ? 'caducado' : 'alerta'}" data-nav="avisos" style="display:flex;width:100%;text-align:left;margin-bottom:6px">
    <div class="grow"><div class="nom">${pend.length} ${pend.length === 1 ? 'aviso pendiente' : 'avisos pendientes'}${rojos.length ? ` · ${rojos.length} en rojo` : ''}${posp.length ? ` · ${posp.length} pospuesto${posp.length === 1 ? '' : 's'}` : ''}</div><div class="det">${esc(ult.texto)}</div></div><span class="chip ${rojos.length ? 'bad' : 'warn'}">Ver</span></button>`;
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
