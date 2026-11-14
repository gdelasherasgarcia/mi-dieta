// Criterios de la persona (salud, qué puede comer, cómo cocina, cantidades, exclusiones y reglas propias), con casillas.
// Los usa «Pedir recetas a la IA»; guardan en el mismo sitio que el formulario del Menú (ajustes.ia_form), así que valen para los dos.
import { esc } from './util.js';
import { campo } from './ui.js';
import { SALUD, PROT, APARATOS } from './vistas/menu.js';

const on = (arr, k, def) => Array.isArray(arr) ? arr.includes(k) : def;
const caja = (n, t, marcada) => `<label class="fila" style="min-height:44px"><input type="checkbox" name="${n}" value="1" ${marcada ? 'checked' : ''} style="width:24px;height:24px"> <span>${t}</span></label>`;
const par = (t, a, b, v) => campo(t, `<div class="fila"><input name="${a}" type="number" inputmode="numeric" min="0" placeholder="de" value="${v && v[0] ? v[0] : ''}" style="width:48%"><input name="${b}" type="number" inputmode="numeric" min="0" placeholder="a" value="${v && v[1] ? v[1] : ''}" style="width:48%"></div>`);

export function htmlCriterios(F = {}) {
  return `<h2>Salud</h2><div class="card"><p class="det" style="margin:0">Marca las que coincidan; se combinan. Sin marcas, no hay restricciones de salud.</p>${SALUD.map(([k, t]) => caja('s_' + k, esc(t), on(F.salud, k, false))).join('')}
      ${campo('Otra condición (opcional)', `<input name="salud_txt" value="${esc(F.salud_txt || '')}" autocomplete="off" placeholder="p. ej. riñón, gluten">`)}</div>
    <h2>Qué puede comer</h2><div class="card"><p class="det" style="margin:0">Desmarca lo que NO quiera que salga.</p>${PROT.map(([k, t]) => caja('p_' + k, esc(t), on(F.prot, k, true))).join('')}
      ${campo('Otros alimentos excluidos (separados por comas)', `<input name="excl_txt" value="${esc(F.excl_txt || '')}" autocomplete="off" placeholder="p. ej. coliflor, lentejas">`)}</div>
    <h2>Cómo cocina</h2><div class="card">${campo('Tiempo máximo por plato', `<select name="min">${[[0, 'Sin límite'], [15, '15 minutos'], [30, '30 minutos'], [45, '45 minutos'], [60, '1 hora']].map(([v, t]) => `<option value="${v}" ${Number(F.min || 0) === v ? 'selected' : ''}>${t}</option>`).join('')}</select>`)}
      ${APARATOS.map(([k, t]) => caja('a_' + k, esc(t), on(F.aparatos, k, true))).join('')}</div>
    <h2>Cantidades <span class="det">(vacío = sin límite)</span></h2><div class="card">${par('Calorías por plato', 'kp0', 'kp1', F.kcal_p)}${par('Proteína por plato (g)', 'pp0', 'pp1', F.prot_p)}</div>
    <h2>Reglas propias</h2><div class="card">${campo('Una por línea', `<textarea name="reglas" rows="3" style="width:100%;border-radius:12px;border:1px solid var(--line);background:var(--card);padding:10px" placeholder="p. ej. aceite de oliva en vaporizador">${esc(F.reglas || '')}</textarea>`)}</div>`;
}

// Lee lo marcado y lo mezcla con lo que ya había guardado (se conserva lo que este formulario no toca: gustos, reserva, cantidades por día…).
export function leerCriterios(g, F = {}) {
  const prot = PROT.filter(([k]) => g['p_' + k] === '1').map(x => x[0]), aparatos = APARATOS.filter(([k]) => g['a_' + k] === '1').map(x => x[0]);
  if (!prot.length || !aparatos.length) return { error: 'Deja al menos una proteína y una forma de cocinar.' };
  const par2 = (a, b) => [Number(g[a]) || 0, Number(g[b]) || 0];
  return { F: { ...F, salud: SALUD.filter(([k]) => g['s_' + k] === '1').map(x => x[0]), salud_txt: (g.salud_txt || '').trim(), prot, aparatos, excl_txt: (g.excl_txt || '').trim(), min: Number(g.min) || 0, kcal_p: par2('kp0', 'kp1'), prot_p: par2('pp0', 'pp1'), reglas: (g.reglas || '').trim() } };
}
