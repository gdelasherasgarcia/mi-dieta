// Pantalla «Recetario»: platos sencillos para la comida. Se aceptan o se descartan (lo descartado no vuelve a salir en el menú).
import * as S from '../store.js';
import { esc } from '../util.js';
import { abrirHoja } from '../ui.js';
import { GEN } from '../nutri_generica.js';
import { nutriReceta, enRango } from '../generador.js';

let filtro = 'aceptada';
const NOMBRE_APARATO = { sarten: 'sartén', horno: 'horno', microondas: 'microondas', freidora: 'freidora de aire', batidora: 'batidora' };

export function render() {
  const rs = S.datos().recetas, n = e => rs.filter(r => r.estado === e).length;
  const lista = rs.filter(r => filtro === 'todas' || r.estado === filtro).sort((a, b) => a.prot.localeCompare(b.prot) || a.nombre.localeCompare(b.nombre, 'es'));
  const filtros = [['aceptada', `Aceptadas (${n('aceptada')})`], ['descartada', `Descartadas (${n('descartada')})`], ['todas', 'Todas']].map(([k, t]) => `<button type="button" class="filtro" data-act="rec-filtro" data-k="${k}" aria-pressed="${filtro === k}">${t}</button>`).join('');
  return `<h1>Recetario</h1><p class="sub">Platos de comida con tus tres carnes. Descarta los que no te gusten.</p>
    <div class="filtros">${filtros}</div>
    ${lista.map(r => { const m = nutriReceta(r); return `<button type="button" class="item" data-act="rec-ver" data-id="${esc(r.id)}" style="${r.estado === 'descartada' ? 'opacity:.55' : ''}">
      <span class="grow"><span class="nom" style="display:block">${esc(r.nombre)}</span>
      <span class="det" style="display:block">${m.kcal} kcal · ${m.prot} g proteína · ${r.min} min · ${esc(r.aparatos.map(a => NOMBRE_APARATO[a] || a).join(', '))}</span></span>
      ${m.sal > 1.5 ? '<span class="chip warn">sal alta</span>' : !enRango(m) ? '<span class="chip warn">fuera de rango</span>' : `<span class="chip">${esc(r.prot)}</span>`}</button>`; }).join('') || '<div class="card vacio">No hay recetas en este filtro.</div>'}
    <p class="nota-pie">Calorías y proteína son estimaciones con valores medios, no de tu marca concreta. La sal de las legumbres de bote baja bastante si las enjuagas.</p>`;
}

export function acciones(act, el) {
  if (act === 'rec-filtro') { filtro = el.dataset.k; return true; }
  if (act === 'rec-ver') {
    const r = S.datos().recetas.find(x => x.id === el.dataset.id); if (!r) return true; const m = nutriReceta(r);
    abrirHoja(`<h1>${esc(r.nombre)}</h1><p class="sub">${m.kcal} kcal · ${m.prot} g de proteína · ${m.sal} g de sal (estimado) · ${r.min} min</p>
      <h2>Ingredientes (por ración, en crudo)</h2><ul style="padding-left:20px">${r.ing.map(i => `<li>${esc(GEN[i.k]?.nom || i.k)}: ${i.g} g</li>`).join('')}</ul>
      <h2>Cómo se hace</h2><p>${esc(r.pasos)}</p><p class="det">Aparatos: ${esc(r.aparatos.map(a => NOMBRE_APARATO[a] || a).join(', '))}</p>
      <div class="fila" style="margin-top:10px">${r.estado === 'aceptada' ? '<button class="btn peligro grow" type="submit" value="descartar">Descartar (que no vuelva)</button>' : '<button class="btn main grow" type="submit" value="aceptar">Volver a aceptar</button>'}<button class="btn grow" type="submit" value="cerrar">Cerrar</button></div>`, (f, acc) => {
      if (acc === 'descartar') r.estado = 'descartada'; else if (acc === 'aceptar') r.estado = 'aceptada'; else return true;
      S.guardar(); return true;
    });
    return true;
  }
  return false;
}
