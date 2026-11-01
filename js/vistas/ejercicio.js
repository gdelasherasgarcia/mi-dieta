// «Ejercicio de hoy» (dentro de Hoy): se apunta lo que se hace; alimenta el aviso de ejercicio.
import * as S from '../store.js';
import { esc, esOtroDia } from '../util.js';
import { abrirHoja, campo, avisar } from '../ui.js';

const ahora = () => esOtroDia() ? '' : new Date().toTimeString().slice(0, 5);          // en otro día no se apunta la hora de ahora
const TIPOS = [['pedaleadora', 'Pedaleadora', 15], ['paseo', 'Paseo', 20], ['puntillas', 'Levantarme y puntillas', 2]];

export function render() {
  const r = S.dia(), lista = r.ejercicio || [], total = lista.reduce((s, e) => s + (Number(e.min) || 0), 0);
  return `
    <h2>Ejercicio <span class="chip ${lista.length ? 'ok' : ''}" style="text-transform:none;letter-spacing:0">${total} min</span></h2>
    <div class="item" style="display:block">
      <div class="det" style="margin-bottom:8px">${lista.length ? lista.map(e => `${e.h ? esc(e.h) + ' ' : ''}${esc(e.nombre)} (${esc(e.min)} min)`).join(' · ') : 'Todavía nada apuntado.'}</div>
      <div class="pila">
        ${TIPOS.map(([k, t, m]) => `<button type="button" class="btn" data-act="eje-add" data-k="${k}">+ ${esc(t)} · ${m} min</button>`).join('')}
        <button type="button" class="btn" data-act="eje-otro">Otro ejercicio…</button>
        ${lista.length ? '<button type="button" class="btn" data-act="eje-quitar">↺ Quitar el último apuntado</button>' : ''}
      </div>
    </div>`;
}

export function acciones(act, el) {
  const r = S.dia(); r.ejercicio ||= [];
  if (act === 'eje-add') { const t = TIPOS.find(x => x[0] === el.dataset.k); r.ejercicio.push({ h: ahora(), nombre: t[1], min: t[2] }); S.guardar(); return true; }
  if (act === 'eje-quitar') { r.ejercicio.pop(); S.guardar(); return true; }
  if (act === 'eje-otro') {
    abrirHoja(`<h1>Ejercicio</h1>${campo('¿Qué has hecho?', `<input name="nombre" required placeholder="p. ej. paseo largo, step…" autocomplete="off">`)}${campo('Minutos', `<input name="min" type="number" inputmode="numeric" min="1" step="1" value="15">`)}
      <div class="fila"><button class="btn main grow" type="submit" value="guardar">Guardar</button></div>`, f => {
      const nombre = (f.nombre || '').trim(), min = Number(f.min); if (!nombre || !(min > 0)) { avisar('Apunta qué y cuántos minutos.'); return false; }
      r.ejercicio.push({ h: ahora(), nombre, min }); S.guardar(); return true;
    });
    return true;
  }
  return false;
}
